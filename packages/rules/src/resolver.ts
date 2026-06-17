import pacote from 'pacote';

export interface ResolvedDependencyNode {
  id: string;
  name: string;
  version: string;
  dependencies: string[];
}

export interface ResolvedDependencyGraph {
  root: string;
  nodes: Map<string, ResolvedDependencyNode>;
}

export async function resolvePackageGraph(name: string, versionSpec: string): Promise<ResolvedDependencyGraph> {
  const nodes = new Map<string, ResolvedDependencyNode>();
  const visited = new Set<string>();

  async function visit(pkgName: string, spec: string): Promise<string> {
    const manifest = await pacote.manifest(`${pkgName}@${spec}`, { fullMetadata: true }) as any;
    const id = `${manifest.name}@${manifest.version}`;

    if (visited.has(id)) {
      return id;
    }
    visited.add(id);

    const dependencies = {
      ...(manifest.dependencies || {}),
      ...(manifest.optionalDependencies || {}),
    };

    const childIds: string[] = [];
    for (const [depName, depSpec] of Object.entries(dependencies) as Array<[string, string]>) {
      childIds.push(await visit(depName, depSpec));
    }

    nodes.set(id, {
      id,
      name: manifest.name,
      version: manifest.version,
      dependencies: childIds,
    });

    return id;
  }

  const root = await visit(name, versionSpec);
  return { root, nodes };
}
