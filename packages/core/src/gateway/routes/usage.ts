/**
 * Usage tracking routes
 *
 * Provides HTTP API for tracking and retrieving usage statistics.
 * Data is stored in ~/.viben/usage.json
 */
import type { FastifyInstance } from "fastify";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ============================================================================
// Types
// ============================================================================

interface DailyUsage {
  date: string;
  total_requests: number;
  by_source: Record<string, number>;
  by_api_key: Record<string, number>;
  by_server: Record<string, number>;
}

interface ActivityDay {
  date: string;
  count: number;
  level: number; // 0-4
}

interface UsageStats {
  total_requests: number;
  today_requests: number;
  this_week_requests: number;
  this_month_requests: number;
  by_source: Record<string, number>;
  by_api_key: Record<string, number>;
  by_server: Record<string, number>;
  daily_usage: DailyUsage[];
  activity_heatmap: ActivityDay[];
}

interface ApiKeyUsage {
  key_id: string;
  usage_count: number;
  last_used: string | null;
}

interface UsageStore {
  daily_usage: DailyUsage[];
  api_key_last_used: Record<string, string>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the usage file path
 */
function getUsageFilePath(): string {
  const configDir = process.platform === "darwin"
    ? join(homedir(), "Library", "Application Support", "viben")
    : process.platform === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "viben")
      : join(homedir(), ".config", "viben");

