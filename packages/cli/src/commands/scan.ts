import { auditProjectDirectory, printAuditReport, writeAuditOutputs } from '../project-audit.js';

interface ScanOptions {
  json?: string;
  sarif?: string;
  paranoid?: boolean;
}

export async function scanCommand(options: ScanOptions) {
  try {
    const result = await auditProjectDirectory(process.cwd(), options);
    console.log(`\n🔍 Building dependency graph for ${result.manifest.name}@${result.manifest.version}...`);
    console.log(`\n🛡️ Auditing ${result.graph.nodes.size - 1} unique packages${options.paranoid ? ' (PARANOID MODE)' : ''}...`);
    printAuditReport(result);
    writeAuditOutputs(result, options);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}
