import { createDefaultEngine, fetchMetadata } from './packages/rules/dist/index.js';

async function test() {
    const engine = createDefaultEngine();
    
    const testPackages = [
        { name: 'browserlist', version: '1.0.0' }, // Potential typosquat of browserslist
        { name: 'reactt', version: '1.0.0' },    // Potential typosquat of react
        { name: 'lodash', version: '4.17.21' }    // Should be low risk
    ];

    for (const pkg of testPackages) {
        console.log(`\n--- Testing ${pkg.name}@${pkg.version} ---`);
        try {
            const metadata = await fetchMetadata(pkg.name, pkg.version);
            const report = engine.analyze(metadata);
            console.log(`Score: ${report.score}`);
            console.log(`Severity: ${report.severity}`);
            report.findings.forEach(f => {
                console.log(`- [${f.severity}] ${f.title}: ${f.evidence[0]}`);
            });
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

test();
