# Phase 3: Risk Rules & Scoring

## Objective
Implement the intelligence layer that evaluates packages based on behavioral and metadata signals.

## Tasks
- [x] Metadata Collector (Fetch data from NPM registry)
- [x] Rule Engine core (Condition-based findings)
- [x] Implement Initial Rules:
    - [x] `postinstall-script`
    - [x] `new-package`
    - [x] `typosquat-detection`
- [x] Risk Scoring System (0-100 calculation)

## Success Criteria
- Engine generates findings for a given package metadata.
- Total risk score accurately reflects the sum of finding impacts.
