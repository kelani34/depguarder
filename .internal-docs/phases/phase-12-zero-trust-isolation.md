# Phase 12: Zero-Trust Isolation (Sandbox)

## Objective
Eliminate the risk of host infection during deep behavioral analysis by isolating the analysis engine within a Docker container.

## Tasks
- [x] Create a `depguarder-sandbox` Docker image.
- [x] Implement Docker runner logic in `@depguarder/core`.
- [x] Safe volume mounting: Mount temporary tarball directories as read-only to the container.
- [x] Capture and stream container output/findings back to the host CLI.

## Success Criteria
- Running `depguarder scan --paranoid` uses Docker if available.
- Malicious code in a dependency is unable to access host environment variables or files during analysis.
