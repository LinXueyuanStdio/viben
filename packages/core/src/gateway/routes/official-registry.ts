/**
 * Official Registry routes
 *
 * Provides HTTP API for accessing the official MCP server registry.
 * Proxies requests to registry.modelcontextprotocol.io and caches locally.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Types - Raw API response from official registry
// ============================================================================

interface RawPackage {
  registryType: string;
  identifier: string;
  version?: string;
  transport?: { type: string };
  environmentVariables?: Array<{
    name: string;
    description?: string;
    isRequired?: boolean;
    isSecret?: boolean;
  }>;
}

interface RawRemote {
  type: string;
  url: string;
}

interface RawServer {
  $schema?: string;
  name: string;
  description: string;
  version: string;
  repository?: {
    url: string;
    source?: string;
    id?: string;
    subfolder?: string;
  };
  websiteUrl?: string;
  packages?: RawPackage[];
  remotes?: RawRemote[];
  icons?: Array<{ src: string; theme?: "light" | "dark" }>;
}

interface RawServerEntry {
  server: RawServer;
  _meta?: {
    "io.modelcontextprotocol.registry/official"?: {
      status: string;
      publishedAt: string;
      updatedAt: string;
      isLatest: boolean;
    };
  };
}

interface RawRegistryResponse {
  servers: RawServerEntry[];
  metadata: {
    nextCursor: string | null;
    count: number;
  };
}

// ============================================================================
// Types - Normalized for API consumers (matches frontend OfficialServerDisplay)
// ============================================================================

type PackageRegistryType = "npm" | "pypi" | "oci" | "nuget" | "mcpb";

interface OfficialServerDisplay {
  /** Server name (used as ID) */
  id: string;
  /** Display name */
  name: string;
  /** Server slug (URL-safe name) */
  slug: string;
  /** Version string */
  version: string;
  /** Description */
  description: string | null;
  /** Primary icon URL */
  iconUrl: string | null;
  /** Repository URL */
  repositoryUrl: string | null;
  /** Website URL */
  websiteUrl: string | null;
  /** Publication status */
  status: "active" | "deprecated" | "deleted";
  /** Whether this is the latest version */
  isLatest: boolean;
  /** Published timestamp */
  publishedAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Available package types */
  packageTypes: PackageRegistryType[];
  /** Has remote endpoints */
  hasRemotes: boolean;
  /** Original server data for installation */
  _original: RawServerEntry;
}

interface OfficialServerListResponse {
  servers: OfficialServerDisplay[];
  nextCursor: string | null;
  count: number;
}

interface RegistryIndex {
  version: string;
  updated_at: string;
  servers: OfficialServerDisplay[];
}

// ============================================================================
// Configuration
// ============================================================================

const REGISTRY_API_BASE = "https://registry.modelcontextprotocol.io/v0.1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the cache directory path
 */
function getCacheDir(): string {
  const configDir = process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "viben")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "viben")
      : join(homedir(), ".config", "viben");

  return join(configDir, "cache");
}

/**
 * Get the registry cache file path
 */
function getRegistryCachePath(): string {
  return join(getCacheDir(), "official-registry.json");
}

/**
 * Check if cache is valid
 */
function isCacheValid(): boolean {
  const cachePath = getRegistryCachePath();
  if (!existsSync(cachePath)) {
    return false;
  }

  try {
    const stat = statSync(cachePath);
    const age = Date.now() - stat.mtimeMs;
    return age < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Load registry from cache
 */
async function loadFromCache(): Promise<RegistryIndex | null> {
  const cachePath = getRegistryCachePath();
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content) as RegistryIndex;
  } catch {
    return null;
  }
}

/**
 * Save registry to cache
 */
