# Phase 10: Runtime Guard (Dev Mode)

## Objective
Detect malicious node processes or suspicious activity while running development scripts.

## Tasks
- [x] Implement `depguarder run <command>` execution wrapper.
- [x] Child process monitoring (track all sub-processes started by the dev command).
- [x] System call / Network monitoring (identify if sub-processes are making unauthorized outbound calls).
- [x] Reporting: Alert the user if a dev script starts a hidden or suspicious process.

## Success Criteria
- Running `depguarder run npm run dev` monitors the entire process tree.
- Suspicious activity (e.g., `curl` to an unknown IP from a deep dependency) is flagged to the user.
