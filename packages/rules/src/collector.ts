import pacote from 'pacote';
import { z } from 'zod';
import fetch from 'node-fetch';

export const PackageMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  created: z.string().optional(),
  published: z.string().optional(),
  maintainers: z.array(z.object({
    name: z.string().optional(),
    email: z.string().optional(),
  })).optional(),
  repository: z.string().optional(),
  homepage: z.string().optional(),
  license: z.string().optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  dist: z.object({
    integrity: z.string().optional(),
    shasum: z.string().optional(),
    tarball: z.string().optional(),
  }).optional(),
  inspection: z.object({
      hasObfuscation: z.boolean(),
      suspiciousApis: z.array(z.string()),
      envAccess: z.array(z.string()),
  }).optional(),
  weeklyDownloads: z.number().optional(),
});

export type PackageMetadata = z.infer<typeof PackageMetadataSchema>;

export async function fetchMetadata(name: string, version: string): Promise<PackageMetadata> {
  try {
    const packument = await pacote.packument(name, { fullMetadata: true }) as any;
    const manifest = await pacote.manifest(`${name}@${version}`, { fullMetadata: true }) as any;

    const created = packument.time?.created;
    const published = packument.time?.[version];

    let weeklyDownloads = 0;
    try {
        const statsRes = await fetch(`https://api.npmjs.org/downloads/point/last-week/${name}`);
        if (statsRes.ok) {
            const stats = await statsRes.json() as any;
            weeklyDownloads = stats.downloads || 0;
        }
    } catch (e) {
        // Ignore stats errors
    }

    return {
      name,
      version,
      created,
      published,
      maintainers: manifest.maintainers,
      repository: typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url,
      homepage: manifest.homepage,
      license: manifest.license,
      scripts: manifest.scripts,
      dist: {
        integrity: manifest.dist?.integrity,
        shasum: manifest.dist?.shasum,
        tarball: manifest.dist?.tarball,
      },
      weeklyDownloads,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch metadata for ${name}@${version}: ${error.message}`);
  }
}
