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

export function calculateSeverity(score: number): Severity {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
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
      severity: calculateSeverity(finalScore),
    };
  }
}
