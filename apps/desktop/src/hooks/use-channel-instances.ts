/**
 * Hook for managing channel instances via Gateway API
 *
 * Supports multiple instances of the same channel type.
 * Data is stored in ~/.viben/channels.yaml via Gateway.
 */

import { useState, useEffect, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";
import type {
  ChannelType,
  GatewayChannel,
  CreateChannelRequest,
  UpdateChannelRequest,
  ListChannelsResponse,
  ChannelConfig,
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
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
    ...options,
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
    config?: ChannelConfig
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
  const [instances, setInstances] = useState<GatewayChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from Gateway API
  const loadInstances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await gatewayFetch<ListChannelsResponse>("/api/channels");
      setInstances(data.channels || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load channel instances";
      setError(message);
      console.error("Failed to load channel instances:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

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
      config?: ChannelConfig
    ): Promise<GatewayChannel | null> => {
      try {
        const request: CreateChannelRequest = {
          channel_type: type,
          name,
          config,
        };
        const result = await gatewayFetch<GatewayChannel>("/api/channels", {
          method: "POST",
          body: JSON.stringify(request),
        });
        // Refresh the list
        await loadInstances();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create channel";
        setError(message);
        console.error("Failed to create channel instance:", err);
        return null;
      }
    },
    [loadInstances]
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
        await loadInstances();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update channel";
        setError(message);
        console.error("Failed to update channel instance:", err);
        return null;
      }
    },
    [loadInstances]
  );

  const deleteInstance = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await gatewayFetch(`/api/channels/${id}`, {
          method: "DELETE",
        });
        // Refresh the list
        await loadInstances();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete channel";
        setError(message);
        console.error("Failed to delete channel instance:", err);
        return false;
      }
    },
    [loadInstances]
  );

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
        await loadInstances();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to set default channel";
        setError(message);
        console.error("Failed to set default channel:", err);
        return null;
      }
    },
    [loadInstances]
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
