# Phase 7: Detection Hardening

## Objective
Improve the accuracy and depth of the risk scoring engine by adding more sophisticated data signals from the NPM ecosystem.

## Tasks
- [x] Maintainer Reputation Rule: Flag packages with new maintainers or recent maintainer changes.
- [x] Download Trends Rule: Fetch data from NPM Downloads API and flag packages with unusually low usage for their age.
- [x] Missing Source Repository Rule: Flag packages that do not link to a public repository (GitHub/GitLab).
- [x] Verify hardening with updated `explain` command output.

## Success Criteria
- The "Trust Score" correctly reflects the package's reputation and usage context.
- Newly discovered risks are clearly explained in the CLI and JSON reports.
