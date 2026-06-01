import { fetchMetadata, createDefaultEngine, AnalysisReport } from '@depguarder/rules';
import { loadLockfile } from '../lockfile-helper.js';
import { execSync, spawn } from 'child_process';
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
    
    const metadata = await fetchMetadata(name, version);
    const engine = createDefaultEngine();
    const report = engine.analyze(metadata);

    if (report.severity === 'critical' || report.severity === 'high') {
        printWarning(report);
        const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: `This package has a ${report.severity.toUpperCase()} risk score. Do you still want to install it?`,
                default: false
            }
        ]);

        if (!proceed) {
            console.log('\n❌ Installation aborted by user.');
            process.exit(0);
        }
    } else if (report.findings.length > 0) {
        console.log(`\n⚠️ Minor risks found (Score: ${report.score}/100). Proceeding...`);
    } else {
        console.log('\n✅ No risks detected for this package.');
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

function printWarning(report: AnalysisReport) {
    console.log(`\n🚨 WARNING: ${report.packageName}@${report.version} has ${report.findings.length} significant finding(s).`);
    console.log(`Overall Risk: ${report.severity.toUpperCase()} (${report.score}/100)`);
    report.findings.forEach(f => {
        console.log(`  - [${f.severity.toUpperCase()}] ${f.title}`);
    });
    console.log('');
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
