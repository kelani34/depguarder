import { parseManifest, buildGraph, inspectPackage } from '@depguarder/core';
import { fetchMetadata, createDefaultEngine, AnalysisReport } from '@depguarder/rules';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadLockfile } from '../lockfile-helper.js';

interface ExplainOptions {
    paranoid?: boolean;
}

export async function explainCommand(packageName: string, options: ExplainOptions) {
  try {
    const manifestPath = join(process.cwd(), 'package.json');
    if (!existsSync(manifestPath)) {
      throw new Error('package.json not found.');
    }

    const manifest = parseManifest(manifestPath);
    const { type, data: lockfileData } = loadLockfile(process.cwd());
    const graph = buildGraph(type === 'npm' ? lockfileData.packages : lockfileData, manifest, type);

    let targetId: string | undefined;
    for (const id of graph.nodes.keys()) {
        if (id.startsWith(`${packageName}@`)) {
            targetId = id;
            break;
        }
    }

    if (!targetId) {
        throw new Error(`Package ${packageName} not found in dependency graph.`);
    }

    const node = graph.nodes.get(targetId)!;
    console.log(`\n🧐 Analyzing ${node.name}@${node.version}${options.paranoid ? ' (PARANOID MODE)' : ''}...`);

    const metadata = await fetchMetadata(node.name, node.version);
    
    if (options.paranoid) {
        const inspection = await inspectPackage(node.name, node.version);
        metadata.inspection = inspection;
    }

    const engine = createDefaultEngine();
    const report = engine.analyze(metadata);

    printReport(report);

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function printReport(report: AnalysisReport) {
  console.log(`\nRisk Report for ${report.packageName}@${report.version}`);
  console.log(`Overall Risk: ${report.severity.toUpperCase()} (${report.score}/100)`);
  
  if (report.findings.length === 0) {
    console.log('\n✅ No risks detected.');
    return;
  }

  console.log(`\nFindings (${report.findings.length}):`);
  for (const finding of report.findings) {
    console.log(`\n[${finding.severity.toUpperCase()}] ${finding.title}`);
    console.log(`Impact: +${finding.scoreImpact}`);
    console.log(`Evidence:`);
    finding.evidence.forEach(e => console.log(`  - ${e}`));
    console.log(`Recommendation: ${finding.recommendation}`);
  }
}
