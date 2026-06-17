import { PackageMetadata } from './collector.js';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface RuleFinding {
  id: string;
  title: string;
  severity: Severity;
  scoreImpact: number;
  evidence: string[];
  recommendation: string;
}

export interface Rule {
  id: string;
  name: string;
  run(metadata: PackageMetadata): RuleFinding | null;
}

export interface AnalysisReport {
  packageName: string;
  version: string;
  findings: RuleFinding[];
  score: number;
  severity: Severity;
}

const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical'];

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[Math.max(SEVERITY_ORDER.indexOf(a), SEVERITY_ORDER.indexOf(b))];
}

export function calculateSeverity(score: number, findings: RuleFinding[] = []): Severity {
  let severity: Severity = 'low';

  if (score >= 75) severity = 'critical';
  else if (score >= 50) severity = 'high';
  else if (score >= 25) severity = 'medium';

  for (const finding of findings) {
    severity = maxSeverity(severity, finding.severity);
  }

  return severity;
}

export class RuleEngine {
  private rules: Rule[] = [];

  registerRule(rule: Rule) {
    this.rules.push(rule);
  }

  analyze(metadata: PackageMetadata): AnalysisReport {
    const findings: RuleFinding[] = [];
    let totalScore = 0;

    for (const rule of this.rules) {
      const finding = rule.run(metadata);
      if (finding) {
        findings.push(finding);
        totalScore += finding.scoreImpact;
      }
    }

    // Cap score at 100
    const finalScore = Math.min(totalScore, 100);

    return {
      packageName: metadata.name,
      version: metadata.version,
      findings,
      score: finalScore,
      severity: calculateSeverity(finalScore, findings),
    };
  }
}
