import { z } from 'zod';
import { readFileSync } from 'fs';

export const LockfilePackageSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  resolved: z.string().optional(),
  integrity: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  workspaces: z.array(z.string()).optional(),
  link: z.boolean().optional(),
});

export const NpmLockfileSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  lockfileVersion: z.number(),
  packages: z.record(z.string(), LockfilePackageSchema),
});

export type NpmLockfile = z.infer<typeof NpmLockfileSchema>;

export function parseNpmLockfile(path: string): NpmLockfile {
  const content = readFileSync(path, 'utf8');
  const json = JSON.parse(content);
  return NpmLockfileSchema.parse(json);
}
