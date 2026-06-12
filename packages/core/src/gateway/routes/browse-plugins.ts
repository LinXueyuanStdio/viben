/**
 * Browse Plugins routes
 *
 * Manages browse-mcp search source plugins:
 * - Online registry discovery (cached)
 * - Local plugin installation/removal
 * - Plugin directory: ~/.viben/browse-plugins/
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir, rm, readdir, stat } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { proxyFetch } from "../../http";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface BrowsePluginRegistryEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  sources: string[];
  requires_env?: string[];
  category?: string;
  download_url: string;
}

interface BrowsePluginRegistry {
  version: string;
  plugins: BrowsePluginRegistryEntry[];
}

export interface InstalledBrowsePlugin {
  id: string;
  name: string;
  sources: string[];
  path: string;
  installed_at: string;
}

interface BrowsePluginManifest {
  name: string;
  sources: Array<{ name: string; module: string; export?: string }>;
}

// ============================================================================
// Configuration
// ============================================================================

const REGISTRY_URL = "https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/browse-sources.json";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Helper Functions
// ============================================================================

export function getBrowsePluginsDir(): string {
  return join(homedir(), ".viben", "browse-plugins");
}

function getCacheDir(): string {
  const configDir = process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "viben")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "viben")
      : join(homedir(), ".config", "viben");
  return join(configDir, "cache");
}

function getRegistryCachePath(): string {
  return join(getCacheDir(), "browse-plugins-registry.json");
}

function isCacheValid(): boolean {
  const cachePath = getRegistryCachePath();
  if (!existsSync(cachePath)) return false;
  try {
    const s = statSync(cachePath);
    return Date.now() - s.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function loadCachedRegistry(): Promise<BrowsePluginRegistry | null> {
  const cachePath = getRegistryCachePath();
  if (!existsSync(cachePath)) return null;
  try {
    return JSON.parse(await readFile(cachePath, "utf-8")) as BrowsePluginRegistry;
  } catch {
    return null;
  }
}

async function saveRegistryCache(registry: BrowsePluginRegistry): Promise<void> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
  await writeFile(getRegistryCachePath(), JSON.stringify(registry, null, 2), "utf-8");
}

async function fetchRegistry(): Promise<BrowsePluginRegistry> {
  const response = await proxyFetch(REGISTRY_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch browse plugins registry: ${response.statusText}`);
  }
  return (await response.json()) as BrowsePluginRegistry;
}

async function getRegistry(forceRefresh = false): Promise<BrowsePluginRegistry> {
  if (!forceRefresh && isCacheValid()) {
    const cached = await loadCachedRegistry();
    if (cached) return cached;
  }
  const registry = await fetchRegistry();
  await saveRegistryCache(registry);
  return registry;
}

async function scanInstalledPlugins(): Promise<InstalledBrowsePlugin[]> {
  const pluginsDir = getBrowsePluginsDir();
  if (!existsSync(pluginsDir)) return [];

  const entries = await readdir(pluginsDir, { withFileTypes: true });
  const plugins: InstalledBrowsePlugin[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginDir = join(pluginsDir, entry.name);
    const manifestPath = join(pluginDir, "browse-plugin.json");
    if (!existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as BrowsePluginManifest;
      const pluginStat = await stat(pluginDir);
      plugins.push({
        id: entry.name,
        name: manifest.name,
        sources: manifest.sources.map((s) => s.name),
        path: pluginDir,
        installed_at: pluginStat.birthtime.toISOString(),
      });
    } catch {
      // skip malformed plugins
    }
  }

  return plugins;
}

async function installPlugin(pluginId: string, downloadUrl: string): Promise<InstalledBrowsePlugin> {
  const pluginsDir = getBrowsePluginsDir();
  if (!existsSync(pluginsDir)) {
    await mkdir(pluginsDir, { recursive: true });
  }

  const pluginDir = join(pluginsDir, pluginId);
  if (existsSync(pluginDir)) {
    await rm(pluginDir, { recursive: true, force: true });
  }
  await mkdir(pluginDir, { recursive: true });

  const response = await proxyFetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download plugin: ${response.statusText}`);
  }

  const isTarball = downloadUrl.endsWith(".tar.gz") || downloadUrl.endsWith(".tgz");

  if (isTarball) {
    const tmpFile = join(pluginsDir, `${pluginId}.tar.gz`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(tmpFile, buffer);
    try {
      await execAsync(`tar -xzf "${tmpFile}" --strip-components=1 -C "${pluginDir}"`, { timeout: 30000 });
    } finally {
      await rm(tmpFile, { force: true });
    }
  } else {
    // Assume raw JS/JSON content for single-file plugins
    const content = await response.text();
    await writeFile(join(pluginDir, "index.js"), content, "utf-8");
  }

  // Verify manifest exists
  const manifestPath = join(pluginDir, "browse-plugin.json");
  if (!existsSync(manifestPath)) {
    await rm(pluginDir, { recursive: true, force: true });
    throw new Error("Plugin package does not contain browse-plugin.json manifest");
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as BrowsePluginManifest;
  return {
    id: pluginId,
    name: manifest.name,
    sources: manifest.sources.map((s) => s.name),
    path: pluginDir,
    installed_at: new Date().toISOString(),
  };
}

async function uninstallPlugin(pluginId: string): Promise<void> {
  const pluginDir = join(getBrowsePluginsDir(), pluginId);
  if (!existsSync(pluginDir)) {
    throw new Error(`Plugin not found: ${pluginId}`);
  }
  await rm(pluginDir, { recursive: true, force: true });
}

// ============================================================================
// Routes
// ============================================================================

export function registerBrowsePluginsRoutes(fastify: FastifyInstance): void {
  /**
   * Get browse plugin registry (online)
   * GET /api/browse-plugins/registry
   */
  fastify.get<{
    Querystring: { force_refresh?: string };
  }>("/api/browse-plugins/registry", async (request) => {
    const forceRefresh = request.query.force_refresh === "true";
    try {
      const registry = await getRegistry(forceRefresh);
      return registry;
    } catch (err) {
      const cached = await loadCachedRegistry();
      if (cached) return cached;
      return { version: "0.0.0", plugins: [] };
    }
  });

  /**
   * List installed browse plugins
   * GET /api/browse-plugins/installed
   */
  fastify.get("/api/browse-plugins/installed", async () => {
    const plugins = await scanInstalledPlugins();
    return { plugins, total: plugins.length };
  });

  /**
   * Get a specific installed plugin
   * GET /api/browse-plugins/:pluginId
   */
  fastify.get<{
    Params: { pluginId: string };
  }>("/api/browse-plugins/:pluginId", async (request, reply) => {
    const { pluginId } = request.params;
    const plugins = await scanInstalledPlugins();
    const plugin = plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      reply.code(404);
      return { error: `Plugin not found: ${pluginId}` };
    }
    return plugin;
  });

  /**
   * Install a browse plugin
   * POST /api/browse-plugins/install
   */
  fastify.post<{
    Body: { plugin_id: string; download_url: string };
  }>("/api/browse-plugins/install", async (request, reply) => {
    const { plugin_id, download_url } = request.body;
    if (!plugin_id || !download_url) {
      reply.code(400);
      return { error: "plugin_id and download_url are required" };
    }

    try {
      const installed = await installPlugin(plugin_id, download_url);
      return { success: true, plugin: installed };
    } catch (err) {
      reply.code(500);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  /**
   * Uninstall a browse plugin
   * DELETE /api/browse-plugins/:pluginId
   */
  fastify.delete<{
    Params: { pluginId: string };
  }>("/api/browse-plugins/:pluginId", async (request, reply) => {
    const { pluginId } = request.params;
    try {
      await uninstallPlugin(pluginId);
      return { success: true, deleted: pluginId };
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        reply.code(404);
      } else {
        reply.code(500);
      }
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });
}
