import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph-builder.js';
import { CanonicalLockfile } from '../lockfile.js';

describe('GraphBuilder', () => {
  const mockManifest = {
    name: 'root',
    version: '1.0.0',
    dependencies: { 'a': '1.0.0' },
    devDependencies: { 'b': '1.0.0' }
  };

  const mockLockfile: CanonicalLockfile = {
    manager: 'npm',
    root: {
      name: 'root',
      version: '1.0.0',
      dependencies: { a: '1.0.0' },
      devDependencies: { b: '1.0.0' },
      optionalDependencies: {},
      peerDependencies: {},
    },
    packages: new Map([
      ['a@1.0.0', { id: 'a@1.0.0', name: 'a', version: '1.0.0', dependencies: { c: '1.0.0' } as Record<string, string>, optionalDependencies: {} as Record<string, string> }],
      ['b@1.0.0', { id: 'b@1.0.0', name: 'b', version: '1.0.0', dependencies: {} as Record<string, string>, optionalDependencies: {} as Record<string, string> }],
      ['c@1.0.0', { id: 'c@1.0.0', name: 'c', version: '1.0.0', dependencies: {} as Record<string, string>, optionalDependencies: {} as Record<string, string> }],
    ]),
  };

  it('should build a graph with correct nodes', () => {
    const graph = buildGraph(mockLockfile, mockManifest as any);
    expect(graph.nodes.has('root@1.0.0')).toBe(true);
    expect(graph.nodes.has('a@1.0.0')).toBe(true);
    expect(graph.nodes.has('b@1.0.0')).toBe(true);
    expect(graph.nodes.has('c@1.0.0')).toBe(true);
  });

  it('should correctly identify transitive dependencies', () => {
    const graph = buildGraph(mockLockfile, mockManifest as any);
    const nodeC = graph.nodes.get('c@1.0.0');
    expect(nodeC?.isTransitive).toBe(true);
  });

  it('should correctly mark dev dependencies', () => {
    const graph = buildGraph(mockLockfile, mockManifest as any);
    const nodeB = graph.nodes.get('b@1.0.0');
    expect(nodeB?.isDev).toBe(true);
  });

  it('should build a graph from Bun lockfile data', () => {
    const mockBunData: CanonicalLockfile = {
      manager: 'bun',
      root: {
        name: 'bun-app',
        version: '1.0.0',
        dependencies: { lodash: '^4.18.1' },
        devDependencies: {},
        optionalDependencies: {},
        peerDependencies: {},
      },
      packages: new Map([
        ['lodash@4.18.1', { id: 'lodash@4.18.1', name: 'lodash', version: '4.18.1', dependencies: {} as Record<string, string>, optionalDependencies: {} as Record<string, string>, resolved: 'lodash@^4.18.1' }]
      ]),
    };
    const mockBunManifest = { 
      name: 'bun-app', 
      version: '1.0.0',
      dependencies: { 'lodash': '^4.18.1' }
    };
    
    const graph = buildGraph(mockBunData, mockBunManifest as any);
    expect(graph.nodes.has('bun-app@1.0.0')).toBe(true);
    expect(graph.nodes.has('lodash@4.18.1')).toBe(true);
    expect(graph.nodes.get('bun-app@1.0.0')?.dependencies.has('lodash@4.18.1')).toBe(true);
  });

  it('should build a graph from Yarn v1 lockfile data', () => {
    const mockYarnData: CanonicalLockfile = {
      manager: 'yarn',
      root: {
        name: 'yarn-app',
        version: '1.0.0',
        dependencies: { lodash: '^4.18.1' },
        devDependencies: {},
        optionalDependencies: {},
        peerDependencies: {},
      },
      packages: new Map([
        ['lodash@4.18.1', { id: 'lodash@4.18.1', name: 'lodash', version: '4.18.1', dependencies: {} as Record<string, string>, optionalDependencies: {} as Record<string, string>, resolved: 'lodash@^4.18.1' }]
      ]),
    };
    const mockYarnManifest = { 
      name: 'yarn-app', 
      version: '1.0.0',
      dependencies: { 'lodash': '^4.18.1' }
    };
    
    const graph = buildGraph(mockYarnData, mockYarnManifest as any);
    expect(graph.nodes.has('yarn-app@1.0.0')).toBe(true);
    expect(graph.nodes.has('lodash@4.18.1')).toBe(true);
    expect(graph.nodes.get('yarn-app@1.0.0')?.dependencies.has('lodash@4.18.1')).toBe(true);
  });
});
