/**
 * Hook for managing viben-core Providers via Tauri commands
 */
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types (matching Rust viben-core types)
// ============================================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "azure"
  | "ollama"
  | "openrouter"
  | "custom";

export interface Provider {
  id: string;
  provider_type: ProviderType;
  name: string;
  api_key?: string;
  base_url?: string;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderOptions {
  provider_type: ProviderType;
  name: string;
  api_key?: string;
  base_url?: string;
  set_as_default?: boolean;
}

export interface ProviderUpdate {
  name?: string;
  provider_type?: ProviderType;
  api_key?: string;
  base_url?: string;
}

export interface ProviderStatus {
  id: string;
  connected: boolean;
  latency?: number;
  error?: string;
  checked_at: string;
}

// Default base URLs for provider types
export const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  azure: "",
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

// Provider type display names
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  azure: "Azure OpenAI",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  custom: "Custom",
};

// ============================================================================
// Hook
// ============================================================================

export interface UseVibenProvidersReturn {
  // Data
  providers: Provider[];
  defaultProviderId: string | null;
  statuses: Record<string, ProviderStatus>;

  // Loading states
  loading: boolean;
  error: string | null;
  testingId: string | null;

  // Actions
  refresh: () => Promise<void>;
  createProvider: (options: CreateProviderOptions) => Promise<Provider>;
  updateProvider: (id: string, updates: ProviderUpdate) => Promise<Provider>;
  removeProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<void>;
  enableProvider: (id: string) => Promise<void>;
  disableProvider: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<ProviderStatus>;
}

export function useVibenProviders(): UseVibenProvidersReturn {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Load providers and default
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providersList, defaultId] = await Promise.all([
        invoke<Provider[]>("viben_list_providers"),
        invoke<string | null>("viben_get_default_provider"),
      ]);
      setProviders(providersList);
      setDefaultProviderId(defaultId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create provider
  const createProvider = useCallback(async (options: CreateProviderOptions): Promise<Provider> => {
    setError(null);
    try {
      const provider = await invoke<Provider>("viben_create_provider", { options });
      // Refresh list to get updated state
      await refresh();
      return provider;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [refresh]);

  // Update provider
  const updateProvider = useCallback(async (id: string, updates: ProviderUpdate): Promise<Provider> => {
    setError(null);
    try {
      const provider = await invoke<Provider>("viben_update_provider", { id, updates });
      // Update local state
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? provider : p))
      );
      return provider;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Remove provider
  const removeProvider = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_remove_provider", { id });
      // Update local state
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      // Refresh to get updated default
      if (defaultProviderId === id) {
        const newDefault = await invoke<string | null>("viben_get_default_provider");
        setDefaultProviderId(newDefault);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [defaultProviderId]);

  // Set default provider
  const setDefaultProvider = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_set_default_provider", { id });
      setDefaultProviderId(id);
      // Update local state to reflect new default
      setProviders((prev) =>
        prev.map((p) => ({
          ...p,
          is_default: p.id === id,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Enable provider
  const enableProvider = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_enable_provider", { id });
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: true } : p))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Disable provider
  const disableProvider = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_disable_provider", { id });
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: false } : p))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Test connection
  const testConnection = useCallback(async (id: string): Promise<ProviderStatus> => {
    setTestingId(id);
    setError(null);
    try {
      const status = await invoke<ProviderStatus>("viben_test_provider_connection", { id });
      setStatuses((prev) => ({ ...prev, [id]: status }));
      return status;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Create error status
      const errorStatus: ProviderStatus = {
        id,
        connected: false,
        error: message,
        checked_at: new Date().toISOString(),
      };
      setStatuses((prev) => ({ ...prev, [id]: errorStatus }));
      return errorStatus;
    } finally {
      setTestingId(null);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    providers,
    defaultProviderId,
    statuses,
    loading,
    error,
    testingId,
    refresh,
    createProvider,
    updateProvider,
    removeProvider,
    setDefaultProvider,
    enableProvider,
    disableProvider,
    testConnection,
  };
}
