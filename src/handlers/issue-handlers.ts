import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { IssueArgs, CreateIssueArgs, UpdateIssueArgs, ToolResponse } from '../types.js';
import { ghAsync, writeToTempFile, removeTempFile } from '../utils/exec.js';
import { getExistingLabels, createLabel } from './label-handlers.js';
import { getRepoInfoFromGitConfig } from '../utils/repo-info.js';

function repoArg(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function issueNumberArg(issueNumber: number): string {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Issue番号は正の整数で指定してください。'
    );
  }
  return String(issueNumber);
}

/**
 * リポジトリ情報を取得する
 */
async function getRepoInfo(args: { path: string }): Promise<{ owner: string; repo: string }> {
  if (!args.path) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'リポジトリのパスを指定してください。'
    );
  }
  
  return await getRepoInfoFromGitConfig(args.path);
}

/**
 * Issue一覧を取得する
 */
export async function handleListIssues(args: IssueArgs): Promise<ToolResponse> {
  const { owner, repo } = await getRepoInfo(args);
  const ghArgs = [
    'issue',
    'list',
    '--repo',
    repoArg(owner, repo),
    '--json',
    'number,title,state,labels,assignees,createdAt,updatedAt',
  ];

  if (args.state) {
    ghArgs.push('--state', args.state);
  }

  if (args.labels?.length) {
    ghArgs.push('--label', args.labels.join(','));
  }
  
  const { stdout } = await ghAsync(ghArgs);

  return {
    content: [
      {
        type: 'text',
        text: stdout,
      },
    ],
  };
}

/**
 * 新しいIssueを作成する
 */
export async function handleCreateIssue(args: CreateIssueArgs): Promise<ToolResponse> {
  const { owner, repo } = await getRepoInfo(args);
  const tempFile = 'issue_body.md';

  try {
    // ラベルの存在確認と作成
    if (args.labels?.length) {
      const existingLabels = await getExistingLabels(args.path);
      for (const label of args.labels) {
        if (!existingLabels.includes(label)) {
          await createLabel(args.path, label);
        }
      }
    }
    // タイトルに絵文字を付与（指定がある場合）
    const titleWithEmoji = args.emoji ? `${args.emoji} ${args.title}` : args.title;
    const ghArgs = [
      'issue',
      'create',
      '--repo',
      repoArg(owner, repo),
      '--title',
      titleWithEmoji,
    ];

    if (args.body) {
      const fullPath = await writeToTempFile(args.body, tempFile);
      ghArgs.push('--body-file', fullPath);
    }

    if (args.labels?.length) {
      ghArgs.push('--label', args.labels.join(','));
    }

    if (args.assignees?.length) {
      ghArgs.push('--assignee', args.assignees.join(','));
    }

    const { stdout } = await ghAsync(ghArgs);

    // URLから issue number を抽出
    const issueUrl = stdout.trim();
    const issueNumber = issueUrl.split('/').pop();

    // 作成したissueの詳細情報を取得
    const { stdout: issueData } = await ghAsync([
      'issue',
      'view',
      issueNumber ?? '',
      '--repo',
      repoArg(owner, repo),
      '--json',
      'number,title,url',
    ]);

    return {
      content: [
        {
          type: 'text',
          text: issueData,
        },
      ],
    };
  } finally {
    if (args.body) {
      await removeTempFile(tempFile);
    }
  }
}

/**
 * 既存のIssueを更新する
 */
export async function handleUpdateIssue(args: UpdateIssueArgs): Promise<ToolResponse> {
  const { owner, repo } = await getRepoInfo(args);
  const issueNumber = issueNumberArg(args.issue_number);

  const tempFile = 'update_body.md';

  try {
    // 状態の更新を処理
    if (args.state) {
      const command = args.state === 'closed' ? 'close' : 'reopen';
      await ghAsync(['issue', command, issueNumber, '--repo', repoArg(owner, repo)]);
    }

    // その他の更新を処理
    if (args.title || args.body || args.labels?.length || args.assignees?.length) {
      const ghArgs = ['issue', 'edit', issueNumber, '--repo', repoArg(owner, repo)];

      if (args.title) {
        ghArgs.push('--title', args.emoji ? `${args.emoji} ${args.title}` : args.title);
      }

      if (args.body) {
        const fullPath = await writeToTempFile(args.body, tempFile);
        ghArgs.push('--body-file', fullPath);
      }

      if (args.labels?.length) {
        ghArgs.push('--add-label', args.labels.join(','));
      }

      if (args.assignees?.length) {
        ghArgs.push('--add-assignee', args.assignees.join(','));
      }

      await ghAsync(ghArgs);
    }

    const { stdout: issueData } = await ghAsync([
      'issue',
      'view',
      issueNumber,
      '--repo',
      repoArg(owner, repo),
      '--json',
      'number,title,state,url',
    ]);

    return {
      content: [
        {
          type: 'text',
          text: issueData,
        },
      ],
    };
  } finally {
    if (args.body) {
      await removeTempFile(tempFile);
    }
  }
}
