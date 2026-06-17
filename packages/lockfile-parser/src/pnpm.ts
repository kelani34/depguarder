import { z } from 'zod';
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { createCanonicalLockfile, createEmptyRoot, packageId, splitNameVersion } from './utils.js';
import { CanonicalLockfile } from './types.js';

export const PnpmLockfileSchema = z.object({
  lockfileVersion: z.union([z.string(), z.number()]),
  importers: z.record(z.string(), z.any()).optional(),
  packages: z.record(z.string(), z.any()).optional(),
});

export type PnpmLockfile = z.infer<typeof PnpmLockfileSchema>;

export function parsePnpmLockfile(path: string): CanonicalLockfile {
  const content = readFileSync(path, 'utf8');
  return parsePnpmLockfileContent(content);
}

export function parsePnpmLockfileContent(content: string): CanonicalLockfile {
  const parsed = PnpmLockfileSchema.parse(parse(content));
  const importer = parsed.importers?.['.'] || {};

  const root = createEmptyRoot({
    dependencies: extractPnpmDependencyMap(importer.dependencies),
    devDependencies: extractPnpmDependencyMap(importer.devDependencies),
    optionalDependencies: extractPnpmDependencyMap(importer.optionalDependencies),
    peerDependencies: extractPnpmDependencyMap(importer.peerDependencies),
  });

  const packages = Object.entries(parsed.packages || {}).map(([pkgKey, pkgData]) => {
    const { name, version } = splitNameVersion(pkgKey);
    return {
      id: packageId(name, version),
      name,
      version,
      dependencies: pkgData.dependencies || {},
      optionalDependencies: pkgData.optionalDependencies || {},
      resolved: pkgData.resolution?.tarball,
      integrity: pkgData.resolution?.integrity,
    };
  });

  return createCanonicalLockfile('pnpm', root, packages);
}

function extractPnpmDependencyMap(value: Record<string, any> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, info] of Object.entries(value || {})) {
    result[name] = typeof info === 'string' ? info : info.version || info.specifier || '';
  }
  return result;
}
