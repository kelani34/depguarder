# Phase 1: Foundation

## Objective
Establish the project structure and build the basic CLI shell to parse top-level dependencies.

## Tasks
- [x] Initialize NPM Monorepo
- [x] Set up TypeScript configuration
- [x] Implement CLI entry point using `commander`
- [x] Create `package.json` parser
- [x] Implement `depguarder analyze` command (Basic manifest scan)

## Success Criteria
- `depguarder --version` returns the version.
- `depguarder analyze` reads `package.json` and lists direct dependencies.
