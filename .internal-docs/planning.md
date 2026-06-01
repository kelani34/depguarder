# DepGuarder: Implementation Roadmap

## Project Vision
DepGuarder is a "lockfile-first" security tool that evaluates dependency risk using trust signals, metadata, and static analysis.

## Technical Stack
- **Runtime:** Node.js (v18+)
- **Language:** TypeScript
- **Frameworks:**
  - `commander` (CLI)
  - `pacote` (NPM metadata & fetching)
  - `zod` (Schema validation)
- **Structure:** NPM Monorepo

## Master Task Tracker

- [x] **Phase 1: Foundation**
  - [x] Monorepo & Project Initialization
  - [x] CLI Shell (`depguarder` command)
  - [x] Manifest Parser (`package.json`)
- [x] **Phase 2: Graph Engine**
  - [x] Lockfile Parser (package-lock.json)
  - [x] Dependency Tree Builder
  - [x] Transitive Dependency Resolution
- [x] **Phase 3: Risk Rules & Scoring**
  - [x] Metadata Collector (NPM Registry API)
  - [x] Rule Engine (Initial Rules: postinstall, new package, typosquat)
  - [x] Risk Scoring Model (0-100)
- [x] **Phase 4: Reporting & CI**
  - [x] Explainable Report Generator
  - [x] JSON/SARIF Output
  - [x] GitHub Action Integration
- [x] **Phase 5: Advanced Analysis**
  - [x] Static Behavior Analyzer
  - [x] Tarball Downloader (Safe Mode)
  - [x] Suspicious API Detection
- [x] **Phase 6: Ecosystem Expansion**
  - [x] pnpm-lock.yaml Parser
  - [x] yarn.lock Parser (v1 & Berry)
  - [x] Multi-lockfile auto-detection
- [x] **Phase 7: Detection Hardening**
  - [x] Maintainer Reputation Rule
  - [x] Download Trends Rule (NPM Downloads API)
  - [x] Missing Source Repository Rule
- [x] **Phase 8: Safe Install Wrapper**
  - [x] `depguarder install` CLI command
  - [x] Pre-install audit logic
  - [x] Interactive confirmation for high-risk findings
  - [x] Package manager proxying
- [x] **Phase 9: Bun Ecosystem Support**
  - [x] `bun.lockb` Parser
  - [x] Bun workspace support
  - [x] Auto-detection for Bun projects
- [x] **Phase 10: Runtime Guard (Dev Mode)**
  - [x] `depguarder run <command>` execution wrapper
  - [x] Child process monitoring (pid, command, network)
  - [x] Reporting suspicious runtime activity
- [x] **Phase 11: Launch Readiness**
  - [x] Professional `README.md`
  - [x] `depguarder init` command
  - [x] Preparation for NPM publishing
- [x] **Phase 12: Zero-Trust Isolation (Sandbox)**
  - [x] Docker-based analysis runner
  - [x] Safe volume mounting for tarballs
  - [x] Host-to-Container communication for findings

## Usage
Refer to the `phases/` directory for detailed requirements and tasks for each stage.
