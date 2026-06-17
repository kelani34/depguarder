import { z } from 'zod';
import { readFileSync } from 'fs';
import { createCanonicalLockfile, createEmptyRoot, packageId, splitNameVersion } from './utils.js';
import { CanonicalLockfile } from './types.js';

export const LockfilePackageSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  resolved: z.string().optional(),
  integrity: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
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

export function parseNpmLockfile(path: string): CanonicalLockfile {
  const content = readFileSync(path, 'utf8');
  return parseNpmLockfileContent(content);
}

export function parseNpmLockfileContent(content: string): CanonicalLockfile {
  const json = JSON.parse(content);
  const lockfile = NpmLockfileSchema.parse(json);

  const rootPkg = lockfile.packages[''] || {};
  const root = createEmptyRoot({
    name: lockfile.name,
    version: lockfile.version,
    dependencies: rootPkg.dependencies,
    devDependencies: rootPkg.devDependencies,
    optionalDependencies: rootPkg.optionalDependencies,
    peerDependencies: rootPkg.peerDependencies,
  });

  const packages = Object.entries(lockfile.packages)
    .filter(([pkgPath]) => pkgPath !== '')
    .map(([pkgPath, pkgData]) => {
      const fallbackName = pkgPath.split('node_modules/').pop() || pkgPath;
      const explicit = pkgData.name && pkgData.version
        ? { name: pkgData.name, version: pkgData.version }
        : splitNameVersion(fallbackName);
      const name = pkgData.name || explicit.name || fallbackName;
      const version = pkgData.version || explicit.version || '0.0.0';

      return {
        id: packageId(name, version),
        name,
        version,
        dependencies: pkgData.dependencies || {},
        optionalDependencies: pkgData.optionalDependencies || {},
        resolved: pkgData.resolved,
        integrity: pkgData.integrity,
        isWorkspace: pkgPath.startsWith('packages/'),
      };
    });

  return createCanonicalLockfile('npm', root, packages);
}
