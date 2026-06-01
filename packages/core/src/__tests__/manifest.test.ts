import { describe, it, expect, vi } from 'vitest';
import { ManifestSchema, parseManifest } from '../manifest.js';
import * as fs from 'fs';

vi.mock('fs');

describe('ManifestParser', () => {
  it('should validate a correct manifest', () => {
    const valid = {
      name: 'test',
      version: '1.0.0',
      dependencies: { 'zod': '^3.0.0' }
    };
    expect(ManifestSchema.parse(valid)).toEqual(valid);
  });

  it('should throw on invalid manifest', () => {
    const invalid = {
      version: '1.0.0'
      // missing name
    };
    expect(() => ManifestSchema.parse(invalid)).toThrow();
  });

  it('should parse manifest from file', () => {
    const content = JSON.stringify({
      name: 'test',
      version: '1.0.0'
    });
    vi.spyOn(fs, 'readFileSync').mockReturnValue(content);
    
    const result = parseManifest('package.json');
    expect(result.name).toBe('test');
  });
});
