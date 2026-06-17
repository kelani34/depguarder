import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

const SUSPICIOUS_TOKENS = [
  'node ',
  'curl ',
  'wget ',
  'powershell',
  'pwsh',
  'bash ',
  'sh ',
  'cmd /c',
  'http://',
  'https://'
];

export class LifecycleScriptBehaviorRule implements Rule {
  id = 'lifecycle-script-behavior';
  name = 'Lifecycle Script Behavior';

  run(metadata: PackageMetadata): RuleFinding | null {
    const scripts = metadata.scripts;
    if (!scripts) return null;

    const lifecycleScripts = ['preinstall', 'install', 'postinstall']
      .map((name) => ({ name, command: scripts[name] }))
      .filter((entry): entry is { name: string; command: string } => Boolean(entry.command));

    if (lifecycleScripts.length === 0) return null;

    const suspiciousMatches = lifecycleScripts.flatMap(({ name, command }) => {
      const lower = command.toLowerCase();
      return SUSPICIOUS_TOKENS
        .filter((token) => lower.includes(token))
        .map((token) => `${name}: contains "${token.trim()}"`);
    });

    if (suspiciousMatches.length === 0) return null;

    return {
      id: this.id,
      title: 'Lifecycle script contains suspicious execution patterns',
      severity: suspiciousMatches.some((match) => match.includes('http')) ? 'critical' : 'high',
      scoreImpact: suspiciousMatches.some((match) => match.includes('http')) ? 35 : 25,
      evidence: suspiciousMatches,
      recommendation: 'Block installation until the lifecycle script and downloaded code paths are reviewed.',
    };
  }
}
