import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ServiceApiKey {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  created_at: string;
  last_used: string | null;
}

export function useServiceKeys() {
  const [keys, setKeys] = useState<ServiceApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<ServiceApiKey[]>("get_service_keys");
      setKeys(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createKey = useCallback(async (name: string) => {
    try {
      const newKey = await invoke<ServiceApiKey>("create_service_key", { name });
      await fetchKeys();
      return newKey;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [fetchKeys]);

  const deleteKey = useCallback(async (keyId: string) => {
    try {
      await invoke("delete_service_key", { keyId });
      await fetchKeys();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [fetchKeys]);

  const getKeyById = useCallback(async (keyId: string): Promise<ServiceApiKey | null> => {
    try {
      const result = await invoke<ServiceApiKey | null>("get_service_key_by_id", { keyId });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  return {
    keys,
    loading,
    error,
    createKey,
    deleteKey,
    getKeyById,
    refresh: fetchKeys,
  };
}
