import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { createCanonicalLockfile, createEmptyRoot, packageId, splitNameVersion } from './utils.js';
import { CanonicalLockfile } from './types.js';

export function parseYarnBerryLockfile(path: string): CanonicalLockfile {
  const content = readFileSync(path, 'utf8');
  return parseYarnBerryLockfileContent(content);
}

export function parseYarnBerryLockfileContent(content: string): CanonicalLockfile {
  const object = parse(content) as Record<string, any>;
  const packages = Object.entries(object)
    .filter(([entryKey]) => entryKey !== '__metadata')
    .map(([entryKey, pkgData]) => {
      const { name } = splitNameVersion(entryKey);
      const version = pkgData.version;
      return {
        id: packageId(name, version),
        name,
        version,
        dependencies: pkgData.dependencies || {},
        optionalDependencies: {},
        resolved: pkgData.resolution || entryKey,
        integrity: pkgData.checksum,
      };
    });

  return createCanonicalLockfile('yarn-berry', createEmptyRoot(), packages);
}
