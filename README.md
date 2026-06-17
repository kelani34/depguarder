# 🛡️ DepGuarder

**Developer-first dependency security tool.** Detect malicious, suspicious, or risky packages *before* they are installed or deployed.

[![Test Status](https://github.com/kelani34/depguarder/actions/workflows/test.yml/badge.svg)](https://github.com/kelani34/depguarder/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## 🌟 Why DepGuarder?

Modern supply chain attacks don't just use known vulnerabilities (CVEs). They use **typosquatting**, **malicious install scripts**, and **obfuscated code**. Traditional scanners often miss these because they only look for "known bads."

DepGuarder is different. It focuses on **Trust Signals** and **Behavioral Analysis**:
- **Lockfile-First**: If your package manager resolved it, DepGuarder finds it—including hidden transitive dependencies.
- **Behavioral Intelligence**: Detects obfuscation, suspicious system calls, TLS bypasses, hidden execution, and suspicious persistence behavior.
- **Proactive Protection**: Audit resolved dependency graphs *before* you install them with the `install` command.
- **Repository Preflight**: Probe a repository before cloning it, then run a full project scan after clone.
- **Monorepo-Aware**: Discover and audit multiple JavaScript project roots in a single repository.
- **Runtime Guard**: Monitor your dev server in real-time to catch malicious processes spawning from your dependencies.

---

## 🚀 Key Features

- **Multi-Ecosystem**: Native support for **npm**, **pnpm**, **Yarn (v1 & Berry)**, and **Bun** lockfiles.
- **Deep Audit**: `scan --paranoid` downloads and inspects package tarballs for obfuscation.
- **Explainability**: `why <package>` traces exactly how a risky dependency entered your project.
- **Proactive Gateway**: `install <package>` audits the full resolved dependency graph before triggering the package manager.
- **Pre-Clone Inspection**: `clone <repo-url>` can preflight public and private GitHub/GitLab repos before cloning.
- **Workspace Discovery**: `clone <repo-url>` can scan multiple project roots in monorepos instead of assuming repo root only.
- **Runtime Monitoring**: `run <command>` watches your entire process tree for suspicious activity (e.g., `curl`, `nc`).
- **CI/CD Ready**: Official GitHub Action for PR security auditing.

---

## 📦 Installation

```bash
# Requires Node.js >= 22.12.0
npm install -g depguarder
```

```bash
# One-off usage
npx depguarder scan
```

```bash
# Global install with Bun
bun add -g depguarder
```

---

## 🛠️ Usage

### 1. Scan your project
```bash
depguarder scan
```

### 2. Deep behavioral analysis (Paranoid Mode)
```bash
depguarder scan --paranoid
```

### 3. Trace a dependency
```bash
depguarder why lodash
```

### 4. Explain a risky package
```bash
depguarder explain easy-day-js --paranoid
```

### 5. Proactive Install
```bash
depguarder install express
```

### 6. Pre-clone a repository, then scan it
```bash
depguarder clone https://github.com/example/project.git
```

```bash
depguarder clone git@github.com:example/project.git project-local
```

If the repository is a monorepo, DepGuarder will:
- discover each directory containing a `package.json`
- look for a supported lockfile in the same directory
- preflight every resolvable project path before clone
- run per-project scans after clone

### 7. Secure Development
```bash
depguarder run npm run dev
```

---

## 🔐 Private Repository Preflight

`depguarder clone` can inspect private repositories before clone for:
- **GitHub** using `GITHUB_TOKEN` or `GH_TOKEN`
- **GitLab** using `GITLAB_TOKEN` or `GL_TOKEN`

Examples:

```bash
export GITHUB_TOKEN=ghp_xxx
depguarder clone https://github.com/your-org/private-repo.git
```

```bash
export GITLAB_TOKEN=glpat-xxx
depguarder clone https://gitlab.com/your-group/private-repo.git
```

Notes:
- HTTPS clone URLs can reuse the token for authenticated `git clone`.
- SSH clone URLs continue to use your existing SSH credentials, but the preflight dependency fetch still uses the provider token when needed.
- If no supported lockfile is available for a discovered project path, DepGuarder will warn for that project and fall back to local post-clone scanning where possible.
- For monorepos, preflight results are reported per project path, not just once for the repository root.

---

## 🛡️ Security Rules

DepGuarder evaluates risk using a 0-100 scoring model based on:
- **Typosquatting**: Dynamic detection of suspicious package names using ecosystem similarity signals.
- **Install Scripts**: Flagging lifecycle scripts and suspicious script contents before install.
- **Maintainer Reputation**: Identification of single-maintainer packages.
- **Fresh Releases**: Warning on newly published releases and very new packages.
- **Download Trends**: Analysis of community trust signals.
- **Static Analysis**: Detection of obfuscated code, suspicious APIs, env access, TLS bypass, hidden execution, remote IP usage, and self-delete patterns.

---

## 🤝 Contributing

We welcome contributions. Open an issue or pull request with the change you want to make and include test coverage when you add parser or rule logic.

---

## 📜 License

ISC © 2026
