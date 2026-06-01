# Phase 6: Ecosystem Expansion

## Objective
Extend DepGuarder's reach by supporting the most popular lockfile formats beyond `package-lock.json`.

## Tasks
- [x] pnpm-lock.yaml Parser
- [x] yarn.lock Parser (v1)
- [x] yarn.lock Parser (v2/v3 Berry)
- [x] Implement Lockfile Auto-detection in CLI
- [x] Verify graph construction with pnpm and yarn samples

## Success Criteria
- `depguarder scan` automatically detects the lockfile present in the repository.
- Dependency graphs for pnpm and Yarn projects are accurately built.
- `depguarder why` and `depguarder explain` work seamlessly across all supported ecosystems.
