export function buildGraph(lockfile, manifest) {
    const nodes = new Map();
    const rootNodeId = `${manifest.name}@${manifest.version || '0.0.0'}`;
    nodes.set(rootNodeId, {
        name: manifest.name,
        version: manifest.version || '0.0.0',
        isDev: false,
        isTransitive: false,
        dependencies: new Set(),
    });
    const rootNode = nodes.get(rootNodeId);
    const directDeps = {
        ...(manifest.dependencies || {}),
        ...(manifest.devDependencies || {}),
        ...(manifest.optionalDependencies || {}),
        ...(manifest.peerDependencies || {}),
        ...lockfile.root.dependencies,
        ...lockfile.root.devDependencies,
        ...lockfile.root.optionalDependencies,
        ...lockfile.root.peerDependencies,
    };
    for (const [depName, depInfo] of Object.entries(directDeps)) {
        const resolvedId = resolvePackageId(lockfile, depName, String(depInfo));
        if (resolvedId) {
            rootNode.dependencies.add(resolvedId);
        }
    }
    for (const pkg of lockfile.packages.values()) {
        const id = pkg.id;
        if (!nodes.has(id)) {
            nodes.set(id, {
                name: pkg.name,
                version: pkg.version,
                resolved: pkg.resolved,
                integrity: pkg.integrity,
                isDev: false,
                isTransitive: !pkg.isWorkspace,
                dependencies: new Set(),
            });
        }
        const node = nodes.get(id);
        for (const [depName, depRef] of Object.entries({
            ...pkg.dependencies,
            ...pkg.optionalDependencies,
        })) {
            const resolvedId = resolvePackageId(lockfile, depName, depRef);
            if (resolvedId) {
                node.dependencies.add(resolvedId);
            }
        }
    }
    return finalizeGraph(nodes, rootNodeId, manifest);
}
function resolvePackageId(lockfile, name, reference) {
    const exactId = `${name}@${reference}`;
    if (lockfile.packages.has(exactId)) {
        return exactId;
    }
    const candidates = Array.from(lockfile.packages.values()).filter((pkg) => pkg.name === name);
    if (candidates.length === 0)
        return null;
    if (candidates.length === 1)
        return candidates[0].id;
    const exactVersion = candidates.find((pkg) => pkg.version === reference);
    if (exactVersion)
        return exactVersion.id;
    const byResolved = candidates.find((pkg) => pkg.resolved === reference || pkg.resolved === `${name}@${reference}`);
    if (byResolved)
        return byResolved.id;
    const normalizedReference = reference.replace(/^npm:/, '');
    const bySuffix = candidates.find((pkg) => pkg.id === `${name}@${normalizedReference}` ||
        pkg.version === normalizedReference);
    if (bySuffix)
        return bySuffix.id;
    return candidates[0].id;
}
function finalizeGraph(nodes, rootNodeId, manifest) {
    const devDeps = Object.keys(manifest.devDependencies || {});
    const prodDeps = Object.keys(manifest.dependencies || {});
    const visited = new Set();
    function markDev(id) {
        if (visited.has(id))
            return;
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
//# sourceMappingURL=graph-builder.js.map