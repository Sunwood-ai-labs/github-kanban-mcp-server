import { CallToolRequest, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ToolResponse, RepoArgs } from '../types.js';
import {
  handleListIssues,
  handleCreateIssue,
  handleUpdateIssue,
  handleAddComment,
} from './index.js';
import { getRepoInfoFromGitConfig, validateRepoInfo } from '../utils/repo-info.js';

export async function handleToolRequest(request: CallToolRequest): Promise<ToolResponse> {
  try {
    const args = request.params.arguments as Record<string, unknown> & RepoArgs;

    // pathパラメータの確認
    if (!args.path) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'リポジトリのパスを指定してください。引数で "path": "/path/to/repo" の形式で指定してください。'
      );
    }

    // リポジトリ情報の取得
    let repoInfo: { owner: string; repo: string };
    try {
      repoInfo = await getRepoInfoFromGitConfig(args.path as string);
    } catch (error) {
      // Gitリポジトリ関連のエラーの場合は、より具体的なエラーメッセージを表示
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InvalidParams,
        `指定されたパスのリポジトリ情報の取得に失敗しました: ${(error as Error).message}`
      );
    }

    const fullRepo = `${repoInfo.owner}/${repoInfo.repo}`;

    switch (request.params.name) {
      case 'list_issues':
        return await handleListIssues({
          path: args.path as string,
          state: args?.state as 'open' | 'closed' | 'all',
          labels: args?.labels as string[],
        });
      case 'create_issue': {
        if (!args?.title) {
          throw new McpError(ErrorCode.InvalidParams, 'Title is required');
        }
        return await handleCreateIssue({
          path: args.path as string,
          title: args.title as string,
          emoji: args?.emoji as string | undefined,
          body: args?.body as string | undefined,
          labels: args?.labels as string[] | undefined,
          assignees: args?.assignees as string[] | undefined,
        });
      }
      case 'update_issue': {
        if (!args?.issue_number) {
          throw new McpError(ErrorCode.InvalidParams, 'Issue number is required');
        }
        return await handleUpdateIssue({
          path: args.path as string,
          issue_number: Number(args.issue_number),
          title: args?.title as string | undefined,
          emoji: args?.emoji as string | undefined,
          body: args?.body as string | undefined,
          state: args?.state as 'open' | 'closed' | undefined,
          labels: args?.labels as string[] | undefined,
          assignees: args?.assignees as string[] | undefined,
        });
      }
      case 'add_comment': {
        if (!args?.issue_number || !args?.body) {
          throw new McpError(ErrorCode.InvalidParams, 'Issue number and body are required');
        }
        return await handleAddComment({
          repo: fullRepo,
          issue_number: args.issue_number as string,
          body: args.body as string,
          state: args?.state as 'open' | 'closed' | undefined,
        });
      }
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `GitHub API error: ${(error as Error).message}`
    );
  }
}
