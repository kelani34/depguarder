import { execFileSync, spawn } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import inquirer from 'inquirer';
import { dirname, join, posix, relative, resolve } from 'path';
import { Manifest, parseManifestContent } from '@depguarder/core';
import { auditProjectDirectory, auditResolvedProject, printAuditReport } from '../project-audit.js';
import { loadLockfile, loadLockfileFromFiles, RemoteProjectFiles } from '../lockfile-helper.js';

interface CloneOptions {
  paranoid?: boolean;
}

interface ProjectProbe {
  path: string;
  manifest?: Manifest;
  lockfileType?: string;
  audit?: Awaited<ReturnType<typeof auditResolvedProject>>;
  warning?: string;
}

interface RemoteProbeResult {
  branch?: string;
  projects: ProjectProbe[];
  warning?: string;
}

type ProviderKind = 'github' | 'gitlab';

interface HostedRepository {
  kind: ProviderKind;
  repoUrl: string;
  defaultBranchUrl(): string;
  fileUrl(branch: string, path: string): string;
  apiHeaders(token?: string): Record<string, string>;
  authHeaders(token?: string): Record<string, string>;
  gitCloneArgs(token?: string): string[];
}

const LOCKFILE_NAMES = ['bun.lock', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'] as const;

export async function cloneCommand(repoUrl: string, directory?: string, options: CloneOptions = {}) {
  try {
    console.log(`\n🛰️ Probing ${repoUrl} before clone...`);
    const probe = await probeRemoteRepository(repoUrl, options);

    let proceed = true;
    const auditedProjects = probe.projects.filter((project) => project.audit);
    if (auditedProjects.length > 0) {
      console.log(`\nPre-clone dependency audit${probe.branch ? ` (branch ${probe.branch})` : ''}`);
      for (const project of auditedProjects) {
        console.log(`\nProject: ${project.path} (${project.lockfileType})`);
        printAuditReport(project.audit!);
      }

      const riskyCount = auditedProjects.reduce((count, project) => {
        return count + project.audit!.reports.filter((report) => report.severity === 'critical' || report.severity === 'high').length;
      }, 0);

      const warnings = probe.projects.filter((project) => project.warning);
      for (const warning of warnings) {
        console.log(`\n⚠️ ${warning.path}: ${warning.warning}`);
      }

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
    await auditClonedRepository(resolve(process.cwd(), targetDirectory), options);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function probeRemoteRepository(repoUrl: string, options: CloneOptions): Promise<RemoteProbeResult> {
  const provider = parseHostedRepository(repoUrl);
  if (!provider) {
    return {
      projects: [],
      warning: 'Remote pre-clone inspection currently supports GitHub and GitLab HTTPS/SSH URLs.',
    };
  }

  const branch = await detectDefaultBranch(provider);
  if (!branch) {
    return {
      projects: [],
      warning: 'Could not determine the default branch for remote inspection.',
    };
  }

  const token = getProviderToken(provider.kind);
  const repositoryFiles = await listRepositoryFiles(provider, branch, token);
  const candidates = discoverRemoteProjectCandidates(repositoryFiles);

  if (candidates.length === 0) {
    return {
      branch,
      projects: [],
      warning: 'No package.json files were found remotely, so no JavaScript dependency pre-scan was possible.',
    };
  }

  const projects: ProjectProbe[] = [];
  for (const candidate of candidates) {
    const manifestContent = await fetchText(provider.fileUrl(branch, joinPosix(candidate.path, 'package.json')), provider.authHeaders(token));
    if (!manifestContent) {
      projects.push({
        path: candidate.path,
        warning: 'package.json could not be fetched remotely.',
      });
      continue;
    }

    const manifest = parseManifestContent(manifestContent);
    if (!candidate.lockfileName) {
      projects.push({
        path: candidate.path,
        manifest,
        warning: 'No supported lockfile was found in this project directory. Full dependency graph scanning will run after clone instead.',
      });
      continue;
    }

    const lockfileContent = await fetchText(provider.fileUrl(branch, joinPosix(candidate.path, candidate.lockfileName)), provider.authHeaders(token));
    if (!lockfileContent) {
      projects.push({
        path: candidate.path,
        manifest,
        warning: `${candidate.lockfileName} could not be fetched remotely.`,
      });
      continue;
    }

    const remoteFiles: RemoteProjectFiles = { [candidate.lockfileName]: lockfileContent };
    try {
      const loaded = loadLockfileFromFiles(remoteFiles);
      const audit = await auditResolvedProject(manifest, loaded.type, loaded.data, options);
      projects.push({
        path: candidate.path,
        manifest,
        lockfileType: candidate.lockfileName,
        audit,
      });
    } catch (error: any) {
      projects.push({
        path: candidate.path,
        manifest,
        lockfileType: candidate.lockfileName,
        warning: error.message,
      });
    }
  }

  return { branch, projects };
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

async function listRepositoryFiles(provider: HostedRepository, branch: string, token?: string): Promise<string[]> {
  if (provider.kind === 'github') {
    const response = await fetch(`${provider.defaultBranchUrl()}/git/trees/${encodeURIComponent(branch)}?recursive=1`, {
      headers: {
        'User-Agent': 'depguarder',
        ...provider.apiHeaders(token),
      },
    });

    if (response.status === 403) {
      throw new Error('Access denied while listing repository files. Set the matching provider token in your environment for private repositories.');
    }
    if (!response.ok) {
      throw new Error(`Failed to list repository files: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as { tree?: Array<{ path: string; type: string }> };
    return (payload.tree || [])
      .filter((entry) => entry.type === 'blob')
      .map((entry) => entry.path);
  }

  const files: string[] = [];
  let page = 1;
  while (true) {
    const response = await fetch(`${provider.defaultBranchUrl()}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100&page=${page}`, {
      headers: {
        'User-Agent': 'depguarder',
        ...provider.apiHeaders(token),
      },
    });

    if (response.status === 403) {
      throw new Error('Access denied while listing repository files. Set the matching provider token in your environment for private repositories.');
    }
    if (!response.ok) {
      throw new Error(`Failed to list repository files: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as Array<{ path: string; type: string }>;
    files.push(...payload.filter((entry) => entry.type === 'blob').map((entry) => entry.path));
    if (payload.length < 100) break;
    page++;
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
      apiHeaders: (token) => bearerHeaders(token),
      authHeaders: (token) => githubRawHeaders(token),
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
      apiHeaders: (token) => bearerHeaders(token),
      authHeaders: (token) => githubRawHeaders(token),
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
      apiHeaders: (token) => bearerHeaders(token),
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
      apiHeaders: (token) => bearerHeaders(token),
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
        ...provider.apiHeaders(token),
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

async function auditClonedRepository(repoDir: string, options: CloneOptions) {
  const projects = discoverLocalProjectCandidates(repoDir);
  if (projects.length === 0) {
    throw new Error('No package.json files were found in the cloned repository.');
  }

  let audited = 0;
  for (const project of projects) {
    if (!project.lockfileName) {
      console.log(`\n⚠️ ${project.path}: no supported lockfile found, skipping local dependency graph scan.`);
      continue;
    }

    const absolutePath = project.path === '.' ? repoDir : join(repoDir, project.path);
    const result = await auditProjectDirectory(absolutePath, options);
    console.log(`\nProject: ${project.path} (${project.lockfileName})`);
    printAuditReport(result);
    audited++;
  }

  if (audited === 0) {
    console.log('\n⚠️ No project with a supported lockfile was found in the cloned repository.');
  }
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

function githubRawHeaders(token?: string): Record<string, string> {
  return {
    ...bearerHeaders(token),
    Accept: 'application/vnd.github.raw+json',
  };
}

function discoverRemoteProjectCandidates(files: string[]): Array<{ path: string; lockfileName?: typeof LOCKFILE_NAMES[number] }> {
  const fileSet = new Set(files);
  const manifestPaths = files.filter((file) => posix.basename(file) === 'package.json');

  return manifestPaths
    .map((manifestPath) => {
      const projectPath = dirnamePosix(manifestPath);
      return {
        path: projectPath,
        lockfileName: findLockfileInSet(fileSet, projectPath),
      };
    })
    .sort(sortProjectCandidates);
}

function discoverLocalProjectCandidates(rootDir: string): Array<{ path: string; lockfileName?: typeof LOCKFILE_NAMES[number] }> {
  const manifestPaths: string[] = [];

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        walk(join(currentDir, entry.name));
        continue;
      }

      if (entry.isFile() && entry.name === 'package.json') {
        manifestPaths.push(currentDir);
      }
    }
  }

  walk(rootDir);

  return manifestPaths
    .map((projectDir) => {
      const relativePath = relative(rootDir, projectDir) || '.';
      return {
        path: relativePath,
        lockfileName: findLocalLockfile(projectDir),
      };
    })
    .sort(sortProjectCandidates);
}

function findLockfileInSet(fileSet: Set<string>, projectPath: string): typeof LOCKFILE_NAMES[number] | undefined {
  for (const name of LOCKFILE_NAMES) {
    const candidate = joinPosix(projectPath, name);
    if (fileSet.has(candidate)) {
      return name;
    }
  }
  return undefined;
}

function findLocalLockfile(projectDir: string): typeof LOCKFILE_NAMES[number] | undefined {
  for (const name of LOCKFILE_NAMES) {
    if (existsSync(join(projectDir, name))) {
      return name;
    }
  }
  return undefined;
}

function dirnamePosix(path: string): string {
  const dir = posix.dirname(path);
  return dir === '.' ? '.' : dir;
}

function joinPosix(projectPath: string, filename: string): string {
  return projectPath === '.' ? filename : posix.join(projectPath, filename);
}

function sortProjectCandidates(
  a: { path: string; lockfileName?: string },
  b: { path: string; lockfileName?: string },
) {
  if (a.path === '.' && b.path !== '.') return -1;
  if (b.path === '.' && a.path !== '.') return 1;
  return a.path.localeCompare(b.path);
}

export const __test__ = {
  parseHostedRepository,
  probeRemoteRepository,
  detectDefaultBranch,
  fetchText,
  listRepositoryFiles,
  discoverRemoteProjectCandidates,
  getProviderToken,
  basicAuthHeaderValue,
  buildHttpsCloneArgs,
  gitLsRemoteArgs,
  bearerHeaders,
};
