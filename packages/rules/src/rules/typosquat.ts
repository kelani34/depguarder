import { Rule, RuleFinding } from '../engine.js';
import { PackageMetadata } from '../collector.js';

const POPULAR_PACKAGES = [
  'react', 'react-dom', 'lodash', 'express', 'commander', 'zod', 'axios', 
  'typescript', 'chalk', 'fs-extra', 'dotenv', 'jest', 'next', 'vue',
  'browserslist', 'angular', 'webpack', 'babel-core', 'core-js'
];

export class TyposquatRule implements Rule {
  id = 'typosquat-detection';
  name = 'Typosquatting Detection';

  run(metadata: PackageMetadata): RuleFinding | null {
    const name = metadata.name.toLowerCase();

    for (const popular of POPULAR_PACKAGES) {
      if (name === popular) continue;

      // Very basic similarity check: 
      // 1. One character difference (levenshtein distance 1)
      // 2. Transposition of two characters
      // 3. Omitting a hyphen
      
      const cleanName = name.replace(/-/g, '');
      const cleanPopular = popular.replace(/-/g, '');

      if (cleanName === cleanPopular && name !== popular) {
          return this.createFinding(popular, 'Hyphen omission/variation');
      }

      if (this.isSimilar(name, popular)) {
          return this.createFinding(popular, 'High name similarity');
      }
    }

    return null;
  }

  private createFinding(target: string, reason: string): RuleFinding {
    return {
      id: this.id,
      title: 'Possible typosquatting detected',
      severity: 'critical',
      scoreImpact: 35,
      evidence: [`Package name is very similar to popular package: ${target}`, `Reason: ${reason}`],
      recommendation: `Verify that this is the intended package and not a malicious imitation of ${target}.`,
    };
  }

  private isSimilar(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) > 1) return false;
    
    // Levenshtein distance 1
    let dist = 0;
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] !== b[j]) {
        dist++;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else { i++; j++; }
      } else {
        i++; j++;
      }
    }
    dist += (a.length - i) + (b.length - j);
    
    return dist === 1;
  }
}
