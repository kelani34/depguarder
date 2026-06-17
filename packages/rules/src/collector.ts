import pacote from 'pacote';
import { z } from 'zod';
import fetch from 'node-fetch';

const packumentCache = new Map<string, any>();
const weeklyDownloadsCache = new Map<string, number>();
const nameRiskCache = new Map<string, NameRisk | null>();

const NameRiskSchema = z.object({
  target: z.string(),
  reason: z.string(),
  confidence: z.enum(['medium', 'high']),
});

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
  nameRisk: NameRiskSchema.optional(),
  inspection: z.object({
      hasObfuscation: z.boolean(),
      suspiciousApis: z.array(z.string()),
      envAccess: z.array(z.string()),
      tlsBypass: z.boolean().optional(),
      hiddenExecution: z.boolean().optional(),
      detachedExecution: z.boolean().optional(),
      remoteIpAccess: z.boolean().optional(),
      homeDirectoryWrites: z.boolean().optional(),
      selfDelete: z.boolean().optional(),
  }).optional(),
  weeklyDownloads: z.number().optional(),
});

export type PackageMetadata = z.infer<typeof PackageMetadataSchema>;
export type NameRisk = z.infer<typeof NameRiskSchema>;

export async function fetchMetadata(name: string, version: string): Promise<PackageMetadata> {
  try {
    const packument = await getPackument(name);
    const manifest = await pacote.manifest(`${name}@${version}`, { fullMetadata: true }) as any;

    const created = packument.time?.created;
    const published = packument.time?.[manifest.version];
    const weeklyDownloads = await getWeeklyDownloads(name);
    const nameRisk = await detectNameRisk(name, created, weeklyDownloads);

    return {
      name,
      version: manifest.version,
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
      nameRisk: nameRisk || undefined,
      weeklyDownloads,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch metadata for ${name}@${version}: ${error.message}`);
  }
}

async function getPackument(name: string): Promise<any> {
  if (!packumentCache.has(name)) {
    packumentCache.set(name, await pacote.packument(name, { fullMetadata: true }) as any);
  }
  return packumentCache.get(name);
}

async function getWeeklyDownloads(name: string): Promise<number> {
  if (weeklyDownloadsCache.has(name)) {
    return weeklyDownloadsCache.get(name)!;
  }

  let weeklyDownloads = 0;
  try {
    const statsRes = await fetch(`https://api.npmjs.org/downloads/point/last-week/${name}`);
    if (statsRes.ok) {
      const stats = await statsRes.json() as any;
      weeklyDownloads = stats.downloads || 0;
    }
  } catch {
    // Ignore stats errors
  }

  weeklyDownloadsCache.set(name, weeklyDownloads);
  return weeklyDownloads;
}

async function detectNameRisk(name: string, created?: string, weeklyDownloads = 0): Promise<NameRisk | null> {
  const cached = nameRiskCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const candidates = generateNameCandidates(name);
  const createdDate = created ? new Date(created) : null;
  let bestMatch: NameRisk | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    try {
      const candidatePackument = await getPackument(candidate);
      const candidateDownloads = await getWeeklyDownloads(candidate);
      const candidateCreated = candidatePackument.time?.created ? new Date(candidatePackument.time.created) : null;

      const ageGapDays = createdDate && candidateCreated
        ? (createdDate.getTime() - candidateCreated.getTime()) / (1000 * 3600 * 24)
        : 0;
      const downloadRatio = weeklyDownloads > 0 ? candidateDownloads / Math.max(weeklyDownloads, 1) : candidateDownloads;

      let score = 0;
      if (isSingleEditAway(name, candidate)) score += 3;
      if (canonicalize(name).includes(canonicalize(candidate)) || canonicalize(candidate).includes(canonicalize(name))) score += 2;
      if (ageGapDays > 30) score += 2;
      if (downloadRatio > 20) score += 2;

      if (score > bestScore && (downloadRatio > 10 || ageGapDays > 30)) {
        bestScore = score;
        bestMatch = {
          target: candidate,
          reason: `Dynamic similarity check matched ${candidate} with much stronger ecosystem signals`,
          confidence: score >= 5 ? 'high' : 'medium',
        };
      }
    } catch {
      // Ignore nonexistent or unavailable candidates
    }
  }

  nameRiskCache.set(name, bestMatch);
  return bestMatch;
}

function generateNameCandidates(name: string): string[] {
  const lower = name.toLowerCase();
  const candidates = new Set<string>();
  const tokens = lower.split(/[-_.]+/).filter(Boolean);

  for (let i = 0; i < lower.length; i++) {
    candidates.add(lower.slice(0, i) + lower.slice(i + 1));
  }

  for (let i = 0; i < lower.length - 1; i++) {
    candidates.add(
      lower.slice(0, i) +
      lower[i + 1] +
      lower[i] +
      lower.slice(i + 2)
    );
  }

  if (tokens.length > 1) {
    for (let i = 0; i < tokens.length; i++) {
      const withoutToken = tokens.filter((_, index) => index !== i);
      candidates.add(withoutToken.join(''));
      candidates.add(withoutToken.join('-'));
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      const merged = [...tokens];
      merged.splice(i, 2, `${tokens[i]}${tokens[i + 1]}`);
      candidates.add(merged.join('-'));
      candidates.add(merged.join(''));
    }
  }

  candidates.delete(lower);
  return Array.from(candidates).filter((candidate) => candidate.length >= 3).slice(0, 32);
}

function canonicalize(value: string): string {
  return value.toLowerCase().replace(/[-_.]/g, '');
}

function isSingleEditAway(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;

  let dist = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      dist++;
      if (dist > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }

  dist += (a.length - i) + (b.length - j);
  return dist === 1;
}
