/**
 * Official MCP Registry Service
 *
 * Server-side service for fetching data from the official MCP registry.
 * Includes caching to avoid rate limits.
 */

import type {
  OfficialServerListResponse,
  OfficialServerResponse,
  OfficialServerDisplay,
  OfficialPackageRegistryType,
  OfficialRegistryListParams,
  OfficialRegistryApiResponse,
} from '@/lib/types/official-registry';

const REGISTRY_BASE_URL = 'https://registry.modelcontextprotocol.io/v0.1';

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
 * Transform server response to display format
 */
function transformServerToDisplay(
  response: OfficialServerResponse
): OfficialServerDisplay {
  const server = response.server;
  const meta = response._meta?.['io.modelcontextprotocol.registry/official'];

  // Extract package types
  const packageTypes: OfficialPackageRegistryType[] = (server.packages ?? [])
    .map((pkg) => pkg.registryType)
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  // Get primary icon URL
  const iconUrl = server.icons?.[0]?.src ?? null;

  // Get repository URL
  const repositoryUrl = server.repository?.url ?? null;

  // Create URL-safe slug from name
  const slug = server.name
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return {
    id: server.name,
    name: server.title ?? server.name.split('/').pop() ?? server.name,
    slug,
    version: server.version,
    description: server.description || null,
    iconUrl,
    repositoryUrl,
    websiteUrl: server.websiteUrl ?? null,
    status: meta?.status ?? 'active',
    isLatest: meta?.isLatest ?? true,
    publishedAt: meta?.publishedAt ?? new Date().toISOString(),
    updatedAt: meta?.updatedAt ?? new Date().toISOString(),
    packageTypes,
    hasRemotes: (server.remotes?.length ?? 0) > 0,
    _original: response,
  };
}

/**
 * Fetch servers from the official registry
 */
export async function fetchOfficialServers(
  params: OfficialRegistryListParams = {}
): Promise<OfficialRegistryApiResponse> {
  const { cursor, search, limit = 50 } = params;

  // Build URL with query params
  const url = new URL(`${REGISTRY_BASE_URL}/servers`);
  if (cursor) url.searchParams.set('cursor', cursor);
  if (search) url.searchParams.set('search', search);
  url.searchParams.set('limit', String(limit));

  const cacheKey = `servers:${url.toString()}`;

  const response = await cachedFetch(cacheKey, async () => {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
      // Cache for 5 minutes on the edge
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`Registry API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<OfficialServerListResponse>;
  });

  // Transform to display format
  const servers = response.servers.map(transformServerToDisplay);

  return {
    servers,
    nextCursor: response.metadata.nextCursor ?? null,
    count: response.metadata.count,
  };
}

/**
 * Fetch a single server by name
 */
export async function fetchOfficialServer(
  name: string,
  version?: string
): Promise<OfficialServerDisplay | null> {
  // API requires /servers/{serverName}/versions/{version} format
  // Use 'latest' as special version to get the latest version
  const versionParam = version || 'latest';
  const url = new URL(
    `${REGISTRY_BASE_URL}/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(versionParam)}`
  );

  const cacheKey = `server:${url.toString()}`;

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
        throw new Error(`Registry API error: ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<OfficialServerResponse>;
    });

    if (!response) return null;
    return transformServerToDisplay(response);
  } catch {
    return null;
  }
}

/**
 * Search servers by query
 */
export async function searchOfficialServers(
  query: string,
  limit = 20
): Promise<OfficialServerDisplay[]> {
  if (!query.trim()) return [];

  const result = await fetchOfficialServers({ search: query, limit });
  return result.servers;
}

/**
 * Get package type display label
 */
export function getPackageTypeLabel(type: OfficialPackageRegistryType): string {
  const labels: Record<OfficialPackageRegistryType, string> = {
    npm: 'Node.js (npm)',
    pypi: 'Python (PyPI)',
    oci: 'Docker (OCI)',
    nuget: '.NET (NuGet)',
    mcpb: 'MCP Binary',
  };
  return labels[type] ?? type;
}

/**
 * Clear the cache (useful for development)
 */
export function clearOfficialRegistryCache(): void {
  cache.clear();
}
