export * from './collector.js';
export * from './engine.js';
export * from './rules/postinstall.js';
export * from './rules/lifecycle-behavior.js';
export * from './rules/new-package.js';
export * from './rules/fresh-release.js';
export * from './rules/typosquat.js';
export * from './rules/behavioral.js';
export * from './rules/missing-repo.js';
export * from './rules/maintainer.js';
export * from './rules/downloads.js';
export * from './resolver.js';

import { RuleEngine } from './engine.js';
import { PostInstallRule } from './rules/postinstall.js';
import { LifecycleScriptBehaviorRule } from './rules/lifecycle-behavior.js';
import { NewPackageRule } from './rules/new-package.js';
import { FreshReleaseRule } from './rules/fresh-release.js';
import { TyposquatRule } from './rules/typosquat.js';
import { BehavioralRule } from './rules/behavioral.js';
import { MissingRepoRule } from './rules/missing-repo.js';
import { MaintainerRule } from './rules/maintainer.js';
import { DownloadTrendsRule } from './rules/downloads.js';

export function createDefaultEngine(): RuleEngine {
  const engine = new RuleEngine();
  engine.registerRule(new PostInstallRule());
  engine.registerRule(new LifecycleScriptBehaviorRule());
  engine.registerRule(new NewPackageRule());
  engine.registerRule(new FreshReleaseRule());
  engine.registerRule(new TyposquatRule());
  engine.registerRule(new BehavioralRule());
  engine.registerRule(new MissingRepoRule());
  engine.registerRule(new MaintainerRule());
  engine.registerRule(new DownloadTrendsRule());
  return engine;
}
