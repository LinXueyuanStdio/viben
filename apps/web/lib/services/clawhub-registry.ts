/**
 * ClaWHub Registry Service
 *
 * Server-side service for fetching data from the ClaWHub registry.
 * Includes caching to avoid rate limits.
 */

import type {
  ClawhubPackageListResponse,
  ClawhubPackageItem,
  ClawhubSkillDetailResponse,
  ClawhubSearchResponse,
  ClawhubSkillDisplay,
  ClawhubSkillListParams,
  ClawhubSearchParams,
  ClawhubRegistryApiResponse,
} from '@/lib/types/clawhub-registry';

const REGISTRY_BASE_URL = 'https://clawhub.ai/api/v1';
const FETCH_TIMEOUT = 15000; // 15 second timeout

// Simple in-memory cache for server-side
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum number of cache entries

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, init?: RequestInit, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get cached data or fetch fresh
 */
async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }

  const data = await fetcher();

  // If cache exceeds limit, remove oldest entry before adding new one
  if (cache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;
    for (const [k, v] of cache) {
      if (v.timestamp < oldestTimestamp) {
        oldestTimestamp = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * Strip YAML frontmatter from markdown content
 */
function stripFrontmatter(content: string): string {
  // Match YAML frontmatter delimited by --- at the start
  const frontmatterRegex = /^---\s*\n(?:.*\n)*?---\s*\n/;
  return content.replace(frontmatterRegex, '');
}

/**
 * Transform package item to display format
 */
function transformPackageToDisplay(item: ClawhubPackageItem): ClawhubSkillDisplay {
  return {
    id: item.name,
    name: item.displayName,
    slug: item.name,
    version: item.latestVersion ?? '0.0.0',
    description: item.summary ?? null,
    ownerHandle: item.ownerHandle ?? null,
    ownerName: null, // Package API doesn't include owner display name
    ownerAvatar: null, // Package API doesn't include owner avatar
    downloads: 0, // Package API doesn't include stats
    stars: 0,
    installs: 0,
    os: null, // Package API doesn't include platform metadata
    systems: null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isSuspicious: false,
  };
}

/**
 * Transform skill detail to display format
 */
function transformSkillDetailToDisplay(
  response: ClawhubSkillDetailResponse
): ClawhubSkillDisplay {
  const { skill, latestVersion, metadata, owner, moderation } = response;

  return {
    id: skill.slug,
    name: skill.displayName,
    slug: skill.slug,
    version: skill.tags?.latest ?? latestVersion?.version ?? '0.0.0',
    description: skill.summary ?? null,
    ownerHandle: owner?.handle ?? null,
    ownerName: owner?.displayName ?? null,
    ownerAvatar: owner?.image ?? null,
    downloads: skill.stats?.downloads ?? 0,
    stars: skill.stats?.stars ?? 0,
    installs: skill.stats?.installs ?? 0,
    os: metadata?.os ?? null,
    systems: metadata?.systems ?? null,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    isSuspicious: moderation?.isSuspicious ?? false,
    _original: response,
  };
}

/**
 * Fetch skills from the ClaWHub registry
 * Uses /packages endpoint with family=skill filter (the /skills endpoint returns empty)
 */
export async function fetchClawhubSkills(
  params: ClawhubSkillListParams = {}
): Promise<ClawhubRegistryApiResponse> {
  const { cursor, limit = 50 } = params;

  // Build URL with query params - use /packages endpoint with family=skill
  const url = new URL(`${REGISTRY_BASE_URL}/packages`);
  url.searchParams.set('family', 'skill');
  if (cursor) url.searchParams.set('cursor', cursor);
  url.searchParams.set('limit', String(Math.min(limit, 100)));

  const cacheKey = `clawhub:packages:${url.toString()}`;

  const response = await cachedFetch(cacheKey, async () => {
    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
      // Cache for 5 minutes on the edge
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`ClaWHub API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<ClawhubPackageListResponse>;
  });

  // Transform to display format
  const skills = response.items.map((item) => transformPackageToDisplay(item));

  return {
    skills,
    nextCursor: response.nextCursor ?? null,
  };
}

/**
 * Fetch a single skill by slug
 */
export async function fetchClawhubSkill(
  slug: string
): Promise<ClawhubSkillDisplay | null> {
  const url = new URL(`${REGISTRY_BASE_URL}/skills/${encodeURIComponent(slug)}`);
  const cacheKey = `clawhub:skill:${url.toString()}`;

  try {
    const response = await cachedFetch(cacheKey, async () => {
      const res = await fetchWithTimeout(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`ClaWHub API error: ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<ClawhubSkillDetailResponse>;
    });

    if (!response) return null;
    return transformSkillDetailToDisplay(response);
  } catch {
    return null;
  }
}

/**
 * File paths to try when fetching a skill's README/documentation
 */
const README_FILE_PATHS = [
  'README.md',
  'readme.md',
  'index.md',
  'README',
  'SKILL.md',
];

/**
 * Fetch a single file from a skill
 */
export async function fetchClawhubSkillFile(
  slug: string,
  path: string,
  version?: string
): Promise<string | null> {
  const url = new URL(`${REGISTRY_BASE_URL}/skills/${encodeURIComponent(slug)}/file`);
  url.searchParams.set('path', path);
  if (version) url.searchParams.set('version', version);

  const cacheKey = `clawhub:file:${url.toString()}`;

  try {
    const content = await cachedFetch(cacheKey, async () => {
      const res = await fetchWithTimeout(url.toString(), {
        headers: {
          Accept: 'text/plain',
        },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`ClaWHub API error: ${res.status} ${res.statusText}`);
      }

      return res.text();
    });

    if (content !== null) {
      return stripFrontmatter(content);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch skill README content by trying multiple file paths in parallel.
 * Returns the first successfully fetched content, or null if none found.
 */
export async function fetchClawhubSkillReadme(slug: string): Promise<string | null> {
  // Try all file paths in parallel
  const results = await Promise.all(
    README_FILE_PATHS.map((path) =>
      fetchClawhubSkillFile(slug, path).catch(() => null)
    )
  );

  // Return the first non-null result
  for (const content of results) {
    if (content) return content;
  }

  return null;
}

/**
 * Search skills by query
 */
export async function searchClawhubSkills(
  params: ClawhubSearchParams
): Promise<ClawhubSkillDisplay[]> {
  const { q, limit = 20, highlightedOnly, nonSuspiciousOnly = true } = params;

  if (!q.trim()) return [];

  const url = new URL(`${REGISTRY_BASE_URL}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(Math.min(limit, 100)));
  if (highlightedOnly) url.searchParams.set('highlightedOnly', 'true');
  if (nonSuspiciousOnly) url.searchParams.set('nonSuspiciousOnly', 'true');

  const cacheKey = `clawhub:search:${url.toString()}`;

  try {
    const response = await cachedFetch(cacheKey, async () => {
      const res = await fetchWithTimeout(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
        next: { revalidate: 300 },
      });

      if (!res.ok) {
        throw new Error(`ClaWHub API error: ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<ClawhubSearchResponse>;
    });

    // Transform search results to display format
    return response.results.map((result) => ({
      id: result.slug,
      name: result.displayName,
      slug: result.slug,
      version: result.version ?? '0.0.0',
      description: result.summary ?? null,
      ownerHandle: null,
      ownerName: null,
      ownerAvatar: null,
      downloads: 0,
      stars: 0,
      installs: 0,
      os: null,
      systems: null,
      createdAt: result.updatedAt ?? 0,
      updatedAt: result.updatedAt ?? 0,
      isSuspicious: false,
    }));
  } catch {
    return [];
  }
}

/**
 * Clear the cache (useful for development)
 */
export function clearClawhubRegistryCache(): void {
  cache.clear();
}
