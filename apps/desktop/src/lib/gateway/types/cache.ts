/**
 * Cache Types
 * 缓存类型定义
 */

// ============================================================================
// Cache Info Types
// ============================================================================

/** Cache info */
export interface CacheInfo {
  cache_dir: string;
  total_size_bytes: number;
  mcp_packages_cached: number;
  skills_packages_cached: number;
  last_updated: string | null;
}

/** Cache settings */
export interface CacheSettings {
  enabled: boolean;
  auto_refresh: boolean;
  refresh_interval_hours: number;
  max_size_mb: number;
}

// ============================================================================
// Usage Types
// ============================================================================

/** Daily usage data */
export interface DailyUsage {
  date: string;
  total_requests: number;
  by_source: Record<string, number>;
  by_api_key: Record<string, number>;
  by_server: Record<string, number>;
}

/** Activity day for heatmap */
export interface ActivityDay {
  date: string;
  count: number;
  level: number; // 0-4
}

/** Usage statistics */
export interface UsageStats {
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

/** API key usage info */
export interface ApiKeyUsage {
  key_id: string;
  usage_count: number;
  last_used: string | null;
}
