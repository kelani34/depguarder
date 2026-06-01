# 🛡️ DepGuarder

**Developer-first dependency security tool.** Detect malicious, suspicious, or risky packages *before* they are installed or deployed.

[![Test Status](https://github.com/kelani34/depguarder/actions/workflows/test.yml/badge.svg)](https://github.com/kelani34/depguarder/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## 🌟 Why DepGuarder?

Modern supply chain attacks don't just use known vulnerabilities (CVEs). They use **typosquatting**, **malicious install scripts**, and **obfuscated code**. Traditional scanners often miss these because they only look for "known bads."

DepGuarder is different. It focuses on **Trust Signals** and **Behavioral Analysis**:
- **Lockfile-First**: If your package manager resolved it, DepGuarder finds it—including hidden transitive dependencies.
- **Behavioral Intelligence**: Detects obfuscation, suspicious system calls, and unauthorized environment access.
- **Proactive Protection**: Audit packages *before* you install them with the `install` command.
- **Runtime Guard**: Monitor your dev server in real-time to catch malicious processes spawning from your dependencies.

---

## 🚀 Key Features

- **Multi-Ecosystem**: Native support for **npm**, **pnpm**, **Yarn (v1 & Berry)**, and **Bun**.
- **Deep Audit**: `scan --paranoid` downloads and inspects package tarballs for obfuscation.
- **Explainability**: `why <package>` traces exactly how a risky dependency entered your project.
- **Proactive Gateway**: `install <package>` audits risk before triggering the package manager.
- **Runtime Monitoring**: `run <command>` watches your entire process tree for suspicious activity (e.g., `curl`, `nc`).
- **CI/CD Ready**: Official GitHub Action for PR security auditing.

---

## 📦 Installation

```bash
# Using npm
npm install -g depguarder
npx depguarder scan
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

### 4. Proactive Install
```bash
depguarder install express
```

### 5. Secure Development
```bash
depguarder run npm run dev
```

---

## 🛡️ Security Rules

DepGuarder evaluates risk using a 0-100 scoring model based on:
- **Typosquatting**: Detection of popular package imitations.
- **Install Scripts**: Flagging potentially dangerous `postinstall` hooks.
- **Maintainer Reputation**: Identification of single-maintainer or new packages.
- **Download Trends**: Analysis of community trust signals.
- **Static Analysis**: Real-time detection of obfuscated code and sensitive API usage.

---

## 🤝 Contributing

We welcome contributions! Please see our [Development Roadmap](.internal-docs/planning.md) for current priorities.

---

## 📜 License

ISC © 2026
