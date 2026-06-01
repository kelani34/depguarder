import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parseNpmLockfile, parsePnpmLockfile, parseYarnLockfile, parseYarnBerryLockfile, parseBunLockfile } from '@depguarder/lockfile-parser';
import { LockfileType } from '@depguarder/core';

export interface LoadedLockfile {
    type: LockfileType;
    data: any;
}

export function loadLockfile(cwd: string): LoadedLockfile {
    const npmPath = join(cwd, 'package-lock.json');
    const pnpmPath = join(cwd, 'pnpm-lock.yaml');
    const yarnPath = join(cwd, 'yarn.lock');
    const bunPath = join(cwd, 'bun.lock');
    const bunPathB = join(cwd, 'bun.lockb');

    if (existsSync(bunPath)) {
        return { type: 'bun', data: parseBunLockfile(bunPath) };
    }
    if (existsSync(pnpmPath)) {
        return { type: 'pnpm', data: parsePnpmLockfile(pnpmPath) };
    }
    if (existsSync(npmPath)) {
        return { type: 'npm', data: parseNpmLockfile(npmPath) };
    }
    if (existsSync(yarnPath)) {
        const content = readFileSync(yarnPath, 'utf8');
        if (content.includes('__metadata')) {
            return { type: 'yarn-berry', data: parseYarnBerryLockfile(yarnPath) };
        }
        return { type: 'yarn', data: parseYarnLockfile(yarnPath) };
    }
    if (existsSync(bunPathB)) {
        throw new Error('bun.lockb (binary) detected. Please use Bun v1.2+ to generate bun.lock (text) for DepGuarder support.');
    }

    throw new Error('No supported lockfile found (package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lock).');
}
