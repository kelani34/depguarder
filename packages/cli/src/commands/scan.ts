import { parseManifest, buildGraph, DependencyGraph, inspectPackage } from '@depguarder/core';
import { fetchMetadata, createDefaultEngine, AnalysisReport } from '@depguarder/rules';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { loadLockfile } from '../lockfile-helper.js';

interface ScanOptions {
  json?: string;
  sarif?: string;
  paranoid?: boolean;
}

export async function scanCommand(options: ScanOptions) {
  try {
    const manifestPath = join(process.cwd(), 'package.json');
    if (!existsSync(manifestPath)) {
      throw new Error('package.json not found.');
    }

    const manifest = parseManifest(manifestPath);
    const { type, data: lockfileData } = loadLockfile(process.cwd());

    console.log(`\n🔍 Building dependency graph for ${manifest.name}@${manifest.version} (${type})...`);
    const graph = buildGraph(type === 'npm' ? lockfileData.packages : lockfileData, manifest, type);

    console.log(`\n🛡️ Auditing ${graph.nodes.size - 1} unique packages${options.paranoid ? ' (PARANOID MODE)' : ''}...`);
    
    const engine = createDefaultEngine();
    const reports: AnalysisReport[] = [];
    
    const nodeIds = Array.from(graph.nodes.keys()).filter(id => id !== graph.root);
    const batchSize = options.paranoid ? 2 : 5;
    
    for (let i = 0; i < nodeIds.length; i += batchSize) {
        const batch = nodeIds.slice(i, i + batchSize);
        process.stdout.write(`  Progress: ${Math.round((i / nodeIds.length) * 100)}%\r`);
        
        await Promise.all(batch.map(async (id) => {
            const node = graph.nodes.get(id)!;
            try {
                const metadata = await fetchMetadata(node.name, node.version);
                
                if (options.paranoid) {
                    const inspection = await inspectPackage(node.name, node.version);
                    metadata.inspection = inspection;
                }

                const report = engine.analyze(metadata);
                reports.push(report);
            } catch (e) {
                // Skip if metadata fetch fails
            }
        }));
    }
    console.log(`  Progress: 100%`);

    const summary = generateSummary(reports);
    printConsoleReport(summary, reports, graph, manifest.name);

    if (options.json) {
        writeFileSync(options.json, JSON.stringify({ summary, reports }, null, 2));
        console.log(`\n💾 JSON report saved to ${options.json}`);
    }

    if (options.sarif) {
        const sarif = generateSarif(reports);
        writeFileSync(options.sarif, JSON.stringify(sarif, null, 2));
        console.log(`\n💾 SARIF report saved to ${options.sarif}`);
    }

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function generateSummary(reports: AnalysisReport[]) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    reports.forEach(r => counts[r.severity]++);
    return counts;
}

function printConsoleReport(summary: any, reports: AnalysisReport[], graph: DependencyGraph, rootName: string) {
    console.log(`\nDepGuarder Security Audit Summary:`);
    console.log(`- Critical: ${summary.critical}`);
    console.log(`- High: ${summary.high}`);
    console.log(`- Medium: ${summary.medium}`);
    console.log(`- Low: ${summary.low}`);

    const riskyReports = reports.filter(r => r.severity === 'critical' || r.severity === 'high');
    
    if (riskyReports.length > 0) {
        console.log(`\n⚠️ ${riskyReports.length} High/Critical risks found:`);
        for (const report of riskyReports) {
            console.log(`\n[${report.severity.toUpperCase()}] ${report.packageName}@${report.version} (Score: ${report.score}/100)`);
            report.findings.forEach(f => console.log(`  - ${f.title}`));
            
            const path = findOnePath(graph, report.packageName);
            if (path) {
                console.log(`  Path: ${path.join(' ➔ ')}`);
            }
        }
    } else {
        console.log('\n✅ No high-severity risks detected.');
    }
}

function findOnePath(graph: DependencyGraph, targetName: string): string[] | null {
    const visited = new Set<string>();
    
    function dfs(currentId: string, path: string[]): string[] | null {
        const node = graph.nodes.get(currentId);
        if (!node) return null;
        if (node.name === targetName) return [...path, currentId];
        if (visited.has(currentId)) return null;
        visited.add(currentId);

        for (const depId of node.dependencies) {
            const found = dfs(depId, [...path, currentId]);
            if (found) return found;
        }
        return null;
    }
    
    return dfs(graph.root, []);
}

function generateSarif(reports: AnalysisReport[]) {
    return {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [{
            tool: {
                driver: {
                    name: "DepGuarder",
                    rules: Array.from(new Set(reports.flatMap(r => r.findings.map(f => ({
                        id: f.id,
                        name: f.id,
                        shortDescription: { text: f.title }
                    })))))
                }
            },
            results: reports.flatMap(report => report.findings.map(finding => ({
                ruleId: finding.id,
                message: { text: `${finding.title}: ${finding.recommendation}` },
                level: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : 'warning',
                locations: [{
                    physicalLocation: {
                        artifactLocation: { uri: "package.json" }
                    }
                }]
            })))
        }]
    };
}
