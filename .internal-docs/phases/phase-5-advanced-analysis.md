# Phase 5: Advanced Analysis

## Objective
Deep-dive inspection of package contents to detect hidden or obfuscated threats.

## Tasks
- [x] Tarball Downloader (Download safely to tmp)
- [x] Safe unpacker (no execution)
- [x] Static analyzer (Regex/AST-based) for:
    - [x] Obfuscated code
    - [x] Sensitive API usage (fs, net, child_process)
    - [x] Environment variable access

## Success Criteria
- `depguarder scan --paranoid` identifies packages using suspicious APIs or obfuscation.
