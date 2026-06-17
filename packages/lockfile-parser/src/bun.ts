import { readFileSync } from 'fs';
import { createCanonicalLockfile, createEmptyRoot, normalizeBunPackageResolution, packageId, stripJsonComments } from './utils.js';
import { CanonicalLockfile } from './types.js';

interface BunLockWorkspace {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface BunLockFile {
  lockfileVersion: number;
  workspaces?: Record<string, BunLockWorkspace>;
  packages?: Record<string, [string, Record<string, string>?, string?]>;
}

export function parseBunLockfile(path: string): CanonicalLockfile {
  const content = readFileSync(path, 'utf8');
  return parseBunLockfileContent(content);
}

export function parseBunLockfileContent(content: string): CanonicalLockfile {
  const parsed = JSON.parse(stripJsonComments(content)) as BunLockFile;
  const rootWorkspace = parsed.workspaces?.[''] || {};
  const root = createEmptyRoot({
    dependencies: rootWorkspace.dependencies,
    devDependencies: rootWorkspace.devDependencies,
    optionalDependencies: rootWorkspace.optionalDependencies,
    peerDependencies: rootWorkspace.peerDependencies,
  });

  const packages = Object.entries(parsed.packages || {}).map(([name, value]) => {
    const [resolution, dependencies = {}, integrity] = value;
    const normalized = normalizeBunPackageResolution(name, resolution);

    return {
      id: packageId(name, normalized.version),
      name,
      version: normalized.version,
      dependencies,
      optionalDependencies: {},
      resolved: normalized.resolved,
      integrity,
    };
  });

  return createCanonicalLockfile('bun', root, packages);
}
