import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class FreshReleaseRule implements Rule {
  id = 'fresh-release';
  name = 'Fresh Release Detection';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (!metadata.published) return null;

    const publishedDate = new Date(metadata.published);
    const now = new Date();
    const diffInDays = (now.getTime() - publishedDate.getTime()) / (1000 * 3600 * 24);

    if (diffInDays < 3) {
      return {
        id: this.id,
        title: 'Very recent package release',
        severity: 'high',
        scoreImpact: 20,
        evidence: [`Published on: ${metadata.published} (${Math.floor(diffInDays)} days ago)`],
        recommendation: 'Delay adoption until the new release has had time for broader scrutiny.',
      };
    }

    if (diffInDays < 14) {
      return {
        id: this.id,
        title: 'Recent package release',
        severity: 'medium',
        scoreImpact: 10,
        evidence: [`Published on: ${metadata.published} (${Math.floor(diffInDays)} days ago)`],
        recommendation: 'Review what changed in this release before depending on it in automation.',
      };
    }

    return null;
  }
}
