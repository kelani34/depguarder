import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class NewPackageRule implements Rule {
  id = 'new-package';
  name = 'New Package Detection';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (!metadata.created) return null;

    const createdDate = new Date(metadata.created);
    const now = new Date();
    const diffInDays = (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);

    if (diffInDays < 14) {
      return {
        id: this.id,
        title: 'Very new package',
        severity: 'medium',
        scoreImpact: 15,
        evidence: [`Created on: ${metadata.created} (${Math.floor(diffInDays)} days ago)`],
        recommendation: 'Use caution with extremely new packages as they have less historical trust.',
      };
    }

    return null;
  }
}
