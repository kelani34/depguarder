import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../engine.js';
import { PostInstallRule } from '../rules/postinstall.js';
import { TyposquatRule } from '../rules/typosquat.js';
import { MissingRepoRule } from '../rules/missing-repo.js';
import { MaintainerRule } from '../rules/maintainer.js';
import { DownloadTrendsRule } from '../rules/downloads.js';
import { BehavioralRule } from '../rules/behavioral.js';

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
    expect(report.severity).toBe('low');
  });

  it('should detect typosquatting', () => {
    const engine = new RuleEngine();
    engine.registerRule(new TyposquatRule());

    const metadata = {
      name: 'reactt', // typosquat of react
      version: '1.0.0'
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
          envAccess: ['process.env access']
      }
    };

    const report = engine.analyze(metadata as any);
    expect(report.findings.some(f => f.id === 'behavioral-analysis')).toBe(true);
    expect(report.score).toBe(60); // 25 + 20 + 15
    expect(report.severity).toBe('high');
  });
});
