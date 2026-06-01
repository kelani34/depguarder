import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

export class PostInstallRule implements Rule {
  id = 'postinstall-script';
  name = 'Post-install Script Detection';

  run(metadata: PackageMetadata): RuleFinding | null {
    const postinstall = metadata.scripts?.postinstall || metadata.scripts?.install || metadata.scripts?.preinstall;
    
    if (postinstall) {
      return {
        id: this.id,
        title: 'Package has an install script',
        severity: 'high',
        scoreImpact: 20,
        evidence: [postinstall],
        recommendation: 'Review the install script contents for suspicious activity before installing.',
      };
    }

    return null;
  }
}
