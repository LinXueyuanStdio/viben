/**
 * Hook for managing channel instances
 *
 * Supports multiple instances of the same channel type.
 * Stores in localStorage for now, will integrate with gateway later.
 */

import { useState, useEffect, useCallback } from "react";
import {
  ChannelInstance,
  ChannelType,
  ChannelsStorage,
  DEFAULT_CHANNELS_STORAGE,
  createDefaultInstance,
} from "@/types/channel";

const STORAGE_KEY = "viben_channel_instances";

export interface UseChannelInstancesReturn {
  /** All channel instances */
  instances: ChannelInstance[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Get instances by type */
  getInstancesByType: (type: ChannelType) => ChannelInstance[];
  /** Get instance by ID */
  getInstance: (id: string) => ChannelInstance | undefined;
  /** Get enabled instances */
  getEnabledInstances: () => ChannelInstance[];
  /** Create new instance */
  createInstance: (type: ChannelType, name: string) => ChannelInstance;
  /** Update instance */
  updateInstance: (id: string, update: Partial<ChannelInstance>) => void;
  /** Delete instance */
  deleteInstance: (id: string) => void;
  /** Toggle instance enabled state */
  toggleInstance: (id: string) => void;
}

export function useChannelInstances(): UseChannelInstancesReturn {
  const [storage, setStorage] = useState<ChannelsStorage>(DEFAULT_CHANNELS_STORAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ChannelsStorage;
        setStorage(parsed);
      }
    } catch (e) {
      console.error("Failed to load channel instances:", e);
      setError("Failed to load channel instances");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    }
  }, [storage, isLoading]);

  const getInstancesByType = useCallback(
    (type: ChannelType) => storage.instances.filter((i) => i.type === type),
    [storage.instances]
  );

  const getInstance = useCallback(
    (id: string) => storage.instances.find((i) => i.id === id),
    [storage.instances]
  );

  const getEnabledInstances = useCallback(
    () => storage.instances.filter((i) => i.enabled),
    [storage.instances]
  );

  const createInstance = useCallback((type: ChannelType, name: string) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const instance = createDefaultInstance(type, id, name);

    setStorage((prev) => ({
      ...prev,
      instances: [...prev.instances, instance],
    }));

    return instance;
  }, []);

  const updateInstance = useCallback(
    (id: string, update: Partial<ChannelInstance>) => {
      setStorage((prev) => ({
        ...prev,
        instances: prev.instances.map((i) =>
          i.id === id ? ({ ...i, ...update } as ChannelInstance) : i
        ),
      }));
    },
    []
  );

  const deleteInstance = useCallback((id: string) => {
    setStorage((prev) => ({
      ...prev,
      instances: prev.instances.filter((i) => i.id !== id),
    }));
  }, []);

  const toggleInstance = useCallback((id: string) => {
    setStorage((prev) => ({
      ...prev,
      instances: prev.instances.map((i) =>
        i.id === id ? { ...i, enabled: !i.enabled } : i
      ),
    }));
  }, []);

  return {
    instances: storage.instances,
    isLoading,
    error,
    getInstancesByType,
    getInstance,
    getEnabledInstances,
    createInstance,
    updateInstance,
    deleteInstance,
    toggleInstance,
  };
}
