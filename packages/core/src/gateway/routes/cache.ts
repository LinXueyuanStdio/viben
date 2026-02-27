/**
 * Cache/Offline routes
 *
 * Provides HTTP API for managing offline cache status and settings.
 * Data is stored in ~/.viben/cache/ directory.
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir, readdir, stat, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import https from "node:https";
import http from "node:http";

// ============================================================================
// Types
// ============================================================================

interface CacheInfo {
  cache_dir: string;
  total_size_bytes: number;
  mcp_packages_cached: number;
  skills_packages_cached: number;
  last_updated: string | null;
}

interface CacheSettings {
  enabled: boolean;
  auto_refresh: boolean;
  refresh_interval_hours: number;
  max_size_mb: number;
}

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
 * Get the cache settings file path
 */
function getCacheSettingsPath(): string {
  const configDir = process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "viben")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "viben")
      : join(homedir(), ".config", "viben");

  return join(configDir, "cache-settings.json");
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }
}

/**
 * Get default cache settings
 */
function getDefaultCacheSettings(): CacheSettings {
  return {
    enabled: true,
    auto_refresh: true,
    refresh_interval_hours: 24,
    max_size_mb: 100,
  };
}

/**
 * Load cache settings
 */
async function loadCacheSettings(): Promise<CacheSettings> {
  const settingsPath = getCacheSettingsPath();
  try {
    if (!existsSync(settingsPath)) {
      return getDefaultCacheSettings();
    }
    const content = await readFile(settingsPath, "utf-8");
    return { ...getDefaultCacheSettings(), ...JSON.parse(content) };
  } catch {
    return getDefaultCacheSettings();
  }
}

/**
 * Save cache settings
 */
async function saveCacheSettings(settings: CacheSettings): Promise<void> {
  const settingsPath = getCacheSettingsPath();
  const dir = join(settingsPath, "..");

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Calculate directory size recursively
 */
async function getDirSize(dir: string): Promise<number> {
  let size = 0;

  if (!existsSync(dir)) {
    return size;
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isFile()) {
        const stats = await stat(entryPath);
        size += stats.size;
      } else if (entry.isDirectory()) {
        size += await getDirSize(entryPath);
      }
    }
  } catch {
    // Ignore errors
  }

  return size;
}

/**
 * Count packages in a directory
 */
async function countPackages(dir: string): Promise<number> {
  if (!existsSync(dir)) {
    return 0;
  }

  try {
    const entries = await readdir(dir);
    return entries.length;
  } catch {
    return 0;
  }
}

/**
 * Get latest modification time in a directory
 */
async function getLatestModTime(dir: string): Promise<Date | null> {
  if (!existsSync(dir)) {
    return null;
  }

  let latestTime: Date | null = null;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      const stats = await stat(entryPath);
      if (!latestTime || stats.mtime > latestTime) {
        latestTime = stats.mtime;
      }
    }
  } catch {
    // Ignore errors
  }

  return latestTime;
}

/**
 * Check if offline
 */
async function checkOfflineStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: "raw.githubusercontent.com",
      port: 443,
      path: "/",
      method: "HEAD",
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      resolve(false); // Online
    });

    req.on("error", () => {
      resolve(true); // Offline
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(true); // Offline
    });

    req.end();
  });
}

/**
 * Get cache info
 */
async function getCacheInfo(): Promise<CacheInfo> {
  const cacheDir = getCacheDir();
  await ensureCacheDir();

  const mcpDir = join(cacheDir, "mcp");
  const skillsDir = join(cacheDir, "skills");

  const [totalSize, mcpCount, skillsCount, lastUpdated] = await Promise.all([
    getDirSize(cacheDir),
    countPackages(mcpDir),
    countPackages(skillsDir),
    getLatestModTime(cacheDir),
  ]);

  return {
    cache_dir: cacheDir,
    total_size_bytes: totalSize,
    mcp_packages_cached: mcpCount,
    skills_packages_cached: skillsCount,
    last_updated: lastUpdated?.toISOString() ?? null,
  };
}

/**
 * Check if cache should be refreshed
 */
async function shouldRefreshCache(): Promise<boolean> {
  const settings = await loadCacheSettings();

  if (!settings.enabled || !settings.auto_refresh) {
    return false;
  }

  const cacheDir = getCacheDir();
  const lastUpdated = await getLatestModTime(cacheDir);

  if (!lastUpdated) {
    return true; // No cache, should refresh
  }

  const ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  return ageHours >= settings.refresh_interval_hours;
}

// ============================================================================
// Routes
// ============================================================================

export function registerCacheRoutes(fastify: FastifyInstance): void {
  /**
   * Check if offline
   * GET /api/cache/offline
   */
  fastify.get("/api/cache/offline", async () => {
    const isOffline = await checkOfflineStatus();
    return { offline: isOffline };
  });

  /**
   * Get cache info
   * GET /api/cache/info
   */
  fastify.get("/api/cache/info", async () => {
    return await getCacheInfo();
  });

  /**
   * Get cache settings
   * GET /api/cache/settings
   */
  fastify.get("/api/cache/settings", async () => {
    return await loadCacheSettings();
  });

  /**
   * Update cache settings
   * PUT /api/cache/settings
   */
  fastify.put<{
    Body: Partial<CacheSettings>;
  }>("/api/cache/settings", async (request) => {
    const currentSettings = await loadCacheSettings();
    const newSettings = { ...currentSettings, ...request.body };
    await saveCacheSettings(newSettings);
    return newSettings;
  });

  /**
   * Refresh cache
   * POST /api/cache/refresh
   */
  fastify.post("/api/cache/refresh", async (request, reply) => {
    const isOffline = await checkOfflineStatus();

    if (isOffline) {
      reply.code(503);
      return { error: "Cannot refresh cache: offline" };
    }

    // For now, just return success
    // A more complete implementation would actually refresh cached data
    return { refreshed: true };
  });

  /**
   * Clear cache
   * DELETE /api/cache
   */
  fastify.delete("/api/cache", async () => {
    const cacheDir = getCacheDir();

    if (existsSync(cacheDir)) {
      // Remove all contents but keep the directory
      const entries = await readdir(cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = join(cacheDir, entry.name);
        await rm(entryPath, { recursive: true, force: true });
      }
    }

    return { cleared: true };
  });

  /**
   * Check if cache should be refreshed
   * GET /api/cache/should-refresh
   */
  fastify.get("/api/cache/should-refresh", async () => {
    const shouldRefresh = await shouldRefreshCache();
    return { should_refresh: shouldRefresh };
  });
}
