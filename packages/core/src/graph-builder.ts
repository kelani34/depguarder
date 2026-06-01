import { Manifest } from './manifest.js';
import { DependencyGraph, DependencyNode } from './graph.js';

export type LockfileType = 'npm' | 'pnpm' | 'yarn' | 'yarn-berry' | 'bun';

export function buildGraph(lockfileData: any, manifest: Manifest, type: string = 'npm'): DependencyGraph {
    if (type === 'npm') {
        return buildGraphFromNpm(lockfileData, manifest);
    } else if (type === 'pnpm') {
        return buildGraphFromPnpm(lockfileData, manifest);
    } else if (type === 'yarn' || type === 'bun') {
        return buildGraphFromYarn(lockfileData, manifest);
    } else if (type === 'yarn-berry') {
        return buildGraphFromYarnBerry(lockfileData, manifest);
    } else {
        throw new Error(`Lockfile type ${type} not yet supported in graph builder.`);
    }
}

function buildGraphFromNpm(packages: Record<string, any>, manifest: Manifest): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const rootNodeId = `${manifest.name}@${manifest.version || '0.0.0'}`;

    function getPackageId(pkgPath: string, pkgData: any): string {
        const name = pkgData.name || (pkgPath === '' ? manifest.name : pkgPath.split('node_modules/').pop()!);
        const version = pkgData.version || '0.0.0';
        return `${name}@${version}`;
    }

    for (const [pkgPath, pkgData] of Object.entries(packages)) {
        const id = getPackageId(pkgPath, pkgData);
        if (!nodes.has(id)) {
            nodes.set(id, {
                name: id.split('@').slice(0, -1).join('@'),
                version: id.split('@').pop()!,
                resolved: pkgData.resolved,
                integrity: pkgData.integrity,
                isDev: false,
                isTransitive: pkgPath !== '' && !pkgPath.startsWith('packages/'),
                dependencies: new Set(),
            });
        }

        const node = nodes.get(id)!;
        const allDeps = { ...pkgData.dependencies, ...pkgData.devDependencies };
        for (const depName of Object.keys(allDeps)) {
            for (const [searchPath, searchData] of Object.entries(packages)) {
                const searchName = searchData.name || (searchPath === '' ? manifest.name : searchPath.split('node_modules/').pop()!);
                if (searchName === depName) {
                    node.dependencies.add(getPackageId(searchPath, searchData));
                    break;
                }
            }
        }
    }

    const rootPkg = packages[''];
    if (rootPkg && rootPkg.workspaces) {
        const rootNode = nodes.get(rootNodeId);
        if (rootNode) {
            for (const [searchPath, searchData] of Object.entries(packages)) {
                if (searchPath.startsWith('packages/')) {
                    rootNode.dependencies.add(getPackageId(searchPath, searchData));
                }
            }
        }
    }

    return finalizeGraph(nodes, rootNodeId, manifest);
}

function buildGraphFromPnpm(pnpmData: any, manifest: Manifest): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const rootNodeId = `${manifest.name}@${manifest.version || '0.0.0'}`;

    nodes.set(rootNodeId, {
        name: manifest.name,
        version: manifest.version || '0.0.0',
        isDev: false,
        isTransitive: false,
        dependencies: new Set(),
    });

    const importer = pnpmData.importers?.['.'] || pnpmData;
    const rootNode = nodes.get(rootNodeId)!;
    const directDeps = { ...importer.dependencies, ...importer.devDependencies, ...importer.optionalDependencies };
    
    for (const [depName, depInfo] of Object.entries(directDeps)) {
        const version = typeof depInfo === 'string' ? depInfo : (depInfo as any).version;
        rootNode.dependencies.add(`${depName}@${version}`);
    }

    if (pnpmData.packages) {
        for (const [pkgKey, pkgData] of Object.entries(pnpmData.packages as Record<string, any>)) {
            const id = pkgKey.startsWith('/') ? pkgKey.slice(1) : pkgKey;
            const lastAt = id.lastIndexOf('@');
            const name = id.slice(0, lastAt);
            const version = id.slice(lastAt + 1);

            if (!nodes.has(id)) {
                nodes.set(id, {
                    name,
                    version,
                    resolved: pkgData.resolution?.tarball,
                    integrity: pkgData.resolution?.integrity,
                    isDev: false,
                    isTransitive: true,
                    dependencies: new Set(),
                });
            }

            const node = nodes.get(id)!;
            const deps = { ...pkgData.dependencies, ...pkgData.optionalDependencies };
            for (const [dName, dVersion] of Object.entries(deps)) {
                node.dependencies.add(`${dName}@${dVersion}`);
            }
        }
    }

    return finalizeGraph(nodes, rootNodeId, manifest);
}

