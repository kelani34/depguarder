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
This command performs a **pre-install audit** of the **resolved dependency graph**, not just the top-level package. It evaluates the packages that would actually be installed before the package manager touches your project. If High or Critical risks are found, DepGuarder will stop and ask for your explicit confirmation.

That matters for attacks that hide in:
- newly introduced transitive dependencies
- typosquatted indirect packages
- malicious lifecycle scripts several layers below the package you asked for

## 3. Repository Preflight (`depguarder clone`)
Before cloning a repository, you can ask DepGuarder to inspect it:
```bash
depguarder clone https://github.com/example/project.git
```

For supported GitHub and GitLab repositories, DepGuarder will:
1. Attempt to detect the default branch.
2. Fetch `package.json` and a supported lockfile remotely.
3. Run a dependency audit before clone when enough metadata is available.
4. Ask for confirmation if risky dependencies are detected.
5. Clone the repository and run a full local scan afterwards.

For private repositories, set one of:
- `GITHUB_TOKEN` or `GH_TOKEN`
- `GITLAB_TOKEN` or `GL_TOKEN`

## 4. Runtime Monitoring (`depguarder run`)
Malicious code often hides in `postinstall` scripts or development dependencies. To detect these, wrap your dev commands:
```bash
depguarder run npm run dev
```
DepGuarder will monitor the entire process tree. If a dependency tries to start a hidden shell, a network tool (`curl`, `wget`), or a background process, DepGuarder will flag it in real-time.

## 5. Hardware Isolation (Coming Soon)
For the ultimate security, Phase 12 of our roadmap introduces **Zero-Trust Isolation**. This will run all behavioral analysis inside a Docker container, ensuring that even the most sophisticated malware cannot escape the sandbox to touch your host machine.

---

### Security Best Practices
*   **Audit Early**: Run `depguarder scan` after every major dependency update.
*   **Preflight New Codebases**: Run `depguarder clone` instead of `git clone` when you are evaluating an unfamiliar project.
*   **Use the PR Action**: Enable the DepGuarder GitHub Action to catch risky dependencies before they are merged.
*   **Trust but Verify**: Use `depguarder why` to understand how deep dependencies enter your project.
