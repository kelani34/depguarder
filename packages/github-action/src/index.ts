import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseManifest, buildGraph } from '@depguarder/core';
import { parseNpmLockfile } from '@depguarder/lockfile-parser';
import { fetchMetadata, createDefaultEngine, Severity } from '@depguarder/rules';
import { join } from 'path';
import { existsSync } from 'fs';

async function run() {
  try {
    const failOn = core.getInput('fail-on') as Severity;
    const token = core.getInput('token');
    
    const manifestPath = join(process.cwd(), 'package.json');
    const lockfilePath = join(process.cwd(), 'package-lock.json');

    if (!existsSync(lockfilePath)) {
      core.warning('package-lock.json not found. Skipping DepGuarder scan.');
      return;
    }

    const manifest = parseManifest(manifestPath);
    const lockfile = parseNpmLockfile(lockfilePath);
    const graph = buildGraph(lockfile.packages, manifest);

    core.info(`Auditing ${graph.nodes.size - 1} packages...`);
    
    const engine = createDefaultEngine();
    const nodeIds = Array.from(graph.nodes.keys()).filter(id => id !== graph.root);
    
    const riskyReports = [];
    
    // Simple serial fetch for action to stay under limits and avoid complexity
    for (const id of nodeIds) {
        const node = graph.nodes.get(id)!;
        try {
            const metadata = await fetchMetadata(node.name, node.version);
            const report = engine.analyze(metadata);
            if (report.severity !== 'low') {
                riskyReports.push(report);
            }
        } catch (e) {
            // Skip
        }
    }

    if (riskyReports.length > 0) {
        const comment = generatePRComment(riskyReports);
        core.info(comment);
        
        if (token && github.context.payload.pull_request) {
            const octokit = github.getOctokit(token);
            await octokit.rest.issues.createComment({
                ...github.context.repo,
                issue_number: github.context.payload.pull_request.number,
                body: comment
            });
        }

        const severityOrder: Severity[] = ['low', 'medium', 'high', 'critical'];
        const failIndex = severityOrder.indexOf(failOn);
        
        const hasBlockingRisk = riskyReports.some(r => severityOrder.indexOf(r.severity) >= failIndex);
        
        if (hasBlockingRisk) {
            core.setFailed(`DepGuarder found risks exceeding the threshold (${failOn})`);
        }
    } else {
        core.info('✅ No risks detected by DepGuarder.');
    }

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

function generatePRComment(reports: any[]) {
    let comment = `### 🛡️ DepGuarder Security Report\n\n`;
    comment += `DepGuarder detected the following risky dependencies:\n\n`;
    
    reports.forEach(report => {
        comment += `#### [${report.severity.toUpperCase()}] ${report.packageName}@${report.version}\n`;
        comment += `- **Score:** ${report.score}/100\n`;
        comment += `- **Findings:**\n`;
        report.findings.forEach((f: any) => {
            comment += `  - ${f.title}\n`;
        });
        comment += `\n`;
    });
    
    comment += `\n*Please review these dependencies before merging.*`;
    return comment;
}

run();
