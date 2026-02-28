/**
 * Marketplace routes
 *
 * Provides HTTP API for the plugin marketplace (Claude plugins official).
 * Fetches from remote index and caches locally.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Types - Raw API response from GitHub
// ============================================================================

interface RawPluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

interface RawPlugin {
  name: string;
  description: string;
  version?: string;
  author?: RawPluginAuthor;
  source?: string;
  url?: string;
  homepage?: string;
  category?: string;
  strict?: boolean;
  mcpServers?: Record<string, unknown>;
  lspServers?: Record<string, unknown>;
  skills?: unknown[];
}

interface RawMarketplaceIndex {
  $schema?: string;
  name: string;
  description: string;
  owner?: RawPluginAuthor;
  plugins: RawPlugin[];
}

// ============================================================================
// Types - Normalized for API consumers (matches frontend types)
// ============================================================================

interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  plugin_count: number;
  source_count: number;
}

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version?: string;
  author_name: string;
  author_email?: string;
  author_url?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  categories: string[];
  builtin: boolean;
  package?: string;
  source_count: number;
  sources: string[];
}

interface FlatSource {
  id: string;
  source_name: string;
  plugin_id: string;
  name: string;
  description: string;
  category?: string;
  api_key_type: "none" | "optional" | "required";
  documentation?: string;
  plugin_name: string;
}

interface ProviderIndex {
  version: string;
  updated_at: string;
  categories: MarketplaceCategory[];
  plugins: MarketplacePlugin[];
}

// ============================================================================
// Configuration
// ============================================================================

const MARKETPLACE_INDEX_URL = "https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
 * Get the provider index cache file path
 */
function getProviderCachePath(): string {
  return join(getCacheDir(), "providers.json");
}

/**
 * Check if cache is valid
 */
function isCacheValid(): boolean {
  const cachePath = getProviderCachePath();
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
 * Load provider index from cache
 */
async function loadFromCache(): Promise<ProviderIndex | null> {
  const cachePath = getProviderCachePath();
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const content = await readFile(cachePath, "utf-8");
    return JSON.parse(content) as ProviderIndex;
  } catch {
    return null;
  }
}

/**
 * Save provider index to cache
 */
