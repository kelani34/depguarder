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

type ProviderKind = 'github' | 'gitlab';

interface HostedRepository {
  kind: ProviderKind;
  repoUrl: string;
  defaultBranchUrl(): string;
  fileUrl(branch: string, path: string): string;
  authHeaders(token?: string): Record<string, string>;
  gitCloneArgs(token?: string): string[];
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

  const branch = await detectDefaultBranch(provider);
  if (!branch) {
    return { warning: 'Could not determine the default branch for remote inspection.' };
  }

  const token = getProviderToken(provider.kind);
  const manifestContent = await fetchText(provider.fileUrl(branch, 'package.json'), provider.authHeaders(token));
  if (!manifestContent) {
    return { warning: 'No package.json found at repository root, so no JavaScript dependency pre-scan was possible.' };
  }

  const manifest = parseManifestContent(manifestContent);
  const remoteFiles = await fetchRemoteLockfiles(provider, branch, token);
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

async function fetchRemoteLockfiles(provider: HostedRepository, branch: string, token?: string): Promise<RemoteProjectFiles> {
  const files: RemoteProjectFiles = {};
  for (const path of ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock'] as const) {
    const content = await fetchText(provider.fileUrl(branch, path), provider.authHeaders(token));
    if (content) {
      files[path] = content;
      break;
    }
  }
  return files;
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'depguarder', ...headers }
  });

  if (response.status === 404) return null;
  if (response.status === 403) {
    throw new Error(`Access denied while fetching ${url}. Set the matching provider token in your environment for private repositories.`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseHostedRepository(repoUrl: string): HostedRepository | null {
  const githubHttps = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubHttps) {
    const [, owner, repo] = githubHttps;
    return {
      kind: 'github',
      repoUrl,
      defaultBranchUrl: () => `https://api.github.com/repos/${owner}/${repo}`,
      fileUrl: (branch, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
      authHeaders: (token) => ({
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/vnd.github.raw+json',
      }),
      gitCloneArgs: (token) => buildHttpsCloneArgs(repoUrl, token ? basicAuthHeaderValue('x-access-token', token) : undefined),
    };
  }

  const githubSsh = repoUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (githubSsh) {
    const [, owner, repo] = githubSsh;
    return {
      kind: 'github',
      repoUrl,
      defaultBranchUrl: () => `https://api.github.com/repos/${owner}/${repo}`,
      fileUrl: (branch, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
      authHeaders: (token) => ({
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/vnd.github.raw+json',
      }),
      gitCloneArgs: () => ['clone', repoUrl],
    };
  }

  const gitlabHttps = repoUrl.match(/^https:\/\/gitlab\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (gitlabHttps) {
    const [, owner, repo] = gitlabHttps;
    const projectPath = `${owner}/${repo}`;
    return {
      kind: 'gitlab',
      repoUrl,
      defaultBranchUrl: () => `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}`,
      fileUrl: (branch, path) => `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`,
      authHeaders: (token) => bearerHeaders(token),
      gitCloneArgs: (token) => buildHttpsCloneArgs(repoUrl, token ? basicAuthHeaderValue('oauth2', token) : undefined),
    };
  }

  const gitlabSsh = repoUrl.match(/^git@gitlab\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (gitlabSsh) {
    const [, owner, repo] = gitlabSsh;
    const projectPath = `${owner}/${repo}`;
    return {
      kind: 'gitlab',
      repoUrl,
      defaultBranchUrl: () => `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}`,
      fileUrl: (branch, path) => `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(branch)}`,
      authHeaders: (token) => bearerHeaders(token),
      gitCloneArgs: () => ['clone', repoUrl],
    };
  }

  return null;
}

async function detectDefaultBranch(provider: HostedRepository): Promise<string | null> {
  const token = getProviderToken(provider.kind);

  try {
    const response = await fetch(provider.defaultBranchUrl(), {
      headers: {
        'User-Agent': 'depguarder',
        ...provider.authHeaders(token),
      },
    });

    if (response.ok) {
      const payload = await response.json() as any;
      return payload.default_branch || null;
    }
  } catch {
    // Fall back to git below.
  }

  try {
    const output = execFileSync('git', gitLsRemoteArgs(provider, token), { encoding: 'utf8' });
    const match = output.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function runGitClone(repoUrl: string, targetDirectory: string) {
  const provider = parseHostedRepository(repoUrl);
  const token = provider ? getProviderToken(provider.kind) : undefined;
  const cloneArgs = provider ? provider.gitCloneArgs(token) : ['clone', repoUrl];

  await new Promise<void>((resolvePromise, reject) => {
    const args = [...cloneArgs];
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

function getProviderToken(kind: ProviderKind): string | undefined {
  if (kind === 'github') {
    return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  }
  return process.env.GITLAB_TOKEN || process.env.GL_TOKEN;
}

function basicAuthHeaderValue(username: string, token: string): string {
  return `AUTHORIZATION: basic ${Buffer.from(`${username}:${token}`).toString('base64')}`;
}

function buildHttpsCloneArgs(repoUrl: string, extraHeader?: string): string[] {
  if (!extraHeader) {
    return ['clone', repoUrl];
  }
  return ['-c', `http.extraHeader=${extraHeader}`, 'clone', repoUrl];
}

function gitLsRemoteArgs(provider: HostedRepository, token?: string): string[] {
  const extraHeader = token && provider.repoUrl.startsWith('https://')
    ? provider.kind === 'github'
      ? basicAuthHeaderValue('x-access-token', token)
      : basicAuthHeaderValue('oauth2', token)
    : undefined;

  if (!extraHeader) {
    return ['ls-remote', '--symref', provider.repoUrl, 'HEAD'];
  }

  return ['-c', `http.extraHeader=${extraHeader}`, 'ls-remote', '--symref', provider.repoUrl, 'HEAD'];
}

function bearerHeaders(token?: string): Record<string, string> {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}
