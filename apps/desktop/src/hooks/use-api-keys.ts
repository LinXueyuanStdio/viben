import { useState, useEffect, useCallback } from "react";
import { getGatewayClient, type ApiKeyInfo } from "@/lib/gateway";

export type { ApiKeyInfo };

export function useApiKeys() {
  const [providers, setProviders] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const result = await client.getApiKeyProviders();
      setProviders(result.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const setApiKey = useCallback(async (providerId: string, apiKey: string) => {
    try {
      const client = getGatewayClient();
      await client.setApiKey(providerId, apiKey);
      await fetchProviders(); // Refresh list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [fetchProviders]);

  const deleteApiKey = useCallback(async (providerId: string) => {
    try {
      const client = getGatewayClient();
      await client.deleteApiKey(providerId);
      await fetchProviders(); // Refresh list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [fetchProviders]);

  const validateApiKey = useCallback(async (providerId: string, apiKey: string) => {
    try {
      const client = getGatewayClient();
      const result = await client.validateApiKey(providerId, apiKey);
      return result.valid;
    } catch {
      return false;
    }
  }, []);

  const getAllApiKeys = useCallback(async () => {
    try {
      const client = getGatewayClient();
      const keys = await client.getAllApiKeys();
      return keys;
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    providers,
    loading,
    error,
    setApiKey,
    deleteApiKey,
    validateApiKey,
    getAllApiKeys,
    refresh: fetchProviders,
  };
}
