import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class DownloadTrendsRule implements Rule {
  id = 'low-downloads';
  name = 'Low Download Count';

  run(metadata: PackageMetadata): RuleFinding | null {
    if (metadata.weeklyDownloads === undefined) return null;

    // Logic: If package is older than 90 days and has < 500 weekly downloads, it's low usage
    if (metadata.created) {
        const createdDate = new Date(metadata.created);
        const now = new Date();
        const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);

        if (ageInDays > 90 && metadata.weeklyDownloads < 500) {
            return {
                id: this.id,
                title: 'Unusually low download count',
                severity: 'medium',
                scoreImpact: 15,
                evidence: [`Weekly downloads: ${metadata.weeklyDownloads}`, `Package age: ${Math.floor(ageInDays)} days`],
                recommendation: 'This package has very low community adoption despite its age. Ensure it is a legitimate and maintained project.',
            };
        }
    }

    return null;
  }
}
