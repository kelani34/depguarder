import { buildGraph, DependencyGraph, inspectPackage, LockfileType, Manifest, parseManifest } from '@depguarder/core';
import { fetchMetadata, createDefaultEngine, AnalysisReport } from '@depguarder/rules';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadLockfile } from './lockfile-helper.js';

export interface AuditOptions {
  json?: string;
  sarif?: string;
  paranoid?: boolean;
}

export interface AuditResult {
  manifest: Manifest;
  graph: DependencyGraph;
  reports: AnalysisReport[];
  summary: Record<string, number>;
}

export async function auditProjectDirectory(projectDir: string, options: AuditOptions): Promise<AuditResult> {
  const manifestPath = join(projectDir, 'package.json');
  if (!existsSync(manifestPath)) {
    throw new Error('package.json not found.');
  }

  const manifest = parseManifest(manifestPath);
  const { type, data: lockfileData } = loadLockfile(projectDir);
  return auditResolvedProject(manifest, type, lockfileData, options);
}

export async function auditResolvedProject(
  manifest: Manifest,
  type: LockfileType,
  lockfileData: any,
  options: AuditOptions
): Promise<AuditResult> {
  const graph = buildGraph(type === 'npm' ? lockfileData.packages : lockfileData, manifest, type);
  const reports = await auditGraph(graph, options);
  const summary = generateSummary(reports);

  return { manifest, graph, reports, summary };
}

async function auditGraph(graph: DependencyGraph, options: AuditOptions): Promise<AnalysisReport[]> {
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

        reports.push(engine.analyze(metadata));
      } catch {
        // Skip if metadata fetch fails
      }
    }));
  }
  process.stdout.write('  Progress: 100%\n');

  return reports;
}

function generateSummary(reports: AnalysisReport[]) {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  reports.forEach((r) => counts[r.severity]++);
  return counts;
}

export function printAuditReport(result: AuditResult) {
  printConsoleReport(result.summary, result.reports, result.graph);
}

function printConsoleReport(summary: Record<string, number>, reports: AnalysisReport[], graph: DependencyGraph) {
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
      report.findings.forEach((f) => console.log(`  - ${f.title}`));

      const path = findOnePath(graph, report.packageName);
      if (path) {
        console.log(`  Path: ${path.join(' ➔ ')}`);
      }
    }
  } else {
    console.log('\n✅ No high-severity risks detected.');
  }
}

export function writeAuditOutputs(result: AuditResult, options: AuditOptions) {
  if (options.json) {
    writeFileSync(options.json, JSON.stringify({ summary: result.summary, reports: result.reports }, null, 2));
    console.log(`\n💾 JSON report saved to ${options.json}`);
  }

  if (options.sarif) {
    const sarif = generateSarif(result.reports);
    writeFileSync(options.sarif, JSON.stringify(sarif, null, 2));
    console.log(`\n💾 SARIF report saved to ${options.sarif}`);
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
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'DepGuarder',
          rules: Array.from(new Set(reports.flatMap((r) => r.findings.map((f) => ({
            id: f.id,
            name: f.id,
            shortDescription: { text: f.title }
          })))))
        }
      },
      results: reports.flatMap((report) => report.findings.map((finding) => ({
        ruleId: finding.id,
        message: { text: `${finding.title}: ${finding.recommendation}` },
        level: finding.severity === 'critical' || finding.severity === 'high' ? 'error' : 'warning',
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: 'package.json' }
          }
        }]
      })))
    }]
  };
}
