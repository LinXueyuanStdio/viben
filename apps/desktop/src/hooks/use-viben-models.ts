/**
 * Hook for managing viben-core Models via Tauri commands
 */
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ProviderType } from "./use-viben-providers";

// ============================================================================
// Types (matching Rust viben-core types)
// ============================================================================

export interface Model {
  id: string;
  name: string;
  provider: ProviderType;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  is_default: boolean;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateModelOptions {
  id: string;
  name: string;
  provider: ProviderType;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  set_as_default?: boolean;
}

export interface ModelUpdate {
  name?: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
}

// ============================================================================
// Hook
// ============================================================================

export interface UseVibenModelsReturn {
  // Data
  models: Model[];
  defaultModelId: string | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  listModelsForProvider: (provider: ProviderType) => Promise<Model[]>;
  getModel: (id: string) => Promise<Model | null>;
  createModel: (options: CreateModelOptions) => Promise<Model>;
  updateModel: (id: string, updates: ModelUpdate) => Promise<Model>;
  removeModel: (id: string) => Promise<void>;
  setDefaultModel: (id: string) => Promise<void>;
  enableModel: (id: string) => Promise<void>;
  disableModel: (id: string) => Promise<void>;
}

export function useVibenModels(): UseVibenModelsReturn {
  const [models, setModels] = useState<Model[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load models and default
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelsList, defaultId] = await Promise.all([
        invoke<Model[]>("viben_list_models"),
        invoke<string | null>("viben_get_default_model"),
      ]);
      setModels(modelsList);
      setDefaultModelId(defaultId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // List models for specific provider
  const listModelsForProvider = useCallback(async (provider: ProviderType): Promise<Model[]> => {
    try {
      return await invoke<Model[]>("viben_list_models_for_provider", { provider });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Get single model
  const getModel = useCallback(async (id: string): Promise<Model | null> => {
    try {
      return await invoke<Model | null>("viben_get_model", { id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Create model
  const createModel = useCallback(async (options: CreateModelOptions): Promise<Model> => {
    setError(null);
    try {
      const model = await invoke<Model>("viben_create_model", { options });
      await refresh();
      return model;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [refresh]);

  // Update model
  const updateModel = useCallback(async (id: string, updates: ModelUpdate): Promise<Model> => {
    setError(null);
    try {
      const model = await invoke<Model>("viben_update_model", { id, updates });
      setModels((prev) =>
        prev.map((m) => (m.id === id ? model : m))
      );
      return model;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Remove model
  const removeModel = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_remove_model", { id });
      setModels((prev) => prev.filter((m) => m.id !== id));
      if (defaultModelId === id) {
        const newDefault = await invoke<string | null>("viben_get_default_model");
        setDefaultModelId(newDefault);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, [defaultModelId]);

  // Set default model
  const setDefaultModel = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_set_default_model", { id });
      setDefaultModelId(id);
      setModels((prev) =>
        prev.map((m) => ({
          ...m,
          is_default: m.id === id,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Enable model
  const enableModel = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_enable_model", { id });
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: true } : m))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Disable model
  const disableModel = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await invoke("viben_disable_model", { id });
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: false } : m))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    models,
    defaultModelId,
    loading,
    error,
    refresh,
    listModelsForProvider,
    getModel,
    createModel,
    updateModel,
    removeModel,
    setDefaultModel,
    enableModel,
    disableModel,
  };
}
