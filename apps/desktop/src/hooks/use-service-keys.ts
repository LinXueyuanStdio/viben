import { useState, useEffect, useCallback } from "react";
import { getGatewayClient, type ServiceApiKey } from "@/lib/gateway";

export type { ServiceApiKey };

export function useServiceKeys() {
  const [keys, setKeys] = useState<ServiceApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = getGatewayClient();
      const result = await client.getServiceKeys();
      setKeys(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createKey = useCallback(async (name: string) => {
    try {
      const client = getGatewayClient();
      const newKey = await client.createServiceKey(name);
      await fetchKeys();
      return newKey;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [fetchKeys]);

  const deleteKey = useCallback(async (keyId: string) => {
    try {
      const client = getGatewayClient();
      await client.deleteServiceKey(keyId);
      await fetchKeys();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [fetchKeys]);

  const getKeyById = useCallback(async (keyId: string): Promise<ServiceApiKey | null> => {
    try {
      const client = getGatewayClient();
      return await client.getServiceKeyById(keyId);
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
