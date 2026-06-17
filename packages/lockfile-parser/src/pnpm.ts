import { z } from 'zod';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

export const PnpmLockfileSchema = z.object({
  lockfileVersion: z.union([z.string(), z.number()]),
  importers: z.record(z.string(), z.any()).optional(),
  packages: z.record(z.string(), z.any()).optional(),
});

export type PnpmLockfile = z.infer<typeof PnpmLockfileSchema>;

export function parsePnpmLockfile(path: string): PnpmLockfile {
  const content = readFileSync(path, 'utf8');
  return parsePnpmLockfileContent(content);
}

export function parsePnpmLockfileContent(content: string): PnpmLockfile {
  return parse(content);
}
