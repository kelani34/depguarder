import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class BehavioralRule implements Rule {
  id = 'behavioral-analysis';
  name = 'Behavioral Analysis';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (!metadata.inspection) return null;

    const { hasObfuscation, suspiciousApis, envAccess } = metadata.inspection;
    const findings: string[] = [];
    let scoreImpact = 0;

    if (hasObfuscation) {
        findings.push('Obfuscated code detected');
        scoreImpact += 25;
    }

    if (suspiciousApis.length > 0) {
        findings.push(`Suspicious APIs: ${Array.from(new Set(suspiciousApis)).join(', ')}`);
        scoreImpact += 20;
    }

    if (envAccess.length > 0) {
        findings.push('Environment variable access detected');
        scoreImpact += 15;
    }

    if (findings.length > 0) {
        return {
            id: this.id,
            title: 'Suspicious behavioral signals detected',
            severity: scoreImpact >= 40 ? 'critical' : 'high',
            scoreImpact,
            evidence: findings,
            recommendation: 'Manually review the package source code for potential malicious behavior.'
        };
    }

    return null;
  }
}
