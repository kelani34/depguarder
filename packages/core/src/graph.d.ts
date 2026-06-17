export interface DependencyNode {
    name: string;
    version: string;
    resolved?: string;
    integrity?: string;
    isDev: boolean;
    isTransitive: boolean;
    dependencies: Set<string>;
}
export interface DependencyGraph {
    root: string;
    nodes: Map<string, DependencyNode>;
}
//# sourceMappingURL=graph.d.ts.map