import { execSync } from 'child_process';
import pkg from '@yarnpkg/lockfile';
const { parse } = pkg;
import { dirname } from 'path';

export function parseBunLockfile(path: string): any {
  try {
    // Bun can export its lockfile to Yarn v1 format using 'bun bun.lockb' 
    // (even if the file is named bun.lock)
    const yarnCompatibleText = execSync(`bun bun.lockb`, { 
        encoding: 'utf8',
        cwd: dirname(path)
    });
    const result = parse(yarnCompatibleText);
    if (result.type !== 'success') {
        throw new Error(`Failed to parse bun exported yarn lockfile`);
    }
    return result.object;
  } catch (e: any) {
    throw new Error(`Failed to parse bun.lock: ${e.message}. Ensure 'bun' is installed and run from a bun project directory.`);
  }
}
