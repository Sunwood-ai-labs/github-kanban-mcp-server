import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ghAsync } from '../utils/exec.js';
import { getRepoInfoFromGitConfig } from '../utils/repo-info.js';

/**
 * ランダムな16進数カラーコードを生成する
 */
export function generateRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

/**
 * リポジトリ内の既存のラベルを取得する
 */
export async function getExistingLabels(path: string): Promise<string[]> {
  try {
    const { owner, repo } = await getRepoInfoFromGitConfig(path);
    const { stdout } = await ghAsync([
      'label',
      'list',
      '--repo',
      `${owner}/${repo}`,
      '--json',
      'name',
      '--jq',
      '.[].name',
    ]);
    return stdout.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Failed to get labels:', error);
    return [];
  }
}

/**
 * 新しいラベルを作成する
 */
export async function createLabel(path: string, name: string): Promise<void> {
  const color = generateRandomColor().substring(1); // '#'を除去
  const { owner, repo } = await getRepoInfoFromGitConfig(path);
  try {
    await ghAsync([
      'label',
      'create',
      name,
      '--repo',
      `${owner}/${repo}`,
      '--color',
      color,
      '--force',
    ]);
  } catch (error) {
    console.error(`Failed to create label ${name}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create label ${name}: ${(error as Error).message}`
    );
  }
}