async function saveToCache(index: RegistryIndex): Promise<void> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }

  const cachePath = getRegistryCachePath();
  await writeFile(cachePath, JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Fetch all servers from registry (paginated), keeping only latest versions
 */
async function fetchAllServers(): Promise<OfficialServerDisplay[]> {
  const serverMap = new Map<string, OfficialServerDisplay>();
  let cursor: string | null = null;
  const limit = 100;

  do {
    const url = new URL(`${REGISTRY_API_BASE}/servers`);
    url.searchParams.set("limit", String(limit));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.statusText}`);
    }

    const data = (await response.json()) as RawRegistryResponse;

    for (const entry of data.servers) {
      const meta = entry._meta?.["io.modelcontextprotocol.registry/official"];
      const serverName = entry.server.name;

      // Only process if isLatest is true, or if we haven't seen this server yet
      if (meta?.isLatest || !serverMap.has(serverName)) {
        const transformed = transformServerEntry(entry);
        // If isLatest, always update; otherwise only add if not present
        if (meta?.isLatest || !serverMap.has(serverName)) {
          serverMap.set(serverName, transformed);
        }
      }
    }

    cursor = data.metadata.nextCursor;
  } while (cursor);

  return Array.from(serverMap.values());
}

/**
 * Fetch registry index and build local cache
 */
async function fetchRegistryIndex(): Promise<RegistryIndex> {
  const servers = await fetchAllServers();

  return {
    version: "1.0",
    updated_at: new Date().toISOString(),
    servers,
  };
}

/**
 * Create a URL-safe slug from server name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract unique package types from packages
 */
function extractPackageTypes(packages?: RawPackage[]): PackageRegistryType[] {
  if (!packages || packages.length === 0) return [];

  const validTypes = new Set<PackageRegistryType>(["npm", "pypi", "oci", "nuget", "mcpb"]);
  const types = new Set<PackageRegistryType>();

  for (const pkg of packages) {
    if (validTypes.has(pkg.registryType as PackageRegistryType)) {
      types.add(pkg.registryType as PackageRegistryType);
    }
  }

  return Array.from(types);
}

/**
 * Transform a raw server entry into display format (matches frontend OfficialServerDisplay)
 */
function transformServerEntry(entry: RawServerEntry): OfficialServerDisplay {
  const server = entry.server;
  const meta = entry._meta?.["io.modelcontextprotocol.registry/official"];

  // Try to find icon URL - prefer light theme
  let iconUrl: string | null = null;
  if (server.icons && server.icons.length > 0) {
    const lightIcon = server.icons.find((i) => i.theme === "light") || server.icons[0];
    iconUrl = lightIcon.src;
  }

  const now = new Date().toISOString();

  return {
    id: server.name,
    name: server.name,
    slug: createSlug(server.name),
    version: server.version,
    description: server.description || null,
    iconUrl,
    repositoryUrl: server.repository?.url || null,
    websiteUrl: server.websiteUrl || null,
    status: (meta?.status as "active" | "deprecated" | "deleted") || "active",
    isLatest: meta?.isLatest ?? true,
    publishedAt: meta?.publishedAt || now,
    updatedAt: meta?.updatedAt || now,
    packageTypes: extractPackageTypes(server.packages),
    hasRemotes: (server.remotes && server.remotes.length > 0) || false,
    _original: entry,
  };
}

/**
 * Get registry (from cache or remote)
 */
async function getRegistry(forceRefresh = false): Promise<RegistryIndex> {
  // Check cache first
  if (!forceRefresh && isCacheValid()) {
    const cached = await loadFromCache();
    if (cached) {
      return cached;
    }
  }

  // Fetch from remote
  const index = await fetchRegistryIndex();

  // Save to cache
  await saveToCache(index);

  return index;
}

// ============================================================================
// Routes
// ============================================================================

export function registerOfficialRegistryRoutes(fastify: FastifyInstance): void {
  /**
   * List official servers with pagination
   * GET /api/official-registry/servers
   */
  fastify.get<{
    Querystring: {
      cursor?: string;
      search?: string;
      limit?: string;
    };
  }>("/api/official-registry/servers", async (request) => {
    const { cursor, search, limit: limitStr } = request.query;
    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    try {
      const registry = await getRegistry();
      let servers = registry.servers;

      // Apply search filter
      if (search && search.trim()) {
        const query = search.toLowerCase();
        servers = servers.filter((s) =>
          s.name.toLowerCase().includes(query) ||
          (s.description && s.description.toLowerCase().includes(query)) ||
          s.id.toLowerCase().includes(query)
        );
      }

      // Apply pagination
      let startIndex = 0;
      if (cursor) {
        startIndex = parseInt(cursor, 10) || 0;
      }

      const endIndex = startIndex + limit;
      const paginatedServers = servers.slice(startIndex, endIndex);
      const nextCursor = endIndex < servers.length ? String(endIndex) : null;

      const response: OfficialServerListResponse = {
        servers: paginatedServers,
        nextCursor,
        count: servers.length,
      };

      return response;
    } catch (err) {
      // Try cache even if expired
      const cached = await loadFromCache();
      if (cached) {
        const response: OfficialServerListResponse = {
          servers: cached.servers.slice(0, limit),
          nextCursor: cached.servers.length > limit ? String(limit) : null,
          count: cached.servers.length,
        };
        return response;
      }

      throw err;
    }
  });

  /**
   * Get a specific server
   * GET /api/official-registry/servers/:name
   */
  fastify.get<{
    Params: { name: string };
    Querystring: { version?: string };
  }>("/api/official-registry/servers/:name", async (request, reply) => {
    const { name } = request.params;

    try {
      const registry = await getRegistry();
      const server = registry.servers.find(
        (s) => s.id === name || s.name === name || s.slug === name
      );

      if (!server) {
        reply.code(404);
        return { error: "Server not found" };
      }

      return server;
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  /**
   * Get versions for a specific server
   * GET /api/official-registry/servers/:name/versions
   */
  fastify.get<{
    Params: { name: string };
  }>("/api/official-registry/servers/:name/versions", async (request, reply) => {
    const { name } = request.params;

    try {
      const registry = await getRegistry();
      const server = registry.servers.find(
        (s) => s.id === name || s.name === name || s.slug === name
      );

      if (!server) {
        reply.code(404);
        return { error: "Server not found" };
      }

      // Extract versions from packages in the original server data
      const packages = server._original.server.packages || [];
      const versions = packages
        .filter((p: RawPackage) => p.version)
        .map((p: RawPackage) => p.version as string);

      return [...new Set(versions)];
    } catch (err) {
      // Return empty array on error
      return [];
    }
  });

  /**
   * Clear registry cache
   * DELETE /api/official-registry/cache
   */
  fastify.delete("/api/official-registry/cache", async () => {
    const cachePath = getRegistryCachePath();

    if (existsSync(cachePath)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(cachePath);
    }

    return { cleared: true };
  });

  /**
   * Invalidate cache for a specific server
   * DELETE /api/official-registry/servers/:name/cache
   */
  fastify.delete<{
    Params: { name: string };
  }>("/api/official-registry/servers/:name/cache", async () => {
    // For now, just clear the entire cache
    // A more sophisticated implementation would track per-server cache
    const cachePath = getRegistryCachePath();

    if (existsSync(cachePath)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(cachePath);
    }

    return { invalidated: true };
  });
}
