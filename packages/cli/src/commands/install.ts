import { fetchMetadata, createDefaultEngine, AnalysisReport, resolvePackageGraph } from '@depguarder/rules';
import { loadLockfile } from '../lockfile-helper.js';
import { spawn } from 'child_process';
import inquirer from 'inquirer';

export async function installCommand(packageName: string) {
  try {
    let name = packageName;
    let version = 'latest';

    if (packageName.includes('@')) {
        const parts = packageName.split('@');
        // Handle scoped packages
        if (packageName.startsWith('@')) {
            name = `@${parts[1]}`;
            version = parts[2] || 'latest';
        } else {
            name = parts[0];
            version = parts[1];
        }
    }

    console.log(`\n🛡️ DepGuarder Pre-install Audit: ${name}@${version}`);

    console.log(`\n🔍 Resolving dependency graph before install...`);
    const graph = await resolvePackageGraph(name, version);
    const engine = createDefaultEngine();

    const reports: AnalysisReport[] = [];
    for (const node of graph.nodes.values()) {
      const metadata = await fetchMetadata(node.name, node.version);
      reports.push(engine.analyze(metadata));
    }

    const riskyReports = reports
      .filter((report) => report.severity === 'critical' || report.severity === 'high')
      .sort((a, b) => b.score - a.score);

    if (riskyReports.length > 0) {
        printWarnings(riskyReports, graph);
        const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: `Resolved dependency graph contains ${riskyReports.length} HIGH/CRITICAL package risks. Do you still want to install it?`,
                default: false
            }
        ]);

        if (!proceed) {
            console.log('\n❌ Installation aborted by user.');
            process.exit(0);
        }
    } else if (reports.some((report) => report.findings.length > 0)) {
        console.log('\n⚠️ Minor risks found in the resolved dependency graph. Proceeding...');
    } else {
        console.log('\n✅ No risks detected in the resolved dependency graph.');
    }

    // Determine package manager and proceed
    const { type } = loadLockfile(process.cwd());
    const command = getInstallCommand(type, packageName);
    
    console.log(`\n🚀 Running: ${command}\n`);
    
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, { stdio: 'inherit' });
    
    child.on('close', (code) => {
        process.exit(code || 0);
    });

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function printWarnings(reports: AnalysisReport[], graph: Awaited<ReturnType<typeof resolvePackageGraph>>) {
    console.log(`\n🚨 WARNING: ${reports.length} high-risk package(s) detected before install.`);

    for (const report of reports.slice(0, 10)) {
        console.log(`\n[${report.severity.toUpperCase()}] ${report.packageName}@${report.version} (${report.score}/100)`);
        report.findings.forEach((finding) => {
            console.log(`  - [${finding.severity.toUpperCase()}] ${finding.title}`);
        });

        const path = findPathToPackage(graph, `${report.packageName}@${report.version}`);
        if (path) {
            console.log(`  Path: ${path.join(' -> ')}`);
        }
    }
}

function getInstallCommand(type: string, pkg: string): string {
    switch (type) {
        case 'pnpm': return `pnpm add ${pkg}`;
        case 'yarn':
        case 'yarn-berry': return `yarn add ${pkg}`;
        case 'bun': return `bun add ${pkg}`;
        default: return `npm install ${pkg}`;
    }
}

function findPathToPackage(graph: Awaited<ReturnType<typeof resolvePackageGraph>>, targetId: string): string[] | null {
    const visited = new Set<string>();

    function dfs(currentId: string, path: string[]): string[] | null {
        if (visited.has(currentId)) return null;
        visited.add(currentId);

        const node = graph.nodes.get(currentId);
        if (!node) return null;

        const label = `${node.name}@${node.version}`;
        const nextPath = [...path, label];
        if (currentId === targetId) {
            return nextPath;
        }

        for (const depId of node.dependencies) {
            const found = dfs(depId, nextPath);
            if (found) return found;
        }

        return null;
    }

    return dfs(graph.root, []);
}
