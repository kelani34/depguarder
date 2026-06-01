# DepGuarder Project Context

## Project Overview
DepGuarder is a developer-first dependency security tool designed to detect malicious, suspicious, or risky npm packages before they are installed or deployed. It focuses on "trust signals" rather than just known CVEs, aiming to answer the question: *"Can I trust this package right now?"*

The project is currently in the **Design and Planning Phase**. This directory contains the foundational documentation and architectural specifications.

## Key Files
- **[DepGuarder Intelligence Workbook v2.md](./DepGuarder%20Intelligence%20Workbook%20v2.md)**: The primary source of truth for the project. It includes:
    - Target users and core use cases.
    - Detailed system architecture and component breakdowns.
    - Risk scoring models and severity mapping.
    - Implementation roadmap and MVP scope.
    - Internal logic for dependency graph analysis and static behavior detection.

## Architectural Vision
The proposed architecture for DepGuarder includes:
- **CLI Tool:** User interface for commands like `analyze`, `audit`, and `scan`.
- **Manifest & Lockfile Parser:** Support for `package.json`, `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml`.
- **Risk Analysis Engine:** A rule-based engine that combines metadata, threat intelligence, and static code analysis.
- **Dependency Tree Builder:** Full graph traversal to identify risks in transitive dependencies (the "lockfile-first" security model).

## Development Roadmap (Planned)
1. **Phase 1: Prototype:** CLI scanner, manifest parsing, and basic scoring.
2. **Phase 2: MVP:** Lockfile support, GitHub Action integration, and typosquat detection.
3. **Phase 3: Advanced Detection:** Static code analysis, suspicious API detection, and tarball diffing.
4. **Phase 4: Team Product:** Dashboard, monitoring, and policy management.

## Usage Guidelines
- **Contextual Reference:** When implementing features, refer to the workbook for specific rule definitions (e.g., scoring weights for `postinstall` scripts).
- **Security First:** The tool must never execute untrusted code (like install scripts) during analysis; it should always use safe, static inspection.
- **Explainability:** Every finding must provide a clear path from the root application to the risky dependency to help developers understand the source of the risk.
