export type LockfileType = 'npm' | 'pnpm' | 'yarn' | 'yarn-berry' | 'bun';

export interface CanonicalRootSnapshot {
  name?: string;
  version?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
}

export interface CanonicalPackageNode {
  id: string;
  name: string;
  version: string;
  dependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  resolved?: string;
  integrity?: string;
  isWorkspace?: boolean;
}

export interface CanonicalLockfile {
  manager: LockfileType;
  root: CanonicalRootSnapshot;
  packages: Map<string, CanonicalPackageNode>;
}
