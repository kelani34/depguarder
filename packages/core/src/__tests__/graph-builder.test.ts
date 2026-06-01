import { describe, it, expect } from 'vitest';
import { buildGraph } from '../graph-builder.js';

describe('GraphBuilder', () => {
  const mockManifest = {
    name: 'root',
    version: '1.0.0',
    dependencies: { 'a': '1.0.0' },
    devDependencies: { 'b': '1.0.0' }
  };

  const mockLockfile = {
    '': { name: 'root', version: '1.0.0', dependencies: { 'a': '1.0.0' }, devDependencies: { 'b': '1.0.0' } },
    'node_modules/a': { version: '1.0.0', dependencies: { 'c': '1.0.0' } },
    'node_modules/b': { version: '1.0.0' },
    'node_modules/c': { version: '1.0.0' }
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
});
