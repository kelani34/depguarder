# Phase 8: Safe Install Wrapper

## Objective
Provide a proactive security layer that prevents risky packages from being installed in the first place.

## Tasks
- [x] Implement `depguarder install` command in CLI.
- [x] Implement Pre-install Audit Logic (scan dependencies before running the package manager).
- [x] Add Interactive Confirmation Prompt for projects with High/Critical findings.
- [x] Implement Argument Proxying (pass remaining arguments to `npm`, `pnpm`, or `yarn`).

## Success Criteria
- Running `depguarder install <package>` scans the potential graph and warns/blocks if risks are found.
- The command successfully delegates the actual installation to the detected package manager after approval.
