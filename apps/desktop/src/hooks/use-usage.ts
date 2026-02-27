import { useState, useEffect, useCallback } from "react";
import { getGatewayClient, type UsageStats, type ApiKeyUsage, type DailyUsage, type ActivityDay } from "@/lib/gateway";

export type { UsageStats, ApiKeyUsage, DailyUsage, ActivityDay };

export function useUsage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize usage tracking
  const init = useCallback(async () => {
    try {
      const client = getGatewayClient();
      await client.initUsage();
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
      const client = getGatewayClient();
      const data = await client.getUsageStats();
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
        const client = getGatewayClient();
        await client.recordUsage(serverId, sourceId, apiKeyId);
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
      const client = getGatewayClient();
      return await client.getApiKeyUsage(keyId);
    } catch (err) {
      console.error("Failed to get API key usage:", err);
      return null;
    }
  }, []);

  // Get usage for specific server
  const getServerUsage = useCallback(async (serverId: string): Promise<number> => {
    try {
      const client = getGatewayClient();
      return await client.getServerUsage(serverId);
    } catch (err) {
      console.error("Failed to get server usage:", err);
      return 0;
    }
  }, []);

  // Get usage for specific source
  const getSourceUsage = useCallback(async (sourceId: string): Promise<number> => {
    try {
      const client = getGatewayClient();
      return await client.getSourceUsage(sourceId);
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
