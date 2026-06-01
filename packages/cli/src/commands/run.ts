import { spawn, execSync } from 'child_process';

export async function runCommand(cmd: string, args: string[]) {
  console.log(`\n🛡️ DepGuarder Runtime Guard Active`);
  console.log(`🚀 Executing: ${cmd} ${args.join(' ')}\n`);

  const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
  const rootPid = child.pid;
  
  if (!rootPid) {
      console.error('Failed to start child process.');
      process.exit(1);
  }

  const monitoredPids = new Set<number>();
  const suspiciousFound = new Set<string>();

  // Poll for child processes every 500ms
  const monitorInterval = setInterval(() => {
    try {
        const output = execSync(`ps -ao pid,ppid,comm`).toString();
        const lines = output.split('\n').slice(1);
        
        const allProcs: ProcessInfo[] = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3) return null;
            return {
                pid: parseInt(parts[0]),
                ppid: parseInt(parts[1]),
                comm: parts[2]
            };
        }).filter((p): p is ProcessInfo => p !== null);

        const children: ProcessInfo[] = [];
        const queue = [rootPid];
        const visited = new Set<number>();

        while (queue.length > 0) {
            const ppid = queue.shift()!;
            if (visited.has(ppid)) continue;
            visited.add(ppid);

            const directChildren = allProcs.filter(p => p.ppid === ppid);
            children.push(...directChildren);
            queue.push(...directChildren.map(p => p.pid));
        }
        
        for (const childProc of children) {
            if (!monitoredPids.has(childProc.pid)) {
                monitoredPids.add(childProc.pid);
                // console.log(`Debug: monitoring new child: ${childProc.comm} (${childProc.pid})`);
                checkProcess(childProc, suspiciousFound);
            }
        }
    } catch (e) {
        // console.error('Monitor error:', e);
    }
  }, 500);

  child.on('close', (code) => {
    clearInterval(monitorInterval);
    console.log(`\n🏁 Command finished with code ${code}`);
    
    if (suspiciousFound.size > 0) {
        console.log(`\n🚨 ALERT: DepGuarder detected ${suspiciousFound.size} suspicious runtime activities:`);
        suspiciousFound.forEach(msg => console.log(`  - ${msg}`));
        console.log(`\nReview these activities to ensure your development environment is safe.`);
    } else {
        console.log(`\n✅ No suspicious runtime processes detected.`);
    }
    
    process.exit(code || 0);
  });
}

interface ProcessInfo {
    pid: number;
    ppid: number;
    comm: string;
}

function findChildren(parentPid: number, lines: string[]): ProcessInfo[] {
    const allProcs: ProcessInfo[] = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
            pid: parseInt(parts[0]),
            ppid: parseInt(parts[1]),
            comm: parts[2]
        };
    }).filter(p => !isNaN(parentPid));

    const children: ProcessInfo[] = [];
    const queue = [parentPid];
    const visited = new Set<number>();

    while (queue.length > 0) {
        const ppid = queue.shift()!;
        if (visited.has(ppid)) continue;
        visited.add(ppid);

        const directChildren = allProcs.filter(p => p.ppid === ppid);
        children.push(...directChildren);
        queue.push(...directChildren.map(p => p.pid));
    }

    return children;
}

const SUSPICIOUS_APPS = [
    'curl', 'wget', 'nc', 'netcat', 'nmap', 'ssh', 'scp', 'ftp', 'telnet',
    'python', 'perl', 'ruby', 'bash', 'sh' // Generic shells can be suspicious if unexpected
];

function checkProcess(proc: ProcessInfo, suspiciousFound: Set<string>) {
    if (SUSPICIOUS_APPS.includes(proc.comm)) {
        suspiciousFound.add(`Suspicious process started: ${proc.comm} (PID: ${proc.pid})`);
    }
    
    // Check for hidden processes (starting with dot)
    if (proc.comm.startsWith('.')) {
        suspiciousFound.add(`Hidden process detected: ${proc.comm} (PID: ${proc.pid})`);
    }
}
