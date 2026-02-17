/**
 * Hook for managing channel instances via Gateway API
 *
 * Supports multiple instances of the same channel type.
 * Data is stored in ~/.viben/channels.yaml via Gateway.
 *
 * Uses a Zustand store for caching to enable pre-loading:
 * - Call syncChannels() to pre-load data before entering the page
 * - useChannelInstances() uses cached data when available
 */

import { useState, useEffect, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";
import { useChannelStore } from "@/stores/channel-store";
import type {
  ChannelType,
  GatewayChannel,
  CreateChannelRequest,
  UpdateChannelRequest,
  ListChannelsResponse,
  ChannelConfig,
  AgentBinding,
} from "@/types/channel";

/**
 * Helper to make API requests to the gateway
 */
async function gatewayFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const client = getGatewayClient();
  const baseUrl = client.getBaseUrl();

  // Build headers - only set Content-Type for requests with body
  const headers: HeadersInit = {
    Accept: "application/json",
    ...options?.headers,
  };

  // For POST/PUT/PATCH requests, always send JSON body (empty object if no body provided)
  const method = options?.method?.toUpperCase();
  const needsBody = method === "POST" || method === "PUT" || method === "PATCH";
  let body = options?.body;

  if (needsBody) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
    // If no body provided, send empty JSON object to avoid "Body cannot be empty" error
    if (!body) {
      body = "{}";
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json();
      errorMessage =
        errorBody?.error?.message ||
        errorBody?.message ||
        JSON.stringify(errorBody);
    } catch {
      // Keep statusText as fallback
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Sync channels from gateway to store
 * Call this to pre-load channel data before entering the settings page
 *
 * @param force - If true, fetch even if already loaded
 */
export async function syncChannels(force = false): Promise<void> {
  const store = useChannelStore.getState();

  // Skip if already loading
  if (store.syncTask.status === "loading") {
    console.log("[syncChannels] Already loading, skipping...");
    return;
  }

  // Skip if already loaded (unless forced)
  if (!force && store.hasLoadedOnce()) {
    console.log("[syncChannels] Already loaded, skipping...");
    return;
  }

  console.log("[syncChannels] Starting channel sync...");
  store.startSync();

  try {
    const data = await gatewayFetch<ListChannelsResponse>("/api/channels");
    console.log("[syncChannels] Loaded channels:", data.channels?.length ?? 0);
    store.completeSync(data.channels || []);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to sync channels";
    console.error("[syncChannels] Failed:", message);
    store.failSync(message);
  }
}

export interface UseChannelInstancesReturn {
  /** All channel instances */
  instances: GatewayChannel[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh instances from server */
  refresh: () => Promise<void>;
  /** Get instances by type */
  getInstancesByType: (type: ChannelType) => GatewayChannel[];
  /** Get instance by ID */
  getInstance: (id: string) => GatewayChannel | undefined;
  /** Get enabled instances */
  getEnabledInstances: () => GatewayChannel[];
  /** Get default instance */
  getDefaultInstance: () => GatewayChannel | undefined;
  /** Create new instance */
  createInstance: (
    type: ChannelType,
    name: string,
    config?: ChannelConfig,
    agentBinding?: AgentBinding
  ) => Promise<GatewayChannel | null>;
  /** Update instance */
  updateInstance: (
    id: string,
    update: UpdateChannelRequest
  ) => Promise<GatewayChannel | null>;
  /** Delete instance */
  deleteInstance: (id: string) => Promise<boolean>;
  /** Toggle instance enabled state */
  toggleInstance: (id: string) => Promise<boolean>;
  /** Set as default channel */
  setDefault: (id: string) => Promise<GatewayChannel | null>;
}

export function useChannelInstances(): UseChannelInstancesReturn {
  const [error, setError] = useState<string | null>(null);

  // Get data from store
  const instances = useChannelStore((s) => s.channels);
  const syncStatus = useChannelStore((s) => s.syncTask.status);
  const syncError = useChannelStore((s) => s.syncTask.error);

  // Consider loading if:
  // - status is "loading", OR
  // - status is "idle" and we haven't loaded yet (show loading until first sync completes)
  const isLoading = syncStatus === "loading" || syncStatus === "idle";

  // Load instances (uses store sync)
  const loadInstances = useCallback(async () => {
    setError(null);
    await syncChannels(true); // Force refresh
  }, []);

  // Initialize: load on mount if not already loaded
  useEffect(() => {
    const store = useChannelStore.getState();
    if (!store.hasLoadedOnce() && store.syncTask.status !== "loading") {
      console.log("[useChannelInstances] Initial load...");
      syncChannels();
    }
  }, []);

  // Sync error state from store
  useEffect(() => {
    if (syncError) {
      setError(syncError);
    }
  }, [syncError]);

  const getInstancesByType = useCallback(
    (type: ChannelType) => instances.filter((i) => i.channel_type === type),
    [instances]
  );

  const getInstance = useCallback(
    (id: string) => instances.find((i) => i.id === id),
    [instances]
  );

  const getEnabledInstances = useCallback(
    () => instances.filter((i) => i.enabled),
    [instances]
  );

  const getDefaultInstance = useCallback(
    () => instances.find((i) => i.is_default),
    [instances]
  );

  const createInstance = useCallback(
    async (
      type: ChannelType,
      name: string,
      config?: ChannelConfig,
      agentBinding?: AgentBinding
    ): Promise<GatewayChannel | null> => {
      try {
        const request: CreateChannelRequest = {
          channel_type: type,
          name,
          config,
          agent_binding: agentBinding,
        };
        const result = await gatewayFetch<GatewayChannel>("/api/channels", {
          method: "POST",
          body: JSON.stringify(request),
        });
        // Refresh the list
        await syncChannels(true);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create channel";
        setError(message);
        console.error("Failed to create channel instance:", err);
        return null;
      }
    },
    []
  );

  const updateInstance = useCallback(
    async (
      id: string,
      update: UpdateChannelRequest
    ): Promise<GatewayChannel | null> => {
      try {
        const result = await gatewayFetch<GatewayChannel>(
          `/api/channels/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify(update),
          }
        );
        // Refresh the list
        await syncChannels(true);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update channel";
        setError(message);
        console.error("Failed to update channel instance:", err);
        return null;
      }
    },
    []
  );

  const deleteInstance = useCallback(async (id: string): Promise<boolean> => {
    try {
      await gatewayFetch(`/api/channels/${id}`, {
        method: "DELETE",
      });
      // Refresh the list
      await syncChannels(true);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete channel";
      setError(message);
      console.error("Failed to delete channel instance:", err);
      return false;
    }
  }, []);

  const toggleInstance = useCallback(
    async (id: string): Promise<boolean> => {
      const instance = instances.find((i) => i.id === id);
      if (!instance) return false;

      const result = await updateInstance(id, { enabled: !instance.enabled });
      return result !== null;
    },
    [instances, updateInstance]
  );

  const setDefault = useCallback(
    async (id: string): Promise<GatewayChannel | null> => {
      try {
        const result = await gatewayFetch<GatewayChannel>(
          `/api/channels/${id}/default`,
          {
            method: "POST",
          }
        );
        // Refresh the list
        await syncChannels(true);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to set default channel";
        setError(message);
        console.error("Failed to set default channel:", err);
        return null;
      }
    },
    []
  );

  return {
    instances,
    isLoading,
    error,
    refresh: loadInstances,
    getInstancesByType,
    getInstance,
    getEnabledInstances,
    getDefaultInstance,
    createInstance,
    updateInstance,
    deleteInstance,
    toggleInstance,
    setDefault,
  };
}

// ============================================================================
// Separate hooks for specific operations (following use-cron.ts pattern)
// ============================================================================

/**
 * Hook to create a new channel
 */
export function useCreateChannel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createChannel = useCallback(
    async (data: CreateChannelRequest): Promise<GatewayChannel | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await gatewayFetch<GatewayChannel>("/api/channels", {
          method: "POST",
          body: JSON.stringify(data),
        });
        // Sync to store
        await syncChannels(true);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create channel";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createChannel, loading, error };
}

/**
 * Hook to update a channel
 */
export function useUpdateChannel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateChannel = useCallback(
    async (
      id: string,
      data: UpdateChannelRequest
    ): Promise<GatewayChannel | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await gatewayFetch<GatewayChannel>(
          `/api/channels/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          }
        );
        // Sync to store
        await syncChannels(true);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update channel";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateChannel, loading, error };
}

/**
 * Hook to delete a channel
 */
export function useDeleteChannel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteChannel = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await gatewayFetch(`/api/channels/${id}`, {
        method: "DELETE",
      });
      // Sync to store
      await syncChannels(true);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete channel";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteChannel, loading, error };
}

/**
 * Hook to test a channel connection
 */
export function useTestChannel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testChannel = useCallback(
    async (
      channelType: ChannelType,
      config: ChannelConfig
    ): Promise<{ success: boolean; details?: string; error?: string }> => {
      setLoading(true);
      setError(null);
      try {
        const result = await gatewayFetch<{
          success: boolean;
          details?: string;
          error?: string;
        }>("/api/channels/test", {
          method: "POST",
          body: JSON.stringify({ channel_type: channelType, config }),
        });
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to test channel";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { testChannel, loading, error };
}

/**
 * Hook to send a test message
 */
export function useSendTestMessage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTestMessage = useCallback(
    async (
      channelType: ChannelType,
      config: ChannelConfig,
      chatId: string,
      message: string
    ): Promise<{ success: boolean; message_id?: string; error?: string }> => {
      setLoading(true);
      setError(null);
      try {
        const result = await gatewayFetch<{
          success: boolean;
          message_id?: string;
          error?: string;
        }>("/api/channels/send-test", {
          method: "POST",
          body: JSON.stringify({
            channel_type: channelType,
            config,
            chat_id: chatId,
            message,
          }),
        });
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send test message";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { sendTestMessage, loading, error };
}
