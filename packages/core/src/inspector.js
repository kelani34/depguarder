import pacote from 'pacote';
import { mkdir, rm, readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export async function inspectPackage(name, version) {
    const tempDir = join(tmpdir(), `depguarder-${name.replace(/\//g, '-')}-${version}`);
    try {
        if (existsSync(tempDir)) {
            await rm(tempDir, { recursive: true, force: true });
        }
        await mkdir(tempDir, { recursive: true });
        await pacote.extract(`${name}@${version}`, tempDir);
        if (isDockerAvailable()) {
            return await inspectWithDocker(tempDir);
        }
        const result = {
            hasObfuscation: false,
            suspiciousApis: [],
            envAccess: [],
            obfuscatedFiles: [],
            tlsBypass: false,
            hiddenExecution: false,
            detachedExecution: false,
            remoteIpAccess: false,
            homeDirectoryWrites: false,
            selfDelete: false,
        };
        await analyzeDirectory(tempDir, result);
        return result;
    }
    finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}
function isDockerAvailable() {
    try {
        execSync('docker ps', { stdio: 'ignore' });
        return true;
    }
    catch (e) {
        return false;
    }
}
async function inspectWithDocker(targetDir) {
    const sandboxScript = join(__dirname, '../sandbox/analyze.js');
    // We use a simple docker run command to mount the target directory and run the analysis script
    // Note: In a real production tool, we would pre-build the image.
    // For this prototype, we use the host's node to run the script inside a volume for safety.
    try {
        const output = execSync(`docker run --rm -v "${targetDir}:/app/package-to-scan:ro" -v "${sandboxScript}:/app/analyze.js:ro" node:20-slim node /app/analyze.js`, { encoding: 'utf8' });
        return JSON.parse(output);
    }
    catch (e) {
        console.warn(`Docker analysis failed, falling back to host analysis: ${e.message}`);
        const result = {
            hasObfuscation: false,
            suspiciousApis: [],
            envAccess: [],
            obfuscatedFiles: [],
            tlsBypass: false,
            hiddenExecution: false,
            detachedExecution: false,
            remoteIpAccess: false,
            homeDirectoryWrites: false,
            selfDelete: false,
        };
        await analyzeDirectory(targetDir, result);
        return result;
    }
}
async function analyzeDirectory(dir, result) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            await analyzeDirectory(fullPath, result);
        }
        else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.mjs'))) {
            await analyzeFile(fullPath, result);
        }
    }
}
async function analyzeFile(filePath, result) {
    const content = await readFile(filePath, 'utf8');
    const hexRegex = /\\x[0-9a-f]{2}/gi;
    const hexMatches = content.match(hexRegex);
    if (hexMatches && hexMatches.length > 50) {
        result.hasObfuscation = true;
        result.obfuscatedFiles.push(filePath);
    }
    if (content.includes('eval(') || content.includes('new Function(')) {
        result.suspiciousApis.push('Dynamic execution (eval/Function)');
    }
    const apis = [
        { name: 'child_process', regex: /child_process|spawn|exec/g },
        { name: 'network', regex: /http\.request|https\.request|fetch|axios|node-fetch/g },
        { name: 'filesystem-sensitive', regex: /\.ssh|passwd|shadow|credentials/g }
    ];
    for (const api of apis) {
        if (api.regex.test(content)) {
            result.suspiciousApis.push(api.name);
        }
    }
    if (/process\.env/g.test(content)) {
        result.envAccess.push('process.env access');
    }
    if (/NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized\s*:\s*false/g.test(content)) {
        result.tlsBypass = true;
    }
    if (/windowsHide\s*:\s*true/g.test(content)) {
        result.hiddenExecution = true;
    }
    if (/detached\s*:\s*true/g.test(content)) {
        result.detachedExecution = true;
    }
    if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/g.test(content)) {
        result.remoteIpAccess = true;
    }
    if (/\.pkg_history|\.pkg_logs|os\.homedir\(|process\.env\.(HOME|USERPROFILE)|~\//g.test(content)) {
        result.homeDirectoryWrites = true;
    }
    if (/unlinkSync|rmSync|unlink\(/g.test(content) && /__filename|setup\.cjs|\.js['"`]/g.test(content)) {
        result.selfDelete = true;
    }
}
//# sourceMappingURL=inspector.js.map