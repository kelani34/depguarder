import { readFileSync } from 'fs';
import pkg from '@yarnpkg/lockfile';
import { createCanonicalLockfile, createEmptyRoot, packageId, splitNameVersion } from './utils.js';
import { CanonicalLockfile } from './types.js';
const { parse } = pkg;

export function parseYarnLockfile(path: string): CanonicalLockfile {
  const content = readFileSync(path, 'utf8');
  return parseYarnLockfileContent(content, path);
}

export function parseYarnLockfileContent(content: string, source = 'yarn.lock'): CanonicalLockfile {
  const result = parse(content);
  if (result.type !== 'success') {
      throw new Error(`Failed to parse yarn.lock at ${source}`);
  }

  const object = result.object as Record<string, any>;
  const packages = Object.entries(object).map(([entryKey, pkgData]) => {
    const { name } = splitNameVersion(entryKey);
    const version = pkgData.version;
    return {
      id: packageId(name, version),
      name,
      version,
      dependencies: pkgData.dependencies || {},
      optionalDependencies: {},
      resolved: entryKey,
      integrity: pkgData.integrity,
    };
  });

  return createCanonicalLockfile('yarn', createEmptyRoot(), packages);
}
