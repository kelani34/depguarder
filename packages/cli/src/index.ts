#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { analyzeCommand } from './commands/analyze.js';
import { scanCommand } from './commands/scan.js';
import { whyCommand } from './commands/why.js';
import { explainCommand } from './commands/explain.js';
import { installCommand } from './commands/install.js';
import { runCommand } from './commands/run.js';
import { initCommand } from './commands/init.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('depguarder')
  .description('Developer-first dependency security tool')
  .version(packageJson.version);

program
  .command('analyze')
  .description('Analyze direct dependencies in package.json')
  .action(analyzeCommand);

program
  .command('scan')
  .description('Scan full dependency graph from lockfile')
  .option('-j, --json <path>', 'Output report in JSON format')
  .option('-s, --sarif <path>', 'Output report in SARIF format')
  .option('-p, --paranoid', 'Deep behavioral analysis of packages')
  .action(scanCommand);

program
  .command('why <package>')
  .description('Show why a package is in the dependency graph')
  .action(whyCommand);

program
  .command('explain <package>')
  .description('Analyze and explain risk for a specific package')
  .option('-p, --paranoid', 'Deep behavioral analysis of the package')
  .action(explainCommand);

program
  .command('install <package>')
  .description('Proactively audit and install a package')
  .action(installCommand);

program
  .command('run <command> [args...]')
  .description('Run a development command with runtime monitoring')
  .action((cmd, args) => runCommand(cmd, args));

program
  .command('init')
  .description('Initialize DepGuarder in the current repository')
  .action(initCommand);

program.parse();