async function saveToCache(index: ProviderIndex): Promise<void> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }

  const cachePath = getProviderCachePath();
  await writeFile(cachePath, JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Fetch marketplace index from remote and normalize it
 */
async function fetchMarketplaceIndex(): Promise<ProviderIndex> {
  const response = await fetch(MARKETPLACE_INDEX_URL, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch marketplace index: ${response.statusText}`);
  }

  const raw = (await response.json()) as RawMarketplaceIndex;
  return normalizeIndex(raw);
}

/**
 * Normalize raw marketplace data to our API format
 */
function normalizeIndex(raw: RawMarketplaceIndex): ProviderIndex {
  // Build category counts
  const categoryCounts = new Map<string, number>();
  for (const plugin of raw.plugins) {
    const cat = plugin.category || "other";
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }

  // Build categories array
  const categoryDescriptions: Record<string, string> = {
    development: "Development tools and language servers",
    productivity: "Productivity and workflow tools",
    database: "Database and data management tools",
    deployment: "Deployment and CI/CD tools",
    design: "Design and UI tools",
    learning: "Learning and documentation tools",
    monitoring: "Monitoring and observability tools",
    security: "Security and compliance tools",
    testing: "Testing and quality assurance tools",
    other: "Other plugins",
  };

  const categories: MarketplaceCategory[] = Array.from(categoryCounts.entries()).map(([id, count]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: categoryDescriptions[id] || `${id} plugins`,
    plugin_count: count,
    source_count: count, // Each plugin is treated as one source
  }));

  // Normalize plugins - match frontend MarketplacePlugin interface
  const plugins: MarketplacePlugin[] = raw.plugins.map((p) => {
    const category = p.category || "other";
    return {
      id: p.name,
      name: p.name,
      description: p.description,
      version: p.version,
      author_name: p.author?.name || raw.owner?.name || "Unknown",
      author_email: p.author?.email || raw.owner?.email,
      author_url: p.author?.url || raw.owner?.url,
      homepage: p.homepage || p.url,
      repository: p.url,
      license: undefined,
      categories: [category], // Convert single category to array
      builtin: false, // Third-party plugins are not builtin
      package: p.source,
      source_count: 1, // Each plugin has at least one source
      sources: [p.name], // Plugin name as source
    };
  });

  return {
    version: "1.0.0",
    updated_at: new Date().toISOString(),
    categories,
    plugins,
  };
}

/**
 * Flatten plugins to sources for UI display
 */
function flattenSources(plugins: MarketplacePlugin[]): FlatSource[] {
  return plugins.map((p) => ({
    id: p.id,
    source_name: p.name,
    plugin_id: p.id,
    name: p.name,
    description: p.description,
    category: p.categories[0],
    api_key_type: "none" as const,
    documentation: p.homepage,
    plugin_name: p.name,
  }));
}

/**
 * Get provider index (from cache or remote)
 */
async function getProviderIndex(forceRefresh = false): Promise<ProviderIndex> {
  // Check cache first
  if (!forceRefresh && isCacheValid()) {
    const cached = await loadFromCache();
    if (cached) {
      return cached;
    }
  }

  // Fetch from remote
  const index = await fetchMarketplaceIndex();

  // Save to cache
  await saveToCache(index);

  return index;
}

// ============================================================================
// Routes
// ============================================================================

export function registerMarketplaceRoutes(fastify: FastifyInstance): void {
  /**
   * Get provider index
   * GET /api/marketplace/index
   */
  fastify.get<{
    Querystring: { force_refresh?: string };
  }>("/api/marketplace/index", async (request) => {
    const forceRefresh = request.query.force_refresh === "true";

    try {
      const index = await getProviderIndex(forceRefresh);
      return index;
    } catch (err) {
      // Try cache even if expired
      const cached = await loadFromCache();
      if (cached) {
        return cached;
      }

      throw err;
    }
  });


  /**
   * Get flat sources list
   * GET /api/marketplace/sources
   */
  fastify.get("/api/marketplace/sources", async () => {
    try {
      const index = await getProviderIndex();
      return flattenSources(index.plugins);
    } catch (err) {
      const cached = await loadFromCache();
      if (cached) {
        return flattenSources(cached.plugins);
      }
      return [];
    }
  });

  /**
   * Get all plugins
   * GET /api/marketplace/plugins
   */
  fastify.get("/api/marketplace/plugins", async () => {
    try {
      const index = await getProviderIndex();
      return index.plugins;
    } catch (err) {
      const cached = await loadFromCache();
      if (cached) {
        return cached.plugins;
      }

      return [];
    }
  });

  /**
   * Get all categories
   * GET /api/marketplace/categories
   */
  fastify.get("/api/marketplace/categories", async () => {
    try {
      const index = await getProviderIndex();
      return index.categories;
    } catch (err) {
      const cached = await loadFromCache();
      if (cached) {
        return cached.categories;
      }

      return [];
    }
  });

  /**
   * Get a specific plugin
   * GET /api/marketplace/plugins/:pluginId
   */
  fastify.get<{
    Params: { pluginId: string };
  }>("/api/marketplace/plugins/:pluginId", async (request, reply) => {
    const { pluginId } = request.params;

    try {
      const index = await getProviderIndex();
      const plugin = index.plugins.find((p) => p.id === pluginId);

      if (!plugin) {
        reply.code(404);
        return { error: "Plugin not found" };
      }

      return plugin;
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  /**
   * Clear provider cache
   * DELETE /api/marketplace/cache
   */
  fastify.delete("/api/marketplace/cache", async () => {
    const cachePath = getProviderCachePath();

    if (existsSync(cachePath)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(cachePath);
    }

    return { cleared: true };
  });

  /**
   * Search plugins by query
   * GET /api/marketplace/search
   */
  fastify.get<{
    Querystring: { q: string };
  }>("/api/marketplace/search", async (request) => {
    const { q } = request.query;

    if (!q || q.trim().length === 0) {
      return { plugins: [] };
    }

    const query = q.toLowerCase();

    try {
      const index = await getProviderIndex();

      const matchingPlugins = index.plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.author_name.toLowerCase().includes(query) ||
          (p.categories && p.categories.some((c) => c.toLowerCase().includes(query)))
      );

      return { plugins: matchingPlugins };
    } catch (err) {
      return { plugins: [], error: err instanceof Error ? err.message : String(err) };
    }
  });

  /**
   * Get plugins by category
   * GET /api/marketplace/categories/:categoryId/plugins
   */
  fastify.get<{
    Params: { categoryId: string };
  }>("/api/marketplace/categories/:categoryId/plugins", async (request) => {
    const { categoryId } = request.params;

    try {
      const index = await getProviderIndex();
      const plugins = index.plugins.filter((p) => p.categories.includes(categoryId));
      return plugins;
    } catch (err) {
      const cached = await loadFromCache();
      if (cached) {
        return cached.plugins.filter((p) => p.categories.includes(categoryId));
      }
      return [];
    }
  });
}
