import { parseManifest } from '@depguarder/core';
import { join } from 'path';

export async function analyzeCommand() {
  try {
    const manifestPath = join(process.cwd(), 'package.json');
    const manifest = parseManifest(manifestPath);

    console.log(`\n📦 Analyzing ${manifest.name}@${manifest.version}`);
    
    const deps = Object.keys(manifest.dependencies || {});
    const devDeps = Object.keys(manifest.devDependencies || {});

    console.log(`\nDirect Dependencies (${deps.length}):`);
    deps.forEach(d => console.log(`- ${d}`));

    console.log(`\nDev Dependencies (${devDeps.length}):`);
    devDeps.forEach(d => console.log(`- ${d}`));

    console.log('\n✅ Manifest analysis complete.');
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}
