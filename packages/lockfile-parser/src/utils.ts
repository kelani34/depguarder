import { CanonicalLockfile, CanonicalPackageNode, CanonicalRootSnapshot } from './types.js';

interface RootLikeManifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export function createEmptyRoot(manifest?: RootLikeManifest): CanonicalRootSnapshot {
  return {
    name: manifest?.name,
    version: manifest?.version,
    dependencies: manifest?.dependencies || {},
    devDependencies: manifest?.devDependencies || {},
    optionalDependencies: manifest?.optionalDependencies || {},
    peerDependencies: manifest?.peerDependencies || {},
  };
}

export function createCanonicalLockfile(
  manager: CanonicalLockfile['manager'],
  root: CanonicalRootSnapshot,
  packages: Iterable<CanonicalPackageNode>
): CanonicalLockfile {
  return {
    manager,
    root,
    packages: new Map(Array.from(packages).map((pkg) => [pkg.id, pkg])),
  };
}

export function packageId(name: string, version: string): string {
  return `${name}@${version}`;
}

export function splitNameVersion(id: string): { name: string; version: string } {
  const normalized = id.startsWith('/') ? id.slice(1) : id;
  const lastAt = normalized.lastIndexOf('@');
  if (lastAt <= 0) {
    return {
      name: normalized,
      version: '0.0.0',
    };
  }
  return {
    name: normalized.slice(0, lastAt),
    version: normalized.slice(lastAt + 1),
  };
}

export function stripJsonComments(input: string): string {
  let result = '';
  let inString = false;
  let quote = '"';
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      quote = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i++;
      result += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i++;
      continue;
    }

    result += char;
  }

  return result.replace(/,\s*([}\]])/g, '$1');
}

export function normalizeBunPackageResolution(name: string, resolution: string): { version: string; resolved: string } {
  const withoutAlias = resolution.startsWith(`${name}@`)
    ? resolution.slice(name.length + 1)
    : resolution.includes('@')
      ? resolution.slice(resolution.indexOf('@') + 1)
      : resolution;
  return {
    version: withoutAlias || resolution,
    resolved: resolution,
  };
}
