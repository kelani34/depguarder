import { z } from 'zod';
import { readFileSync } from 'fs';

export const ManifestSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  scripts: z.record(z.string(), z.string()).optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export function parseManifest(path: string): Manifest {
  const content = readFileSync(path, 'utf8');
  return parseManifestContent(content);
}

export function parseManifestContent(content: string): Manifest {
  const json = JSON.parse(content);
  return ManifestSchema.parse(json);
}
