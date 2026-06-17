import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('../project-audit.js', () => ({
  auditProjectDirectory: vi.fn(),
  auditResolvedProject: vi.fn(async (manifest, type, data) => ({
    manifest,
    graph: { root: `${manifest.name}@${manifest.version || '0.0.0'}`, nodes: new Map() },
    reports: [{ severity: 'high', score: 75, packageName: 'left-pad', version: '1.0.0', findings: [] }],
    summary: { critical: 0, high: 1, medium: 0, low: 0 },
  })),
  printAuditReport: vi.fn(),
}));

vi.mock('../lockfile-helper.js', () => ({
  loadLockfileFromFiles: vi.fn((files) => {
    if (files['bun.lock']) {
      return { type: 'bun', data: { manager: 'bun', root: { dependencies: {}, devDependencies: {}, optionalDependencies: {}, peerDependencies: {} }, packages: new Map() } };
    }
    return { type: 'npm', data: { manager: 'npm', root: { dependencies: {}, devDependencies: {}, optionalDependencies: {}, peerDependencies: {} }, packages: new Map() } };
  }),
}));

import { __test__ } from '../commands/clone.js';

describe('clone command helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('parses GitHub HTTPS repositories and builds authenticated API URLs', () => {
    const provider = __test__.parseHostedRepository('https://github.com/openai/depguarder.git');
    expect(provider).not.toBeNull();
    expect(provider?.kind).toBe('github');
    expect(provider?.defaultBranchUrl()).toBe('https://api.github.com/repos/openai/depguarder');
    expect(provider?.fileUrl('main', 'package.json')).toBe(
      'https://api.github.com/repos/openai/depguarder/contents/package.json?ref=main'
    );
    expect(provider?.authHeaders('ghp_test')).toEqual({
      Authorization: 'Bearer ghp_test',
      Accept: 'application/vnd.github.raw+json',
    });
  });

  it('parses GitLab HTTPS repositories and builds authenticated raw file URLs', () => {
    const provider = __test__.parseHostedRepository('https://gitlab.com/acme/depguarder.git');
    expect(provider).not.toBeNull();
    expect(provider?.kind).toBe('gitlab');
    expect(provider?.defaultBranchUrl()).toBe(
      'https://gitlab.com/api/v4/projects/acme%2Fdepguarder'
    );
    expect(provider?.fileUrl('main', 'pnpm-lock.yaml')).toBe(
      'https://gitlab.com/api/v4/projects/acme%2Fdepguarder/repository/files/pnpm-lock.yaml/raw?ref=main'
    );
    expect(provider?.authHeaders('glpat_test')).toEqual({
      Authorization: 'Bearer glpat_test',
    });
  });

  it('keeps SSH clone transport unchanged while still supporting provider parsing', () => {
    const provider = __test__.parseHostedRepository('git@github.com:openai/depguarder.git');
    expect(provider).not.toBeNull();
    expect(provider?.gitCloneArgs('ignored')).toEqual(['clone', 'git@github.com:openai/depguarder.git']);
  });

  it('reads provider tokens from the expected environment variables', () => {
    vi.stubEnv('GITHUB_TOKEN', 'github-token');
    vi.stubEnv('GITLAB_TOKEN', 'gitlab-token');

    expect(__test__.getProviderToken('github')).toBe('github-token');
    expect(__test__.getProviderToken('gitlab')).toBe('gitlab-token');
  });

  it('builds authenticated HTTPS clone arguments when a token is present', () => {
    const header = __test__.basicAuthHeaderValue('x-access-token', 'secret');
    expect(header).toContain('AUTHORIZATION: basic ');

    expect(__test__.buildHttpsCloneArgs('https://github.com/openai/depguarder.git', header)).toEqual([
      '-c',
      `http.extraHeader=${header}`,
      'clone',
      'https://github.com/openai/depguarder.git',
    ]);
  });

  it('builds authenticated ls-remote arguments for HTTPS providers with a token', () => {
    const provider = __test__.parseHostedRepository('https://gitlab.com/acme/depguarder.git');
    expect(provider).not.toBeNull();

    expect(__test__.gitLsRemoteArgs(provider!, 'token')).toEqual([
      '-c',
      `http.extraHeader=${__test__.basicAuthHeaderValue('oauth2', 'token')}`,
      'ls-remote',
      '--symref',
      'https://gitlab.com/acme/depguarder.git',
      'HEAD',
    ]);
  });

  it('returns null for unsupported providers', () => {
    expect(__test__.parseHostedRepository('https://bitbucket.org/acme/depguarder.git')).toBeNull();
  });

  it('detects the default branch from the provider API when available', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({
      ok: true,
      status: 200,
      json: async () => ({ default_branch: 'main' }),
      text: async () => '',
    }) as Response);

    const provider = __test__.parseHostedRepository('https://github.com/openai/depguarder.git');
    await expect(__test__.detectDefaultBranch(provider!)).resolves.toBe('main');
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('falls back to git ls-remote when the provider API does not return a branch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({
      ok: false,
      status: 500,
      statusText: 'server error',
      json: async () => ({}),
      text: async () => '',
    }) as Response);
    vi.mocked(execFileSync).mockReturnValueOnce('ref: refs/heads/develop HEAD\nabc123\tHEAD\n' as never);

    const provider = __test__.parseHostedRepository('https://github.com/openai/depguarder.git');
    await expect(__test__.detectDefaultBranch(provider!)).resolves.toBe('develop');
    expect(execFileSync).toHaveBeenCalled();
  });

  it('probes a repository and returns an audit when manifest and lockfile are available', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        json: async () => ({ default_branch: 'main' }),
        text: async () => '',
      }) as Response)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        json: async () => ({ tree: [{ path: 'package.json', type: 'blob' }, { path: 'package-lock.json', type: 'blob' }] }),
        text: async () => '',
      }) as Response)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ name: 'sample-app', version: '1.0.0', dependencies: { 'left-pad': '^1.0.0' } }),
      }) as Response)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ name: 'sample-app', lockfileVersion: 3, packages: { '': {} } }),
      }) as Response);

    const result = await __test__.probeRemoteRepository('https://github.com/openai/depguarder.git', {});
    expect(result.branch).toBe('main');
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].lockfileType).toBe('package-lock.json');
    expect(result.projects[0].audit).toBeDefined();
    expect(result.warning).toBeUndefined();
  });

  it('returns a warning when no supported remote lockfile is found', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        json: async () => ({ default_branch: 'main' }),
        text: async () => '',
      }) as Response)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        json: async () => ({ tree: [{ path: 'package.json', type: 'blob' }] }),
        text: async () => '',
      }) as Response)
      .mockResolvedValueOnce(mockResponse({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ name: 'sample-app', version: '1.0.0' }),
      }) as Response);

    const result = await __test__.probeRemoteRepository('https://github.com/openai/depguarder.git', {});
    expect(result.projects[0].audit).toBeUndefined();
    expect(result.projects[0].warning).toContain('No supported lockfile');
  });

  it('surfaces access-denied errors for private repositories without a token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => '',
    }) as Response);

    await expect(__test__.fetchText('https://api.github.com/repos/openai/private/contents/package.json', {})).rejects.toThrow(
      'Access denied while fetching'
    );
  });

  it('discovers multiple remote project candidates in a monorepo', () => {
    const projects = __test__.discoverRemoteProjectCandidates([
      'package.json',
      'package-lock.json',
      'packages/web/package.json',
      'packages/web/pnpm-lock.yaml',
      'packages/shared/package.json',
      'README.md',
    ]);

    expect(projects).toEqual([
      { path: '.', lockfileName: 'package-lock.json' },
      { path: 'packages/shared', lockfileName: undefined },
      { path: 'packages/web', lockfileName: 'pnpm-lock.yaml' },
    ]);
  });

  it('lists repository files from the GitHub tree API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({
      ok: true,
      status: 200,
      json: async () => ({
        tree: [
          { path: 'package.json', type: 'blob' },
          { path: 'packages/web/package.json', type: 'blob' },
          { path: 'packages', type: 'tree' },
        ],
      }),
      text: async () => '',
    }) as Response);

    const provider = __test__.parseHostedRepository('https://github.com/openai/depguarder.git');
    await expect(__test__.listRepositoryFiles(provider!, 'main')).resolves.toEqual([
      'package.json',
      'packages/web/package.json',
    ]);
  });
});

function mockResponse(response: {
  ok?: boolean;
  status: number;
  statusText?: string;
  text: () => Promise<string>;
  json?: () => Promise<any>;
}) {
  return {
    ok: response.ok ?? (response.status >= 200 && response.status < 300),
    status: response.status,
    statusText: response.statusText || '',
    text: response.text,
    json: response.json || (async () => JSON.parse(await response.text())),
  };
}
