import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// Types matching Rust backend
export interface DailyUsage {
  date: string;
  total_requests: number;
  by_source: Record<string, number>;
  by_api_key: Record<string, number>;
  by_server: Record<string, number>;
}

export interface ActivityDay {
  date: string;
  count: number;
  level: number; // 0-4
}

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

export interface ApiKeyUsage {
  key_id: string;
  usage_count: number;
  last_used: string | null;
}

export function useUsage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize usage tracking
  const init = useCallback(async () => {
    try {
      await invoke("init_usage");
      setInitialized(true);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  // Fetch usage stats
  const fetchStats = useCallback(async () => {
    if (!initialized) return;

    setLoading(true);
    try {
      const data = await invoke<UsageStats>("get_usage_stats");
      setStats(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  // Record a usage event
  const recordUsage = useCallback(
    async (serverId: string, sourceId: string, apiKeyId?: string) => {
      try {
        await invoke("record_usage", {
          server_id: serverId,
          source_id: sourceId,
          api_key_id: apiKeyId,
        });
        // Refresh stats
        await fetchStats();
      } catch (err) {
        console.error("Failed to record usage:", err);
      }
    },
    [fetchStats]
  );

  // Get usage for specific API key
  const getApiKeyUsage = useCallback(async (keyId: string): Promise<ApiKeyUsage | null> => {
    try {
      return await invoke<ApiKeyUsage>("get_api_key_usage", { key_id: keyId });
    } catch (err) {
      console.error("Failed to get API key usage:", err);
      return null;
    }
  }, []);

  // Get usage for specific server
  const getServerUsage = useCallback(async (serverId: string): Promise<number> => {
    try {
      return await invoke<number>("get_server_usage", { server_id: serverId });
    } catch (err) {
      console.error("Failed to get server usage:", err);
      return 0;
    }
  }, []);

  // Get usage for specific source
  const getSourceUsage = useCallback(async (sourceId: string): Promise<number> => {
    try {
      return await invoke<number>("get_source_usage", { source_id: sourceId });
    } catch (err) {
      console.error("Failed to get source usage:", err);
      return 0;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    init();
  }, [init]);

  // Fetch stats when initialized
  useEffect(() => {
    if (initialized) {
      fetchStats();
    }
  }, [initialized, fetchStats]);

  return {
    stats,
    loading,
    error,
    recordUsage,
    getApiKeyUsage,
    getServerUsage,
    getSourceUsage,
    refreshStats: fetchStats,
  };
}
