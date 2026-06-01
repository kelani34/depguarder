import { readFileSync } from 'fs';
import pkg from '@yarnpkg/lockfile';
const { parse } = pkg;

export function parseYarnLockfile(path: string): any {
  const content = readFileSync(path, 'utf8');
  const result = parse(content);
  if (result.type !== 'success') {
      throw new Error(`Failed to parse yarn.lock at ${path}`);
  }
  return result.object;
}
