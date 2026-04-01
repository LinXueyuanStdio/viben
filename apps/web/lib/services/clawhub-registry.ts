/**
 * ClaWHub Registry Service
 *
 * Server-side service for fetching data from the ClaWHub registry.
 * Includes caching to avoid rate limits.
 */

import type {
  ClawhubSkillListResponse,
  ClawhubSkillDetailResponse,
  ClawhubSearchResponse,
  ClawhubSkillDisplay,
  ClawhubSkillListItem,
  ClawhubSkillListParams,
  ClawhubSearchParams,
  ClawhubRegistryApiResponse,
} from '@/lib/types/clawhub-registry';

const REGISTRY_BASE_URL = 'https://clawhub.ai/api/v1';

// Simple in-memory cache for server-side
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

/**
 * Transform skill list item to display format
 */
function transformSkillToDisplay(
  item: ClawhubSkillListItem,
  owner?: { handle: string; displayName?: string; image?: string | null }
): ClawhubSkillDisplay {
  return {
    id: item.slug,
    name: item.displayName,
    slug: item.slug,
    version: item.tags?.latest ?? item.latestVersion?.version ?? '0.0.0',
    description: item.summary ?? null,
    ownerHandle: owner?.handle ?? null,
    ownerName: owner?.displayName ?? null,
    ownerAvatar: owner?.image ?? null,
    downloads: item.stats?.downloads ?? 0,
    stars: item.stats?.stars ?? 0,
    installs: item.stats?.installs ?? 0,
    os: item.metadata?.os ?? null,
    systems: item.metadata?.systems ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    isSuspicious: false,
    _original: item,
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
 */
export async function fetchClawhubSkills(
  params: ClawhubSkillListParams = {}
): Promise<ClawhubRegistryApiResponse> {
  const { cursor, sort = 'updated', limit = 50, nonSuspiciousOnly = true } = params;

  // Build URL with query params
  const url = new URL(`${REGISTRY_BASE_URL}/skills`);
  if (cursor) url.searchParams.set('cursor', cursor);
  if (sort) url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(Math.min(limit, 200)));
  if (nonSuspiciousOnly) url.searchParams.set('nonSuspiciousOnly', 'true');

  const cacheKey = `clawhub:skills:${url.toString()}`;

  const response = await cachedFetch(cacheKey, async () => {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
      // Cache for 5 minutes on the edge
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`ClaWHub API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<ClawhubSkillListResponse>;
  });

  // Transform to display format
  const skills = response.items.map((item) => transformSkillToDisplay(item));

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
      const res = await fetch(url.toString(), {
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
 * Fetch skill file content
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
      const res = await fetch(url.toString(), {
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

    return content;
  } catch {
    return null;
  }
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
      const res = await fetch(url.toString(), {
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
