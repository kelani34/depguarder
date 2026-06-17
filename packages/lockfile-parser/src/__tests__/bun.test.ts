import { describe, expect, it } from 'vitest';
import { parseBunLockfileContent } from '../bun.js';

describe('parseBunLockfileContent', () => {
  it('parses Bun text lockfiles as canonical lockfiles', () => {
    const content = `{
      // Bun v1.2 text lockfile
      "lockfileVersion": 0,
      "workspaces": {
        "": {
          "dependencies": {
            "uWebSocket.js": "uNetworking/uWebSockets.js#v20.51.0",
          },
        },
      },
      "packages": {
        "uWebSocket.js": ["uWebSockets.js@github:uNetworking/uWebSockets.js#6609a88", {}, "uNetworking-uWebSockets.js-6609a88"],
      },
    }`;

    const lockfile = parseBunLockfileContent(content);
    expect(lockfile.manager).toBe('bun');
    expect(lockfile.root.dependencies['uWebSocket.js']).toBe('uNetworking/uWebSockets.js#v20.51.0');
    expect(lockfile.packages.has('uWebSocket.js@github:uNetworking/uWebSockets.js#6609a88')).toBe(true);
  });
});
