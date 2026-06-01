import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class MaintainerRule implements Rule {
  id = 'maintainer-reputation';
  name = 'Maintainer Reputation';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (!metadata.maintainers || metadata.maintainers.length === 0) return null;

    if (metadata.maintainers.length === 1) {
      return {
        id: this.id,
        title: 'Single maintainer package',
        severity: 'low',
        scoreImpact: 10,
        evidence: [`Maintainer: ${metadata.maintainers[0].name || 'unknown'}`],
        recommendation: 'Single maintainer packages have a higher risk of abandonment or unreviewed changes. Consider the project\'s stability.',
      };
    }

    return null;
  }
}
