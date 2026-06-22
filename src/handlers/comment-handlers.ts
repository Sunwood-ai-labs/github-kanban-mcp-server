import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ghAsync, tempMarkdownFileName, writeToTempFile, removeTempFile } from '../utils/exec.js';
import { ToolResponse } from '../types.js';

function validateRepo(repo: string): void {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'repoは owner/repo 形式で指定してください。'
    );
  }
}

function validateIssueNumber(issueNumber: string): void {
  if (!/^[1-9][0-9]*$/.test(issueNumber)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Issue番号は正の整数で指定してください。'
    );
  }
}

/**
 * Issueにコメントを追加する
 */
export async function handleAddComment(args: {
  repo: string;
  issue_number: string | number;
  body: string;
  state?: 'open' | 'closed';
}): Promise<ToolResponse> {
  const tempFile = tempMarkdownFileName('comment-body');
  const issueNumber = String(args.issue_number);
  validateRepo(args.repo);
  validateIssueNumber(issueNumber);

  try {
    // ステータスの変更が指定されている場合は先に処理
    if (args.state) {
      try {
        const command = args.state === 'closed' ? 'close' : 'reopen';
        await ghAsync(['issue', command, issueNumber, '--repo', args.repo]);
        console.log(`Issue status changed to ${args.state}`);
      } catch (error) {
        console.error('Failed to change issue status:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to change issue status: ${(error as Error).message}`
        );
      }
    }

    // コメントを追加
    const fullPath = await writeToTempFile(args.body, tempFile);
    try {
      await ghAsync([
        'issue',
        'comment',
        issueNumber,
        '--repo',
        args.repo,
        '--body-file',
        fullPath,
      ]);
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add comment: ${(error as Error).message}`
      );
    }

    // 更新後のissue情報を取得して返却
    try {
      const { stdout: issueData } = await ghAsync([
        'issue',
        'view',
        issueNumber,
        '--repo',
        args.repo,
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
    } catch (error) {
      console.error('Failed to get issue data:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get issue data: ${(error as Error).message}`
      );
    }
  } finally {
    await removeTempFile(tempFile);
  }
}
