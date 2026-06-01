# Phase 2: Graph Engine

## Objective
Move beyond the manifest to understand the full dependency tree resolved by the package manager.

## Tasks
- [x] Build `package-lock.json` parser
- [x] Implement Dependency Graph Builder (Nodes & Edges)
- [x] Support transitive dependency resolution
- [x] Implement `depguarder why <package>` to show paths to dependencies

## Success Criteria
- `depguarder scan` builds a graph of all resolved packages.
- `depguarder why` correctly displays the path from the root project to a specific transitive dependency.
