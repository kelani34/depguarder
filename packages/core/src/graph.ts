export interface DependencyNode {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  isDev: boolean;
  isTransitive: boolean;
  dependencies: Set<string>; // Set of package identifiers (e.g., name@version)
}

export interface DependencyGraph {
  root: string;
  nodes: Map<string, DependencyNode>; // Map of identifier -> node
}
