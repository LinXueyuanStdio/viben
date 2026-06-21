/**
 * Model routes
 *
 * Provides HTTP API for:
 * - Model CRUD operations (stored in ~/.viben/models.yaml)
 * - Default model management
 * - Model configuration
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { homedir } from "node:os";
import { modelManager } from "../../models";
import { providerManager } from "../../providers";
import type { ModelCategory, ModelSurface } from "../../models/types";
import type { ModelConfig, Model } from "../../types";

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Model response (snake_case to match Rust gateway)
 * Includes availability info for workspace context
 */
interface ModelResponse {
  id: string;
  name: string;
  provider_type: string;
  provider_id: string;
  provider_name: string;
  category?: string;
  surface?: string;
  capabilities?: string[];
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  input_price?: number;
  output_price?: number;
  is_default: boolean;
  enabled: boolean;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Query parameters for listing models
 */
interface ModelsQuery {
  workspace_path?: string;
  include_global?: string;
  include_provider_predefined?: string;
  provider_id?: string;
  provider?: string;
  category?: string;
  surface?: string;
}

function hasApiKey(providerType: string, apiKey: string | undefined): boolean {
  return providerType === "ollama" || Boolean(apiKey);
}

/**
 * Check if a provider instance is configured and available.
 */
async function isProviderAvailable(providerId: string | undefined): Promise<boolean> {
  if (!providerId) return false;

  try {
    const providers = await providerManager.listProviders();
    const provider = providers.find((p) => p.id === providerId);
    return Boolean(provider?.enabled && hasApiKey(provider.type, provider.apiKey));
  } catch {
    return false;
  }
}

function filterModels(
  models: Model[],
  filters: {
    provider_id?: string;
    provider?: string;
    category?: ModelCategory;
    surface?: ModelSurface;
  }
): Model[] {
  return models.filter((model) => {
    if (filters.provider_id && model.provider_id !== filters.provider_id) return false;
    if (filters.provider && model.provider !== filters.provider) return false;
    if (filters.category && model.category !== filters.category) return false;
    if (filters.surface && model.surface !== filters.surface) return false;
    return true;
  });
}

async function findProviderScopedModels(modelId: string): Promise<Model[]> {
  const models = await modelManager.listModels();
  return models.filter((model) => model.id === modelId);
}

function getProviderScopedModel(
  models: Model[],
  providerId: string | undefined
): Model | undefined {
  if (!providerId) {
    return models.length === 1 ? models[0] : undefined;
  }
  return models.find((model) => model.provider_id === providerId);
}

function requireProviderId(
  providerId: string | undefined,
  reply: FastifyReply
): providerId is string {
  if (providerId) return true;
  reply.code(400);
  return false;
}

function toModelConfig(body: SetModelConfigBody): ModelConfig {
  return {
    temperature: body.temperature,
    maxTokens: body.max_tokens,
    topP: body.top_p,
    frequencyPenalty: body.frequency_penalty,
    presencePenalty: body.presence_penalty,
  };
}

function toSnakeCaseConfig(config: ModelConfig): Record<string, unknown> {
  const response: Record<string, unknown> = {};
  if (config.temperature !== undefined) response.temperature = config.temperature;
  if (config.maxTokens !== undefined) response.max_tokens = config.maxTokens;
  if (config.topP !== undefined) response.top_p = config.topP;
  if (config.frequencyPenalty !== undefined) response.frequency_penalty = config.frequencyPenalty;
  if (config.presencePenalty !== undefined) response.presence_penalty = config.presencePenalty;
  if (config.provider !== undefined) response.provider = config.provider;
  if (config.category !== undefined) response.category = config.category;
  if (config.surface !== undefined) response.surface = config.surface;
  if (config.capabilities !== undefined) response.capabilities = config.capabilities;
  if (config.duration_seconds !== undefined) response.duration_seconds = config.duration_seconds;
  if (config.aspect_ratio !== undefined) response.aspect_ratio = config.aspect_ratio;
  if (config.size !== undefined) response.size = config.size;
  if (config.voice_id !== undefined) response.voice_id = config.voice_id;
  return response;
}

/**
 * Transform model to API response format (snake_case)
 *
 * Now uses model.isDefault and model.enabled from ModelManager
 * instead of in-memory tracking.
 */
async function toSnakeCaseModel(model: Model): Promise<ModelResponse> {
  const now = new Date().toISOString();
  const isAvailable = await isProviderAvailable(model.provider_id);
  return {
    id: model.id,
    name: model.name,
    provider_type: model.provider,
    provider_id: model.provider_id ?? "",
    provider_name: model.provider_id ?? "",
    category: model.category,
    surface: model.surface,
    capabilities: model.capabilities,
    description: model.description,
    context_window: model.contextLength,
    max_output_tokens: model.maxOutputTokens,
    input_price: model.inputPrice,
    output_price: model.outputPrice,
    is_default: model.isDefault ?? false,
    enabled: model.enabled ?? true,
    is_available: isAvailable,
    created_at: model.created_at ?? now,
    updated_at: model.updated_at ?? now,
  };
}

interface CreateModelBody {
  id: string;
  name: string;
  provider: string;
  provider_id?: string;
  category?: ModelCategory;
  surface?: ModelSurface;
  capabilities?: string[];
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  set_as_default?: boolean;
}

interface UpdateModelBody {
  name?: string;
  description?: string;
  provider_id?: string;
  context_window?: number;
  max_output_tokens?: number;
}

interface SetDefaultBody {
  model_id: string;
  surface?: ModelSurface;
}

interface CreateAliasBody {
  alias: string;
  model: string;
}

interface SetModelConfigBody {
  provider_id?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface ProviderScopedQuery {
  provider_id?: string;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register model routes
 */
export function registerModelRoutes(fastify: FastifyInstance): void {
  // ========================================================================
  // Default Model Management (MUST be registered before :id routes)
  // ========================================================================

  // Get the default model
  fastify.get("/api/models/default", async (
    request: FastifyRequest<{ Querystring: { surface?: ModelSurface } }>
  ) => {
    const { surface } = request.query;
    const defaultModel = surface
      ? await modelManager.getDefaultForSurface(surface)
      : await modelManager.getDefault();
    return {
      default_model_id: defaultModel,
      ...(surface ? { surface } : {}),
    };
  });

  // Set the default model
  fastify.put("/api/models/default", async (
    request: FastifyRequest<{ Body: SetDefaultBody }>,
    reply: FastifyReply
  ) => {
    const { model_id, surface } = request.body;

    if (!model_id) {
      reply.code(400);
      return { error: "Model ID is required" };
    }

    try {
      if (surface) {
        await modelManager.setDefaultForSurface(surface, model_id);
        return {
          success: true,
          default_model_id: model_id,
          surface,
        };
      }

      await modelManager.setDefault(model_id);
      return {
        success: true,
        default_model_id: model_id,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set default model" };
    }
  });

  // ========================================================================
  // Model Aliases (MUST be registered before :id routes)
  // ========================================================================

  // List all aliases
  fastify.get("/api/models/aliases", async () => {
    const aliases = await modelManager.getAliases();
    return { aliases };
  });

  // Create or update an alias
  fastify.post("/api/models/aliases", async (
    request: FastifyRequest<{ Body: CreateAliasBody }>,
    reply: FastifyReply
  ) => {
    const { alias, model } = request.body;

    if (!alias || !model) {
      reply.code(400);
      return { error: "Alias and model are required" };
    }

    try {
      await modelManager.createAlias(alias, model);
      reply.code(201);
      return {
        success: true,
        alias,
        model,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create alias" };
    }
  });

  // Delete an alias
  fastify.delete("/api/models/aliases/:alias", async (
    request: FastifyRequest<{ Params: { alias: string } }>,
    reply: FastifyReply
  ) => {
    const { alias } = request.params;

    try {
      await modelManager.removeAlias(alias);
      return {
        success: true,
        deleted: alias,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete alias" };
    }
  });

  // ========================================================================
  // Reload Configuration
  // ========================================================================

  // Reload models configuration from disk
  fastify.post("/api/models/reload", async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      await modelManager.reload();
      return {
        success: true,
        message: "Models configuration reloaded",
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to reload configuration" };
    }
  });

  // ========================================================================
  // Model CRUD (with :id param - registered AFTER specific routes)
  // ========================================================================

  // List all models (with query parameter support)
  fastify.get("/api/models", {
    schema: {
      description: "List all models",
      tags: ["models"],
      querystring: {
        type: "object",
        properties: {
          workspace_path: { type: "string", description: "Workspace path for context" },
          include_global: { type: "string", description: "Include global models (default: true)" },
          include_provider_predefined: { type: "string", description: "Include provider predefined models" },
          provider_id: { type: "string", description: "Filter by provider ID" },
          provider: { type: "string", description: "Filter by provider type" },
          category: { type: "string", enum: ["llm", "media"], description: "Filter by model category" },
          surface: { type: "string", enum: ["chat", "image", "video", "music", "speech", "sfx"], description: "Filter by media surface" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            workspace_path: { type: "string" },
            models: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  provider_type: { type: "string" },
                  provider_id: { type: "string" },
                  provider_name: { type: "string" },
                  category: { type: "string" },
                  surface: { type: "string" },
                  capabilities: { type: "array", items: { type: "string" } },
                  description: { type: "string" },
                  context_window: { type: "number" },
                  max_output_tokens: { type: "number" },
                  is_default: { type: "boolean" },
                  enabled: { type: "boolean" },
                  is_available: { type: "boolean" },
                },
              },
            },
            total: { type: "number" },
            default_model_id: { type: "string" },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: ModelsQuery }>
  ) => {
    const {
      workspace_path,
      include_global,
      include_provider_predefined,
      provider_id,
      provider,
      category,
      surface,
    } = request.query;

    // Parse boolean query params (default: true for include_global, false for include_provider_predefined)
    const _includeGlobal = include_global !== "false";
    const _includeProviderPredefined = include_provider_predefined === "true";

    // For now, workspace_path is not used as we use global config
    // In future, this could scope models to a specific workspace

    const allModels = await modelManager.listModels();
    const models = filterModels(allModels, {
      provider_id,
      provider,
      category: category as ModelCategory | undefined,
      surface: surface as ModelSurface | undefined,
    });
    const defaultModelId = surface
      ? await modelManager.getDefaultForSurface(surface as ModelSurface)
      : await modelManager.getDefault();
    // Transform to response format with availability info
    const modelResponses = await Promise.all(models.map(m => toSnakeCaseModel(m)));

    return {
      workspace_path: workspace_path || homedir(),
      models: modelResponses,
      total: modelResponses.length,
      default_model_id: defaultModelId,
    };
  });

  // Get a specific model by ID
  fastify.get("/api/models/:id", {
    schema: {
      description: "Get a specific model by ID",
      tags: ["models"],
      params: {
        type: "object",
        properties: {
          id: { type: "string", description: "Model ID or alias" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            provider_type: { type: "string" },
            provider_id: { type: "string" },
            provider_name: { type: "string" },
            description: { type: "string" },
            context_window: { type: "number" },
            max_output_tokens: { type: "number" },
            is_default: { type: "boolean" },
            enabled: { type: "boolean" },
            is_available: { type: "boolean" },
            config: { type: "object", additionalProperties: true },
          },
        },
        404: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: ProviderScopedQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { provider_id } = request.query;

    // First resolve any alias
    const resolvedId = await modelManager.resolveAlias(id);
    const models = await findProviderScopedModels(resolvedId);
    const model = getProviderScopedModel(models, provider_id);

    if (!model) {
      if (!provider_id && models.length > 1) {
        reply.code(400);
        return { error: "Ambiguous model ID. Provide provider_id to disambiguate" };
      }
      reply.code(404);
      return { error: `Model not found: ${id}` };
    }

    const [modelResponse, modelConfig] = await Promise.all([
      toSnakeCaseModel(model),
      model.provider_id
        ? modelManager.getModelConfig(resolvedId, model.provider_id)
        : Promise.resolve(null),
    ]);

    return {
      ...modelResponse,
      config: modelConfig ? toSnakeCaseConfig(modelConfig) : null,
    };
  });

  // Enable a model
  fastify.post("/api/models/:id/enable", async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: ProviderScopedQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { provider_id } = request.query;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      const models = await findProviderScopedModels(resolvedId);
      const model = getProviderScopedModel(models, provider_id);
      if (!model) {
        if (!provider_id && models.length > 1) {
          reply.code(400);
          return {
            error: "Ambiguous model ID. Provide provider_id or use /api/providers/:provider_id/models/:model_id/enable",
          };
        }
        reply.code(404);
        return { error: `Model not found: ${id}` };
      }
      if (!model.provider_id) {
        reply.code(400);
        return { error: "Provider ID is required" };
      }
      await modelManager.enableModel(resolvedId, model.provider, model.provider_id);

      return {
        success: true,
        provider_id: model.provider_id,
        model_id: resolvedId,
        enabled: true,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("not found")) {
        reply.code(404);
        return { error: `Model not found: ${id}` };
      }
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to enable model" };
    }
  });

  // Disable a model
  fastify.post("/api/models/:id/disable", async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: ProviderScopedQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { provider_id } = request.query;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      const models = await findProviderScopedModels(resolvedId);
      const model = getProviderScopedModel(models, provider_id);
      if (!model) {
        if (!provider_id && models.length > 1) {
          reply.code(400);
          return {
            error: "Ambiguous model ID. Provide provider_id or use /api/providers/:provider_id/models/:model_id/disable",
          };
        }
        reply.code(404);
        return { error: `Model not found: ${id}` };
      }
      if (!model.provider_id) {
        reply.code(400);
        return { error: "Provider ID is required" };
      }
      await modelManager.disableModel(resolvedId, model.provider, model.provider_id);

      return {
        success: true,
        provider_id: model.provider_id,
        model_id: resolvedId,
        enabled: false,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("not found")) {
        reply.code(404);
        return { error: `Model not found: ${id}` };
      }
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to disable model" };
    }
  });

  // Create/register a new model
  fastify.post("/api/models", async (
    request: FastifyRequest<{ Body: CreateModelBody }>,
    reply: FastifyReply
  ) => {
    const { id, set_as_default, ...config } = request.body;

    if (!id) {
      reply.code(400);
      return { error: "Model ID is required" };
    }
    if (!config.provider_id) {
      reply.code(400);
      return { error: "Provider ID is required" };
    }

    try {
      const provider = await providerManager.getProvider(config.provider_id);
      if (!provider) {
        reply.code(400);
        return { error: `Provider not found: ${config.provider_id}` };
      }
      const existingModel = await modelManager.getModelForProvider(config.provider_id, id);

      if (existingModel) {
        // Model exists, set its config
        const modelConfig: ModelConfig = {
          temperature: undefined,
          maxTokens: config.max_output_tokens,
        };
        await modelManager.setModelConfig(id, modelConfig, config.provider_id);
      } else {
        // Create a configured model under the selected provider.
        await modelManager.createModel({
          id,
          name: config.name || id,
          provider: provider.type,
          provider_id: config.provider_id,
          category: config.category,
          surface: config.surface,
          capabilities: config.capabilities,
          description: config.description,
          contextWindow: config.context_window,
          maxOutputTokens: config.max_output_tokens,
          setAsDefault: set_as_default,
        });
      }

      // Set as default if requested (for existing models)
      if (set_as_default && existingModel) {
        await modelManager.setDefault(id);
      }

      // Reload to get updated model
      await modelManager.reload();
      const model = await modelManager.getModelForProvider(config.provider_id, id);

      reply.code(201);
      if (model) {
        return toSnakeCaseModel(model);
      }
      return {
        success: true,
        id,
        is_default: set_as_default || false,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to create model" };
    }
  });

  // Update a model configuration
  fastify.patch("/api/models/:id", async (
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateModelBody }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const updates = request.body;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      if (!requireProviderId(updates.provider_id, reply)) {
        return { error: "Provider ID is required" };
      }
      const models = await findProviderScopedModels(resolvedId);
      const model = getProviderScopedModel(models, updates.provider_id);

      if (!model) {
        reply.code(404);
        return { error: `Model not found: ${id}` };
      }

      // Update model config
      const currentConfig = await modelManager.getModelConfig(resolvedId, updates.provider_id);
      const newConfig: ModelConfig = {
        ...currentConfig,
        maxTokens: updates.max_output_tokens ?? currentConfig?.maxTokens,
      };
      await modelManager.setModelConfig(resolvedId, newConfig, updates.provider_id);

      // Reload to get updated model
      await modelManager.reload();
      const updatedModel = await modelManager.getModelForProvider(updates.provider_id, resolvedId);
      return toSnakeCaseModel(updatedModel ?? model);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update model" };
    }
  });

  // Delete/remove a model configuration
  fastify.delete("/api/models/:id", async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: ProviderScopedQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { provider_id } = request.query;
    if (!requireProviderId(provider_id, reply)) {
      return { error: "Provider ID is required" };
    }

    try {
      const resolvedId = await modelManager.resolveAlias(id);

      // Remove model config
      await modelManager.removeModelConfig(resolvedId, provider_id);

      return {
        success: true,
        provider_id,
        deleted: id,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete model" };
    }
  });

  // ========================================================================
  // Model Configuration (after CRUD, with :id param)
  // ========================================================================

  // Get model-specific configuration
  fastify.get("/api/models/:id/config", async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: ProviderScopedQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { provider_id } = request.query;
    if (!requireProviderId(provider_id, reply)) {
      return { error: "Provider ID is required" };
    }

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      const config = await modelManager.getModelConfig(resolvedId, provider_id);

      if (!config) {
        reply.code(404);
        return { error: `No configuration found for model: ${id}` };
      }

      return {
        model_id: resolvedId,
        provider_id,
        config: toSnakeCaseConfig(config),
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to get model config" };
    }
  });

  // Set model-specific configuration
  fastify.put("/api/models/:id/config", async (
    request: FastifyRequest<{ Params: { id: string }; Body: SetModelConfigBody }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const config = request.body;
    const { provider_id } = config;
    if (!requireProviderId(provider_id, reply)) {
      return { error: "Provider ID is required" };
    }

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      const modelConfig = toModelConfig(config);
      await modelManager.setModelConfig(resolvedId, modelConfig, provider_id);

      return {
        success: true,
        model_id: resolvedId,
        provider_id,
        config: toSnakeCaseConfig(modelConfig),
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set model config" };
    }
  });

  // Delete model-specific configuration
  fastify.delete("/api/models/:id/config", async (
    request: FastifyRequest<{ Params: { id: string }; Querystring: ProviderScopedQuery }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { provider_id } = request.query;
    if (!requireProviderId(provider_id, reply)) {
      return { error: "Provider ID is required" };
    }

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      await modelManager.removeModelConfig(resolvedId, provider_id);

      return {
        success: true,
        provider_id,
        deleted: resolvedId,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete model config" };
    }
  });
}
