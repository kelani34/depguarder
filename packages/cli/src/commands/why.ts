import { parseManifest, buildGraph } from '@depguarder/core';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadLockfile } from '../lockfile-helper.js';

export async function whyCommand(packageName: string) {
  try {
    const manifestPath = join(process.cwd(), 'package.json');
    if (!existsSync(manifestPath)) {
      throw new Error('package.json not found.');
    }

    const manifest = parseManifest(manifestPath);
    const { type, data: lockfileData } = loadLockfile(process.cwd());
    const graph = buildGraph(type === 'npm' ? lockfileData.packages : lockfileData, manifest, type);

    console.log(`\n🤔 Finding paths to ${packageName}...`);

    const rootId = `${manifest.name}@${manifest.version}`;
    const paths: string[][] = [];

    function findPaths(currentId: string, targetName: string, currentPath: string[], visited: Set<string>) {
      const node = graph.nodes.get(currentId);
      if (!node) return;

      if (node.name === targetName) {
        paths.push([...currentPath, currentId]);
        return;
      }

      if (visited.has(currentId)) return;
      visited.add(currentId);

      for (const depId of node.dependencies) {
        findPaths(depId, targetName, [...currentPath, currentId], new Set(visited));
      }
    }

    findPaths(rootId, packageName, [], new Set());

    if (paths.length === 0) {
      console.log(`\n❌ Package ${packageName} not found in dependency graph.`);
    } else {
      console.log(`\nFound ${paths.length} path(s):`);
      paths.forEach((path, index) => {
        console.log(`\nPath ${index + 1}:`);
        console.log(path.join(' ➔ '));
      });
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}
