/**
 * Hook for managing Providers via Gateway HTTP API
 */
import { useState, useEffect, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type { ProviderResponse } from "@/lib/gateway";

// ============================================================================
// Types (matching Rust viben-core types)
// ============================================================================

export type ProviderType =
  | "openai"
  | "anthropic"
  | "azure"
  | "ollama"
  | "openrouter"
  | "google"
  | "custom";

export interface Provider {
  id: string;
  provider_type: ProviderType;
  name: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
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
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  set_as_default?: boolean;
}

export interface ProviderUpdate {
  name?: string;
  provider_type?: ProviderType;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
}

export interface ProviderStatus {
  id: string;
  connected: boolean;
  latency?: number;
  error?: string;
  checked_at: string;
}

// Helper to transform gateway response to hook format
function transformProviderResponse(response: ProviderResponse): Provider {
  return {
    id: response.id,
    provider_type: response.type as ProviderType,
    name: response.name,
    api_key: response.api_key,
    base_url: response.base_url,
    api_version: response.api_version,
    deployment: response.deployment,
    timeout: response.timeout,
    max_retries: response.max_retries,
    headers: response.headers,
    is_default: response.is_default,
    enabled: response.enabled,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

// Default base URLs for provider types
export const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  azure: "",
  ollama: "http://localhost:11434",
  openrouter: "https://openrouter.ai/api/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  custom: "",
};

// Provider type display names
export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  azure: "Azure OpenAI",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  google: "Google AI",
  custom: "Custom",
};

// ============================================================================
// Hook
// ============================================================================

export interface UseProvidersReturn {
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

export function useProviders(): UseProvidersReturn {
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
      const client = getGatewayClient();
      const response = await client.listProviders();
      const providersList = response.providers.map(transformProviderResponse);
      setProviders(providersList);
      setDefaultProviderId(response.default_provider_id);
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
      const client = getGatewayClient();
      const response = await client.createProvider({
        type: options.provider_type,
        name: options.name,
        apiKey: options.api_key,
        baseUrl: options.base_url,
        apiVersion: options.api_version,
        deployment: options.deployment,
        timeout: options.timeout,
        maxRetries: options.max_retries,
        headers: options.headers,
        setAsDefault: options.set_as_default,
      });
      const provider = transformProviderResponse(response);
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
      const client = getGatewayClient();
      const response = await client.updateProvider(id, {
        type: updates.provider_type,
        name: updates.name,
        apiKey: updates.api_key,
        baseUrl: updates.base_url,
        apiVersion: updates.api_version,
        deployment: updates.deployment,
        timeout: updates.timeout,
        maxRetries: updates.max_retries,
        headers: updates.headers,
      });
      const provider = transformProviderResponse(response);
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
      const client = getGatewayClient();
      await client.deleteProvider(id);
      // Update local state
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      // Refresh to get updated default
      if (defaultProviderId === id) {
        const response = await client.getDefaultProvider();
        setDefaultProviderId(response.default_provider_id);
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
      const client = getGatewayClient();
      await client.setDefaultProvider(id);
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
      const client = getGatewayClient();
      await client.enableProvider(id);
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
      const client = getGatewayClient();
      await client.disableProvider(id);
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
      const client = getGatewayClient();
      const gatewayStatus = await client.testProvider(id);
      const status: ProviderStatus = {
        id: gatewayStatus.provider_id,
        connected: gatewayStatus.connected,
        latency: gatewayStatus.latency,
        error: gatewayStatus.error,
        checked_at: gatewayStatus.checked_at,
      };
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
