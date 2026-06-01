import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class MissingRepoRule implements Rule {
  id = 'missing-repository';
  name = 'Missing Source Repository';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (!metadata.repository) {
      return {
        id: this.id,
        title: 'Package has no source repository',
        severity: 'medium',
        scoreImpact: 15,
        evidence: ['No repository field found in metadata'],
        recommendation: 'Verify the package source and maintainer manually, as there is no linked public repository to review code or history.',
      };
    }

    return null;
  }
}
