import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ApiKeyInfo {
  provider_id: string;
  provider_name: string;
  has_key: boolean;
  key_prefix: string | null;
  doc_url: string | null;
}

export function useApiKeys() {
  const [providers, setProviders] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ApiKeyInfo[]>("get_api_key_providers");
      setProviders(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const setApiKey = useCallback(async (providerId: string, apiKey: string) => {
    try {
      await invoke("set_api_key", { providerId, apiKey });
      await fetchProviders(); // Refresh list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [fetchProviders]);

  const deleteApiKey = useCallback(async (providerId: string) => {
    try {
      await invoke("delete_api_key", { providerId });
      await fetchProviders(); // Refresh list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [fetchProviders]);

  const validateApiKey = useCallback(async (providerId: string, apiKey: string) => {
    try {
      const isValid = await invoke<boolean>("validate_api_key", { providerId, apiKey });
      return isValid;
    } catch {
      return false;
    }
  }, []);

  const getAllApiKeys = useCallback(async () => {
    try {
      const keys = await invoke<Record<string, string>>("get_all_api_keys");
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
