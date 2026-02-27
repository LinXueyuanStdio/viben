/**
 * Official Registry routes
 *
 * Provides HTTP API for accessing the official MCP server registry.
 * Fetches from the official registry and caches locally.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Types
// ============================================================================

interface OfficialPackage {
  registryType: "npm" | "pypi" | "oci" | "nuget" | "mcpb";
  identifier: string;
  version?: string;
}

interface OfficialServerDisplay {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  author: string;
  homepage?: string;
  repository?: string;
  license?: string;
  categories: string[];
  packages: OfficialPackage[];
  qualifiedName: string;
  _original?: {
    server?: {
      icons?: Array<{ src: string; theme?: "light" | "dark" }>;
    };
  };
}

interface OfficialServerListResponse {
  servers: OfficialServerDisplay[];
  nextCursor: string | null;
  count: number;
}

interface RegistryIndex {
  version: string;
  updated_at?: string;
  servers: OfficialServerDisplay[];
}

// ============================================================================
// Configuration
// ============================================================================

const REGISTRY_INDEX_URL = "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/registry/index.json";
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
 * Fetch registry from remote
 */
async function fetchRegistryIndex(): Promise<RegistryIndex> {
  const response = await fetch(REGISTRY_INDEX_URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.statusText}`);
  }

  const data = await response.json();

  // Transform the raw data into our format
  const servers: OfficialServerDisplay[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      servers.push(transformServerEntry(item));
    }
  } else if (data.servers && Array.isArray(data.servers)) {
    for (const item of data.servers) {
      servers.push(transformServerEntry(item));
    }
  }

  return {
    version: "1.0",
    updated_at: new Date().toISOString(),
    servers,
  };
}

/**
 * Transform a raw server entry into display format
 */
function transformServerEntry(item: Record<string, unknown>): OfficialServerDisplay {
  const server = item as Record<string, unknown>;
  return {
    id: String(server.name || server.id || ""),
    name: String(server.displayName || server.name || ""),
    description: String(server.description || ""),
    iconUrl: server.iconUrl ? String(server.iconUrl) : null,
    author: String(server.author || server.vendor || ""),
    homepage: server.homepage ? String(server.homepage) : undefined,
    repository: server.repository ? String(server.repository) : undefined,
    license: server.license ? String(server.license) : undefined,
    categories: Array.isArray(server.categories) ? server.categories.map(String) : [],
    packages: transformPackages(server.packages || server.package),
    qualifiedName: String(server.qualifiedName || server.name || ""),
    _original: { server: server as OfficialServerDisplay["_original"] extends { server: infer S } ? S : undefined },
  };
}

/**
 * Transform package information
 */
function transformPackages(packages: unknown): OfficialPackage[] {
  if (!packages) return [];

  if (Array.isArray(packages)) {
    return packages.map((pkg) => ({
      registryType: pkg.registryType || "npm",
      identifier: pkg.identifier || pkg.name || "",
      version: pkg.version,
    }));
  }

  if (typeof packages === "object") {
    const pkg = packages as Record<string, unknown>;
    return [{
      registryType: (pkg.registryType as OfficialPackage["registryType"]) || "npm",
      identifier: String(pkg.identifier || pkg.name || ""),
      version: pkg.version ? String(pkg.version) : undefined,
    }];
  }

  return [];
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
          s.description.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query) ||
          s.author.toLowerCase().includes(query)
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
        (s) => s.id === name || s.name === name || s.qualifiedName === name
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
        (s) => s.id === name || s.name === name || s.qualifiedName === name
      );

      if (!server) {
        reply.code(404);
        return { error: "Server not found" };
      }

      // Extract versions from packages
      const versions = server.packages
        .filter((p) => p.version)
        .map((p) => p.version as string);

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
