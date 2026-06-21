/**
 * Unified Models Hook
 *
 * Provides a unified interface for managing models via Gateway API.
 * Replaces both useVibenModels (Tauri commands) and useWorkspaceModels (read-only Gateway).
 *
 * Features:
 * - Model listing with workspace scope support
 * - CRUD operations for custom models
 * - Default model management
 * - Enable/disable models
 * - Provider model discovery
 */

import { useState, useEffect, useCallback } from "react";
import i18n from "@/i18n";
import {
  emitModelProviderDataChanged,
  shouldRefreshModelList,
  subscribeModelProviderDataChanged,
} from "./model-provider-events";
import {
  getGatewayClient,
  type WorkspaceModel,
  type ModelResponse,
  type CreateModelOptions,
  type ModelUpdate,
  type DiscoveredModel,
  type ProviderModelResponse,
  type ProviderType,
  type ModelCategory,
  type ModelSurface,
} from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

export interface UseModelsOptions {
  /** Workspace path to scope models (default: user home directory) */
  workspacePath?: string | null;
  /** Include global models (default: true) */
  includeGlobal?: boolean;
  /** Include predefined models for reference (default: false, used in Settings > Models) */
  includeProviderPredefined?: boolean;
  providerId?: string;
  category?: ModelCategory;
  surface?: ModelSurface;
  enabled?: boolean;
}

export interface UseModelsReturn {
  // Data
  /** List of models with workspace context */
  models: WorkspaceModel[];
  /** Default model ID */
  defaultModelId: string | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Total number of models */
  total: number;

  // Read operations
  /** Refresh models */
  refresh: () => Promise<void>;
  /** Get available models (API key configured) */
  getAvailableModels: () => WorkspaceModel[];
  /** Get models by provider */
  getModelsByProvider: (providerId: string) => WorkspaceModel[];
  /** Get a model by ID */
  getModel: (id: string) => Promise<ModelResponse | null>;

  // CRUD operations
  /** Create a new custom model */
  createModel: (options: CreateModelOptions) => Promise<ModelResponse>;
  /** Update a model */
  updateModel: (id: string, updates: ModelUpdate) => Promise<ModelResponse>;
  /** Remove a model */
  removeModel: (id: string, providerId: string) => Promise<void>;

  // Default model management
  /** Set the default model */
  setDefaultModel: (id: string, surface?: ModelSurface) => Promise<void>;

  // Enable/disable
  /** Enable a model */
  enableModel: (id: string, providerId: string) => Promise<void>;
  /** Disable a model */
  disableModel: (id: string, providerId: string) => Promise<void>;

  // Provider model discovery
  /** Discover models available from a provider via API */
  discoverProviderModels: (providerId: string) => Promise<DiscoveredModel[]>;
  /** List models enabled for a specific provider */
  listProviderEnabledModels: (providerId: string) => Promise<string[]>;
  /** List configured models for a specific provider, including enabled state */
  listProviderConfiguredModels: (providerId: string) => Promise<ProviderModelResponse[]>;
  /** Enable a model for a specific provider */
  enableModelForProvider: (providerId: string, modelId: string) => Promise<void>;
  /** Disable a model for a specific provider */
  disableModelForProvider: (providerId: string, modelId: string) => Promise<void>;
}

// Re-export types for convenience
export type { WorkspaceModel, ModelResponse, CreateModelOptions, ModelUpdate, DiscoveredModel, ProviderModelResponse, ProviderType };
export type { ModelCategory, ModelSurface };

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to manage models via Gateway API
 *
 * When workspacePath is provided with includeGlobal=true (default):
 * - Returns both workspace-scoped and global models
 * - is_available indicates if the model's provider API key is configured
 *
 * Also provides CRUD operations for custom models.
 */