  return join(configDir, "usage.json");
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get date N days ago
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

/**
 * Get the start of the current week (Sunday)
 */
function getWeekStart(): string {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date.toISOString().split("T")[0];
}

/**
 * Get the start of the current month
 */
function getMonthStart(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split("T")[0];
}

/**
 * Load usage data from file
 */
async function loadUsageData(): Promise<UsageStore> {
  const path = getUsageFilePath();
  try {
    if (!existsSync(path)) {
      return { daily_usage: [], api_key_last_used: {} };
    }
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as UsageStore;
  } catch {
    return { daily_usage: [], api_key_last_used: {} };
  }
}

/**
 * Save usage data to file
 */
async function saveUsageData(data: UsageStore): Promise<void> {
  const path = getUsageFilePath();
  const dir = join(path, "..");

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Get or create today's usage record
 */
function getOrCreateTodayUsage(data: UsageStore): DailyUsage {
  const today = getTodayDate();
  let todayUsage = data.daily_usage.find((d) => d.date === today);

  if (!todayUsage) {
    todayUsage = {
      date: today,
      total_requests: 0,
      by_source: {},
      by_api_key: {},
      by_server: {},
    };
    data.daily_usage.push(todayUsage);
  }

  return todayUsage;
}

/**
 * Calculate activity level (0-4) based on count
 */
function calculateActivityLevel(count: number, maxCount: number): number {
  if (count === 0) return 0;
  if (maxCount === 0) return 1;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Generate activity heatmap for the last 365 days
 */
function generateActivityHeatmap(dailyUsage: DailyUsage[]): ActivityDay[] {
  const heatmap: ActivityDay[] = [];
  const usageMap = new Map(dailyUsage.map((d) => [d.date, d.total_requests]));

  // Find max count for level calculation
  const maxCount = Math.max(...dailyUsage.map((d) => d.total_requests), 0);

  // Generate entries for last 365 days
  for (let i = 364; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    const count = usageMap.get(date) || 0;
    heatmap.push({
      date,
      count,
      level: calculateActivityLevel(count, maxCount),
    });
  }

  return heatmap;
}

/**
 * Calculate usage stats from stored data
 */
function calculateStats(data: UsageStore): UsageStats {
  const today = getTodayDate();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  let totalRequests = 0;
  let todayRequests = 0;
  let weekRequests = 0;
  let monthRequests = 0;
  const bySource: Record<string, number> = {};
  const byApiKey: Record<string, number> = {};
  const byServer: Record<string, number> = {};

  for (const day of data.daily_usage) {
    totalRequests += day.total_requests;

    if (day.date === today) {
      todayRequests = day.total_requests;
    }

    if (day.date >= weekStart) {
      weekRequests += day.total_requests;
    }

    if (day.date >= monthStart) {
      monthRequests += day.total_requests;
    }

    // Aggregate by source
    for (const [source, count] of Object.entries(day.by_source)) {
      bySource[source] = (bySource[source] || 0) + count;
    }

    // Aggregate by API key
    for (const [key, count] of Object.entries(day.by_api_key)) {
      byApiKey[key] = (byApiKey[key] || 0) + count;
    }

    // Aggregate by server
    for (const [server, count] of Object.entries(day.by_server)) {
      byServer[server] = (byServer[server] || 0) + count;
    }
  }

  return {
    total_requests: totalRequests,
    today_requests: todayRequests,
    this_week_requests: weekRequests,
    this_month_requests: monthRequests,
    by_source: bySource,
    by_api_key: byApiKey,
    by_server: byServer,
    daily_usage: data.daily_usage.slice(-30), // Last 30 days
    activity_heatmap: generateActivityHeatmap(data.daily_usage),
  };
}

// ============================================================================
// Routes
// ============================================================================

export function registerUsageRoutes(fastify: FastifyInstance): void {
  /**
   * Initialize usage tracking
   * POST /api/usage/init
   */
  fastify.post("/api/usage/init", async () => {
    // Ensure the usage file exists
    const data = await loadUsageData();
    await saveUsageData(data);
    return { initialized: true };
  });

  /**
   * Get usage statistics
   * GET /api/usage/stats
   */
  fastify.get("/api/usage/stats", async () => {
    const data = await loadUsageData();
    return calculateStats(data);
  });

  /**
   * Record a usage event
   * POST /api/usage/record
   */
  fastify.post<{
    Body: {
      server_id: string;
      source_id: string;
      api_key_id?: string;
    };
  }>("/api/usage/record", async (request) => {
    const { server_id, source_id, api_key_id } = request.body;

    const data = await loadUsageData();
    const todayUsage = getOrCreateTodayUsage(data);

    // Increment counters
    todayUsage.total_requests++;

    if (source_id) {
      todayUsage.by_source[source_id] = (todayUsage.by_source[source_id] || 0) + 1;
    }

    if (api_key_id) {
      todayUsage.by_api_key[api_key_id] = (todayUsage.by_api_key[api_key_id] || 0) + 1;
      data.api_key_last_used[api_key_id] = new Date().toISOString();
    }

    if (server_id) {
      todayUsage.by_server[server_id] = (todayUsage.by_server[server_id] || 0) + 1;
    }

    await saveUsageData(data);
    return { recorded: true };
  });

  /**
   * Get usage for a specific API key
   * GET /api/usage/api-key/:keyId
   */
  fastify.get<{
    Params: { keyId: string };
  }>("/api/usage/api-key/:keyId", async (request) => {
    const { keyId } = request.params;
    const data = await loadUsageData();

    // Calculate total usage for this key
    let usageCount = 0;
    for (const day of data.daily_usage) {
      usageCount += day.by_api_key[keyId] || 0;
    }

    const result: ApiKeyUsage = {
      key_id: keyId,
      usage_count: usageCount,
      last_used: data.api_key_last_used[keyId] || null,
    };

    return result;
  });

  /**
   * Get usage for a specific server
   * GET /api/usage/server/:serverId
   */
  fastify.get<{
    Params: { serverId: string };
  }>("/api/usage/server/:serverId", async (request) => {
    const { serverId } = request.params;
    const data = await loadUsageData();

    // Calculate total usage for this server
    let usageCount = 0;
    for (const day of data.daily_usage) {
      usageCount += day.by_server[serverId] || 0;
    }

    return { server_id: serverId, usage_count: usageCount };
  });

  /**
   * Get usage for a specific source
   * GET /api/usage/source/:sourceId
   */
  fastify.get<{
    Params: { sourceId: string };
  }>("/api/usage/source/:sourceId", async (request) => {
    const { sourceId } = request.params;
    const data = await loadUsageData();

    // Calculate total usage for this source
    let usageCount = 0;
    for (const day of data.daily_usage) {
      usageCount += day.by_source[sourceId] || 0;
    }

    return { source_id: sourceId, usage_count: usageCount };
  });
}
