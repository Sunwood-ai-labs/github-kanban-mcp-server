import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import fs from 'fs/promises';

export const execFileAsync = promisify(execFile);

export async function ghAsync(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return await execFileAsync('gh', args);
}

/**
 * 一時ファイルにMarkdownコンテンツを書き込む
 * @param content Markdownコンテンツ
 * @param filePath 一時ファイルのパス
 */
export async function writeToTempFile(content: string, filePath: string): Promise<string> {
  const tmpDir = join(process.cwd(), 'tmp');
  const fullPath = join(tmpDir, filePath);

  // tmpディレクトリが存在しない場合は作成
  try {
    await fs.access(tmpDir);
  } catch {
    await fs.mkdir(tmpDir, { recursive: true });
  }

  // ファイルに内容を書き込む
  await fs.writeFile(fullPath, content, 'utf-8');
  
  return fullPath;
}

/**
 * 一時ファイルを削除する
 * @param filePath 一時ファイルのパス
 */
export async function removeTempFile(filePath: string): Promise<void> {
  try {
    const tmpDir = join(process.cwd(), 'tmp');
    const fullPath = join(tmpDir, filePath);
    await fs.unlink(fullPath);
  } catch (error) {
    console.error('Failed to remove temporary file:', error);
  }
}
