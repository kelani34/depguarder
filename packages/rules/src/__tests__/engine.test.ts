import { describe, it, expect } from 'vitest';
import { RuleEngine } from '../engine.js';
import { PostInstallRule } from '../rules/postinstall.js';
import { TyposquatRule } from '../rules/typosquat.js';

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
});