export function useModels(options?: UseModelsOptions): UseModelsReturn {
  const workspacePath = options?.workspacePath;
  const includeGlobal = options?.includeGlobal ?? true;
  const includeProviderPredefined = options?.includeProviderPredefined ?? false;
  const providerId = options?.providerId;
  const category = options?.category;
  const surface = options?.surface;
  const enabled = options?.enabled ?? true;

  const [models, setModels] = useState<WorkspaceModel[]>([]);
  const [defaultModelId, setDefaultModelIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Load models and default
  const loadModels = useCallback(async () => {
    if (!enabled) {
      setModels([]);
      setTotal(0);
      setDefaultModelIdState(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const [modelsResponse, defaultId] = await Promise.all([
        client.getModels({
          workspacePath: workspacePath || undefined,
          includeGlobal,
          includeProviderPredefined,
          providerId,
          category,
          surface,
        }),
        client.getDefaultModelId(surface).catch(() => null),
      ]);
      setModels(modelsResponse.models);
      setTotal(modelsResponse.total);
      setDefaultModelIdState(modelsResponse.default_model_id ?? defaultId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : i18n.t("errors.models.loadFailed");
      setError(message);
      console.error("[useModels] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    workspacePath,
    includeGlobal,
    includeProviderPredefined,
    providerId,
    category,
    surface,
    enabled,
  ]);

  // Load on mount and when options change
  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    return subscribeModelProviderDataChanged((detail) => {
      if (shouldRefreshModelList(detail, providerId)) {
        void loadModels();
      }
    });
  }, [loadModels, providerId]);

  // Read operations
  const getAvailableModels = useCallback(() => {
    return models.filter((m) => m.is_available);
  }, [models]);

  const getModelsByProvider = useCallback(
    (providerId: string) => {
      return models.filter(
        (m) => m.provider_id.toLowerCase() === providerId.toLowerCase()
      );
    },
    [models]
  );

  const getModel = useCallback(async (id: string): Promise<ModelResponse | null> => {
    const client = getGatewayClient();
    return client.getModel(id);
  }, []);

  // CRUD operations
  const createModel = useCallback(
    async (createOptions: CreateModelOptions): Promise<ModelResponse> => {
      setError(null);
      try {
        const client = getGatewayClient();
        const result = await client.createModel(createOptions);
        // Refresh models after creation
        await loadModels();
        emitModelProviderDataChanged({ scope: "models", provider_id: createOptions.provider_id });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  const updateModel = useCallback(
    async (id: string, updates: ModelUpdate): Promise<ModelResponse> => {
      setError(null);
      try {
        const client = getGatewayClient();
        const result = await client.updateModel(id, updates);
        // Refresh models after update
        await loadModels();
        emitModelProviderDataChanged({ scope: "models" });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  const removeModel = useCallback(
    async (id: string, providerId: string): Promise<void> => {
      setError(null);
      try {
        const client = getGatewayClient();
        await client.deleteModel(id, providerId);
        // Refresh models after deletion
        await loadModels();
        emitModelProviderDataChanged({ scope: "models", provider_id: providerId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  // Default model management
  const setDefaultModel = useCallback(
    async (id: string, defaultSurface?: ModelSurface): Promise<void> => {
      setError(null);
      try {
        const client = getGatewayClient();
        await client.setDefaultModel(id, defaultSurface ?? surface);
        setDefaultModelIdState(id);
        emitModelProviderDataChanged({ scope: "models" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [surface]
  );

  // Enable/disable
  const enableModel = useCallback(
    async (id: string, providerId: string): Promise<void> => {
      setError(null);
      try {
        const client = getGatewayClient();
        await client.enableModel(id, providerId);
        // Refresh models after enabling
        await loadModels();
        emitModelProviderDataChanged({ scope: "models", provider_id: providerId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  const disableModel = useCallback(
    async (id: string, providerId: string): Promise<void> => {
      setError(null);
      try {
        const client = getGatewayClient();
        await client.disableModel(id, providerId);
        // Refresh models after disabling
        await loadModels();
        emitModelProviderDataChanged({ scope: "models", provider_id: providerId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  // Provider model discovery
  const discoverProviderModels = useCallback(
    async (providerId: string): Promise<DiscoveredModel[]> => {
      setError(null);
      try {
        const client = getGatewayClient();
        return await client.discoverProviderModels(providerId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const listProviderEnabledModels = useCallback(
    async (providerId: string): Promise<string[]> => {
      try {
        const client = getGatewayClient();
        return await client.listProviderEnabledModels(providerId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const listProviderConfiguredModels = useCallback(
    async (providerId: string): Promise<ProviderModelResponse[]> => {
      try {
        const client = getGatewayClient();
        return await client.listProviderConfiguredModels(providerId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const enableModelForProvider = useCallback(
    async (providerId: string, modelId: string): Promise<void> => {
      setError(null);
      try {
        const client = getGatewayClient();
        await client.enableProviderModel(providerId, modelId);
        // Refresh models after enabling
        await loadModels();
        emitModelProviderDataChanged({ scope: "models", provider_id: providerId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  const disableModelForProvider = useCallback(
    async (providerId: string, modelId: string): Promise<void> => {
      setError(null);
      try {
        const client = getGatewayClient();
        await client.disableProviderModel(providerId, modelId);
        // Refresh models after disabling
        await loadModels();
        emitModelProviderDataChanged({ scope: "models", provider_id: providerId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw new Error(message);
      }
    },
    [loadModels]
  );

  return {
    // Data
    models,
    defaultModelId,
    loading,
    error,
    total,

    // Read operations
    refresh: loadModels,
    getAvailableModels,
    getModelsByProvider,
    getModel,

    // CRUD operations
    createModel,
    updateModel,
    removeModel,

    // Default model management
    setDefaultModel,

    // Enable/disable
    enableModel,
    disableModel,

    // Provider model discovery
    discoverProviderModels,
    listProviderEnabledModels,
    listProviderConfiguredModels,
    enableModelForProvider,
    disableModelForProvider,
  };
}
