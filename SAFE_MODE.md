# 🛡️ DepGuarder Safe Mode Guide

DepGuarder is designed to be safe by default. This guide explains how DepGuarder protects your machine and how you can maximize your security when auditing untrusted packages.

## 1. Safe Tarball Inspection
When you run `depguarder scan --paranoid`, DepGuarder:
1.  Downloads the package tarball from the NPM registry.
2.  Extracts it into a temporary directory using `pacote.extract`.
3.  **Crucially**, it never executes any code within the tarball. It only performs static analysis (regex pattern matching) on the text files.
4.  Once the analysis is complete, the temporary directory is immediately deleted.

## 2. Proactive Installation (`depguarder install`)
Instead of running `npm install <package>`, use:
```bash
depguarder install <package>
```
This command performs a **pre-install audit**. It fetches the package metadata and evaluates its risk score *before* the package manager touches your project. If the score is High or Critical, DepGuarder will block the installation and ask for your explicit confirmation.

## 3. Runtime Monitoring (`depguarder run`)
Malicious code often hides in `postinstall` scripts or development dependencies. To detect these, wrap your dev commands:
```bash
depguarder run npm run dev
```
DepGuarder will monitor the entire process tree. If a dependency tries to start a hidden shell, a network tool (`curl`, `wget`), or a background process, DepGuarder will flag it in real-time.

## 4. Hardware Isolation (Coming Soon)
For the ultimate security, Phase 12 of our roadmap introduces **Zero-Trust Isolation**. This will run all behavioral analysis inside a Docker container, ensuring that even the most sophisticated malware cannot escape the sandbox to touch your host machine.

---

### Security Best Practices
*   **Audit Early**: Run `depguarder scan` after every major dependency update.
*   **Use the PR Action**: Enable the DepGuarder GitHub Action to catch risky dependencies before they are merged.
*   **Trust but Verify**: Use `depguarder why` to understand how deep dependencies enter your project.
