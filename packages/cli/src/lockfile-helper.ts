import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import {
    parseNpmLockfile,
    parseNpmLockfileContent,
    parsePnpmLockfile,
    parsePnpmLockfileContent,
    parseYarnLockfile,
    parseYarnLockfileContent,
    parseYarnBerryLockfile,
    parseYarnBerryLockfileContent,
    parseBunLockfile
} from '@depguarder/lockfile-parser';
import { LockfileType } from '@depguarder/core';

export interface LoadedLockfile {
    type: LockfileType;
    data: any;
}

export interface RemoteProjectFiles {
    'package-lock.json'?: string;
    'pnpm-lock.yaml'?: string;
    'yarn.lock'?: string;
    'bun.lock'?: string;
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

export function loadLockfileFromFiles(files: RemoteProjectFiles): LoadedLockfile {
    if (files['bun.lock']) {
        throw new Error('Remote pre-clone inspection does not support bun.lock conversion. Clone the repository to run a full Bun project scan.');
    }
    if (files['pnpm-lock.yaml']) {
        return { type: 'pnpm', data: parsePnpmLockfileContent(files['pnpm-lock.yaml']) };
    }
    if (files['package-lock.json']) {
        return { type: 'npm', data: parseNpmLockfileContent(files['package-lock.json']) };
    }
    if (files['yarn.lock']) {
        const content = files['yarn.lock'];
        if (content.includes('__metadata')) {
            return { type: 'yarn-berry', data: parseYarnBerryLockfileContent(content) };
        }
        return { type: 'yarn', data: parseYarnLockfileContent(content, 'remote yarn.lock') };
    }

    throw new Error('No supported lockfile found (package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lock).');
}
