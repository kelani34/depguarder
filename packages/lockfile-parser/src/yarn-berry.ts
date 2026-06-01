import { readFileSync } from 'fs';
import { parse } from 'yaml';

export function parseYarnBerryLockfile(path: string): any {
  const content = readFileSync(path, 'utf8');
  return parse(content);
}
