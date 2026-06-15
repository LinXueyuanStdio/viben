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
