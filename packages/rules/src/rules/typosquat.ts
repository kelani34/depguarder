import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class TyposquatRule implements Rule {
  id = 'typosquat-detection';
  name = 'Typosquatting Detection';

  run(metadata: PackageMetadata): RuleFinding | null {
    const signal = metadata.nameRisk;
    if (!signal?.target) {
      return null;
    }

    return {
      id: this.id,
      title: 'Possible typosquatting detected',
      severity: signal.confidence === 'high' ? 'critical' : 'high',
      scoreImpact: signal.confidence === 'high' ? 35 : 25,
      evidence: [
        `Package name is very similar to established package: ${signal.target}`,
        `Reason: ${signal.reason}`,
      ],
      recommendation: `Verify that this is the intended package and not a malicious imitation of ${signal.target}.`,
    };
  }
}
