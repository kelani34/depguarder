import { execFileSync, spawn } from 'child_process';
import inquirer from 'inquirer';
import { resolve } from 'path';
import { Manifest, parseManifestContent } from '@depguarder/core';
import { auditProjectDirectory, auditResolvedProject, printAuditReport } from '../project-audit.js';
import { loadLockfileFromFiles, RemoteProjectFiles } from '../lockfile-helper.js';

interface CloneOptions {
  paranoid?: boolean;
}

interface RemoteProbeResult {
  branch?: string;
  manifest?: Manifest;
  lockfileType?: string;
  audit?: Awaited<ReturnType<typeof auditResolvedProject>>;
  warning?: string;
}

export async function cloneCommand(repoUrl: string, directory?: string, options: CloneOptions = {}) {
  try {
    console.log(`\n🛰️ Probing ${repoUrl} before clone...`);
    const probe = await probeRemoteRepository(repoUrl, options);

    let proceed = true;
    if (probe.audit) {
      console.log(`\nPre-clone dependency audit (${probe.lockfileType}${probe.branch ? `, branch ${probe.branch}` : ''})`);
      printAuditReport(probe.audit);

      const riskyCount = probe.audit.reports.filter((report) => report.severity === 'critical' || report.severity === 'high').length;
      if (riskyCount > 0) {
        ({ proceed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: `Pre-clone audit found ${riskyCount} HIGH/CRITICAL risk(s). Clone anyway?`,
          default: false,
        }]));
      }
    } else {
      console.log(`\n⚠️ ${probe.warning || 'Pre-clone dependency inspection was not available for this repository.'}`);
      ({ proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Clone repository and run a local scan after clone?',
        default: true,
      }]));
    }

    if (!proceed) {
      console.log('\n❌ Clone aborted by user.');
      process.exit(0);
    }

    const targetDirectory = directory || deriveCloneDirectory(repoUrl);
    await runGitClone(repoUrl, targetDirectory);

    console.log(`\n🔎 Running full project scan in ${targetDirectory}...`);
    const result = await auditProjectDirectory(resolve(process.cwd(), targetDirectory), options);
    printAuditReport(result);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function probeRemoteRepository(repoUrl: string, options: CloneOptions): Promise<RemoteProbeResult> {
  const provider = parseHostedRepository(repoUrl);
  if (!provider) {
    return { warning: 'Remote pre-clone inspection currently supports GitHub and GitLab HTTPS/SSH URLs.' };
  }

  const branch = detectDefaultBranch(repoUrl);
  if (!branch) {
    return { warning: 'Could not determine the default branch for remote inspection.' };
  }

  const manifestContent = await fetchText(provider.rawUrl(branch, 'package.json'));
  if (!manifestContent) {
    return { warning: 'No package.json found at repository root, so no JavaScript dependency pre-scan was possible.' };
  }

  const manifest = parseManifestContent(manifestContent);
  const remoteFiles = await fetchRemoteLockfiles(provider, branch);
  const availableLockfile = Object.keys(remoteFiles)[0] as keyof RemoteProjectFiles | undefined;

  if (!availableLockfile) {
    return {
      branch,
      manifest,
      warning: 'No supported lockfile was found remotely. Full dependency graph scanning will run after clone instead.',
    };
  }

  let loaded;
  try {
    loaded = loadLockfileFromFiles(remoteFiles);
  } catch (error: any) {
    return {
      branch,
      manifest,
      warning: error.message,
    };
  }

  const audit = await auditResolvedProject(manifest, loaded.type, loaded.data, options);
  return {
    branch,
    manifest,
    lockfileType: availableLockfile,
    audit,
  };
}

async function fetchRemoteLockfiles(provider: HostedRepository, branch: string): Promise<RemoteProjectFiles> {
  const files: RemoteProjectFiles = {};
  for (const path of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock'] as const) {
    const content = await fetchText(provider.rawUrl(branch, path));
    if (content) {
      files[path] = content;
      break;
    }
  }
  return files;
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'depguarder' }
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

interface HostedRepository {
  rawUrl(branch: string, path: string): string;
}

function parseHostedRepository(repoUrl: string): HostedRepository | null {
  const githubHttps = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubHttps) {
    const [, owner, repo] = githubHttps;
    return {
      rawUrl: (branch, path) => `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`,
    };
  }

  const githubSsh = repoUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (githubSsh) {
    const [, owner, repo] = githubSsh;
    return {
      rawUrl: (branch, path) => `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`,
    };
  }

  const gitlabHttps = repoUrl.match(/^https:\/\/gitlab\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (gitlabHttps) {
    const [, owner, repo] = gitlabHttps;
    return {
      rawUrl: (branch, path) => `https://gitlab.com/${owner}/${repo}/-/raw/${encodeURIComponent(branch)}/${path}`,
    };
  }

  const gitlabSsh = repoUrl.match(/^git@gitlab\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (gitlabSsh) {
    const [, owner, repo] = gitlabSsh;
    return {
      rawUrl: (branch, path) => `https://gitlab.com/${owner}/${repo}/-/raw/${encodeURIComponent(branch)}/${path}`,
    };
  }

  return null;
}

function detectDefaultBranch(repoUrl: string): string | null {
  try {
    const output = execFileSync('git', ['ls-remote', '--symref', repoUrl, 'HEAD'], { encoding: 'utf8' });
    const match = output.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function runGitClone(repoUrl: string, targetDirectory: string) {
  await new Promise<void>((resolvePromise, reject) => {
    const args = ['clone', repoUrl];
    if (targetDirectory) {
      args.push(targetDirectory);
    }

    const child = spawn('git', args, { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`git clone exited with code ${code}`));
    });
  });
}

function deriveCloneDirectory(repoUrl: string): string {
  const normalized = repoUrl.replace(/\/+$/, '');
  const lastSegment = normalized.split('/').pop() || 'repository';
  return lastSegment.replace(/\.git$/, '');
}
