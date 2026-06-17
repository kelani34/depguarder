import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class BehavioralRule implements Rule {
  id = 'behavioral-analysis';
  name = 'Behavioral Analysis';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (!metadata.inspection) return null;

    const {
      hasObfuscation,
      suspiciousApis,
      envAccess,
      tlsBypass,
      hiddenExecution,
      detachedExecution,
      remoteIpAccess,
      homeDirectoryWrites,
      selfDelete,
    } = metadata.inspection;
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

    if (tlsBypass) {
        findings.push('TLS verification bypass detected');
        scoreImpact += 25;
    }

    if (hiddenExecution || detachedExecution) {
        findings.push('Hidden or detached process execution detected');
        scoreImpact += 20;
    }

    if (remoteIpAccess) {
        findings.push('Literal remote IP communication detected');
        scoreImpact += 20;
    }

    if (homeDirectoryWrites) {
        findings.push('Home-directory marker or persistence writes detected');
        scoreImpact += 15;
    }

    if (selfDelete) {
        findings.push('Self-deleting installer behavior detected');
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