function buildGraphFromYarn(yarnData: any, manifest: Manifest): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const rootNodeId = `${manifest.name}@${manifest.version || '0.0.0'}`;

    nodes.set(rootNodeId, {
        name: manifest.name,
        version: manifest.version || '0.0.0',
        isDev: false,
        isTransitive: false,
        dependencies: new Set(),
    });

    const rootNode = nodes.get(rootNodeId)!;
    for (const [entryKey, pkgData] of Object.entries(yarnData as Record<string, any>)) {
        const lastAt = entryKey.lastIndexOf('@');
        const name = entryKey.slice(0, lastAt);
        const version = pkgData.version;
        const id = `${name}@${version}`;

        if (!nodes.has(id)) {
            nodes.set(id, {
                name,
                version,
                resolved: pkgData.resolved,
                integrity: pkgData.integrity,
                isDev: false,
                isTransitive: true,
                dependencies: new Set(),
            });
        }

        const node = nodes.get(id)!;
        if (pkgData.dependencies) {
            for (const [dName, dRange] of Object.entries(pkgData.dependencies as Record<string, string>)) {
                const dEntryKey = `${dName}@${dRange}`;
                const dPkgData = yarnData[dEntryKey];
                if (dPkgData) {
                    node.dependencies.add(`${dName}@${dPkgData.version}`);
                }
            }
        }
    }

    const allRootDeps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
    for (const [dName, dRange] of Object.entries(allRootDeps)) {
        const dEntryKey = `${dName}@${dRange}`;
        const dPkgData = yarnData[dEntryKey];
        if (dPkgData) {
            rootNode.dependencies.add(`${dName}@${dPkgData.version}`);
        }
    }

    return finalizeGraph(nodes, rootNodeId, manifest);
}

function buildGraphFromYarnBerry(yarnData: any, manifest: Manifest): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const rootNodeId = `${manifest.name}@${manifest.version || '0.0.0'}`;

    nodes.set(rootNodeId, {
        name: manifest.name,
        version: manifest.version || '0.0.0',
        isDev: false,
        isTransitive: false,
        dependencies: new Set(),
    });

    const rootNode = nodes.get(rootNodeId)!;
    
    for (const [entryKey, pkgData] of Object.entries(yarnData as Record<string, any>)) {
        if (entryKey === '__metadata') continue;

        const firstAt = entryKey.startsWith('@') ? 1 : 0;
        const nextAt = entryKey.indexOf('@', firstAt);
        const name = entryKey.slice(0, nextAt);
        const version = pkgData.version;
        if (!version) continue;

        const id = `${name}@${version}`;

        if (!nodes.has(id)) {
            nodes.set(id, {
                name,
                version,
                resolved: pkgData.resolution,
                integrity: pkgData.checksum,
                isDev: false,
                isTransitive: true,
                dependencies: new Set(),
            });
        }

        const node = nodes.get(id)!;
        if (pkgData.dependencies) {
            for (const [dName, dSpec] of Object.entries(pkgData.dependencies as Record<string, string>)) {
                const dEntryKey = `${dName}@${dSpec}`;
                const dPkgData = yarnData[dEntryKey];
                if (dPkgData && dPkgData.version) {
                    node.dependencies.add(`${dName}@${dPkgData.version}`);
                }
            }
        }
    }

    for (const [entryKey, pkgData] of Object.entries(yarnData as Record<string, any>)) {
        if (pkgData.resolution === `${manifest.name}@workspace:.`) {
            if (pkgData.dependencies) {
                for (const [dName, dSpec] of Object.entries(pkgData.dependencies as Record<string, string>)) {
                    const dEntryKey = `${dName}@${dSpec}`;
                    const dPkgData = yarnData[dEntryKey];
                    if (dPkgData && dPkgData.version) {
                        rootNode.dependencies.add(`${dName}@${dPkgData.version}`);
                    }
                }
            }
            break;
        }
    }

    return finalizeGraph(nodes, rootNodeId, manifest);
}

function finalizeGraph(nodes: Map<string, DependencyNode>, rootNodeId: string, manifest: Manifest): DependencyGraph {
    const devDeps = Object.keys(manifest.devDependencies || {});
    const prodDeps = Object.keys(manifest.dependencies || {});
    const visited = new Set<string>();

    function markDev(id: string) {
        if (visited.has(id)) return;
        visited.add(id);
        const node = nodes.get(id);
        if (node) {
            node.isDev = true;
            node.dependencies.forEach(depId => markDev(depId));
        }
    }

    const rootNode = nodes.get(rootNodeId);
    if (rootNode) {
        rootNode.dependencies.forEach(depId => {
            const node = nodes.get(depId);
            if (node && devDeps.includes(node.name) && !prodDeps.includes(node.name)) {
                markDev(depId);
            }
        });
    }

    return {
        root: rootNodeId,
        nodes,
    };
}
