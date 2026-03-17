/**
 * Model routes
 *
 * Provides HTTP API for:
 * - Model CRUD operations (stored in ~/.viben/models.yaml)
 * - Model aliases management
 * - Default model management
 * - Model configuration
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { homedir } from "node:os";
import { modelManager } from "../../models";
import { providerManager } from "../../providers";
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
  provider: string;
  provider_id: string;
  provider_name: string;
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
}

/**
 * Check if a provider type has any configured provider with API key
 *
 * This checks by provider TYPE (e.g., "anthropic", "openai") rather than
 * provider ID (e.g., "本地-claude"), because KNOWN_MODELS use type names.
 */
async function isProviderAvailable(providerType: string): Promise<boolean> {
  try {
    const providers = await providerManager.listProviders();
    // Find any enabled provider of this type with API key configured
    return providers.some((p) => {
      if (p.type !== providerType) return false;
      if (!p.enabled) return false;
      // Ollama doesn't need API key
      if (p.type === "ollama") return true;
      return !!p.apiKey;
    });
  } catch {
    return false;
  }
}

/**
 * Transform model to API response format (snake_case)
 *
 * Now uses model.isDefault and model.enabled from ModelManager
 * instead of in-memory tracking.
 */
async function toSnakeCaseModel(model: Model): Promise<ModelResponse> {
  const now = new Date().toISOString();
  const isAvailable = await isProviderAvailable(model.provider);
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    provider_id: model.provider,
    provider_name: model.provider,
    description: model.description,
    context_window: model.contextLength,
    max_output_tokens: model.maxOutputTokens,
    input_price: model.inputPrice,
    output_price: model.outputPrice,
    is_default: model.isDefault ?? false,
    enabled: model.enabled ?? true,
    is_available: isAvailable,
    created_at: model.createdAt ?? now,
    updated_at: model.updatedAt ?? now,
  };
}

interface CreateModelBody {
  id: string;
  name: string;
  provider: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
  set_as_default?: boolean;
}

interface UpdateModelBody {
  name?: string;
  description?: string;
  context_window?: number;
  max_output_tokens?: number;
}

interface SetDefaultBody {
  model_id: string;
}

interface CreateAliasBody {
  alias: string;
  model: string;
}

interface SetModelConfigBody {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

interface SetFallbacksBody {
  fallbacks: string[];
}

interface AddFallbackBody {
  model: string;
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
  fastify.get("/api/models/default", async () => {
    const defaultModel = await modelManager.getDefault();
    return {
      default_model_id: defaultModel,
    };
  });

  // Set the default model
  fastify.put("/api/models/default", async (
    request: FastifyRequest<{ Body: SetDefaultBody }>,
    reply: FastifyReply
  ) => {
    const { model_id } = request.body;

    if (!model_id) {
      reply.code(400);
      return { error: "Model ID is required" };
    }

    try {
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
  // Fallback Chain Management (MUST be registered before :id routes)
  // ========================================================================

  // Get the fallback chain
  fastify.get("/api/models/fallbacks", async () => {
    const fallbacks = await modelManager.getFallbacks();
    return { fallbacks };
  });

  // Set the fallback chain
  fastify.put("/api/models/fallbacks", async (
    request: FastifyRequest<{ Body: SetFallbacksBody }>,
    reply: FastifyReply
  ) => {
    const { fallbacks } = request.body;

    if (!Array.isArray(fallbacks)) {
      reply.code(400);
      return { error: "Fallbacks must be an array" };
    }

    try {
      await modelManager.setFallbacks(fallbacks);
      return {
        success: true,
        fallbacks,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set fallbacks" };
    }
  });

  // Add a model to the fallback chain
  fastify.post("/api/models/fallbacks", async (
    request: FastifyRequest<{ Body: AddFallbackBody }>,
    reply: FastifyReply
  ) => {
    const { model } = request.body;

    if (!model) {
      reply.code(400);
      return { error: "Model is required" };
    }

    try {
      await modelManager.addFallback(model);
      const fallbacks = await modelManager.getFallbacks();
      reply.code(201);
      return {
        success: true,
        model,
        fallbacks,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to add fallback" };
    }
  });

  // Remove a model from the fallback chain
  fastify.delete("/api/models/fallbacks/:model", async (
    request: FastifyRequest<{ Params: { model: string } }>,
    reply: FastifyReply
  ) => {
    const { model } = request.params;

    try {
      await modelManager.removeFallback(model);
      const fallbacks = await modelManager.getFallbacks();
      return {
        success: true,
        removed: model,
        fallbacks,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to remove fallback" };
    }
  });

  // Clear the fallback chain
  fastify.delete("/api/models/fallbacks", async (
    _request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      await modelManager.clearFallbacks();
      return {
        success: true,
        fallbacks: [],
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to clear fallbacks" };
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
                  provider: { type: "string" },
                  provider_id: { type: "string" },
                  provider_name: { type: "string" },
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
    const { workspace_path, include_global, include_provider_predefined } = request.query;

    // Parse boolean query params (default: true for include_global, false for include_provider_predefined)
    const _includeGlobal = include_global !== "false";
    const _includeProviderPredefined = include_provider_predefined === "true";

    // For now, workspace_path is not used as we use global config
    // In future, this could scope models to a specific workspace

    const models = await modelManager.listModels();
    const defaultModelId = await modelManager.getDefault();
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
            provider: { type: "string" },
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
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    // First resolve any alias
    const resolvedId = await modelManager.resolveAlias(id);
    const model = modelManager.getModelInfo(resolvedId);

    if (!model) {
      reply.code(404);
      return { error: `Model not found: ${id}` };
    }

    const [modelResponse, modelConfig] = await Promise.all([
      toSnakeCaseModel(model),
      modelManager.getModelConfig(resolvedId),
    ]);

    return {
      ...modelResponse,
      config: modelConfig,
    };
  });

  // Enable a model
  fastify.post("/api/models/:id/enable", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      await modelManager.enableModel(resolvedId);

      return {
        success: true,
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
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      await modelManager.disableModel(resolvedId);

      return {
        success: true,
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

  // Create/register a new model (Note: KNOWN_MODELS is read-only, this sets config)
  fastify.post("/api/models", async (
    request: FastifyRequest<{ Body: CreateModelBody }>,
    reply: FastifyReply
  ) => {
    const { id, set_as_default, ...config } = request.body;

    if (!id) {
      reply.code(400);
      return { error: "Model ID is required" };
    }

    try {
      // Check if model already exists
      const existingModel = modelManager.getModelInfo(id);

      if (existingModel) {
        // Model exists, set its config
        const modelConfig: ModelConfig = {
          temperature: undefined,
          maxTokens: config.max_output_tokens,
        };
        await modelManager.setModelConfig(id, modelConfig);
      } else {
        // Create new custom model
        await modelManager.createModel({
          id,
          name: config.name || id,
          provider: config.provider || "custom",
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
      const model = modelManager.getModelInfo(id);

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
      const model = modelManager.getModelInfo(resolvedId);

      if (!model) {
        reply.code(404);
        return { error: `Model not found: ${id}` };
      }

      // Update model config
      const currentConfig = await modelManager.getModelConfig(resolvedId);
      const newConfig: ModelConfig = {
        ...currentConfig,
        maxTokens: updates.max_output_tokens ?? currentConfig?.maxTokens,
      };
      await modelManager.setModelConfig(resolvedId, newConfig);

      // Reload to get updated model
      await modelManager.reload();
      const updatedModel = modelManager.getModelInfo(resolvedId);
      return toSnakeCaseModel(updatedModel ?? model);
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to update model" };
    }
  });

  // Delete/remove a model configuration
  fastify.delete("/api/models/:id", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const resolvedId = await modelManager.resolveAlias(id);

      // Remove model config
      await modelManager.removeModelConfig(resolvedId);

      // Also remove from fallbacks if present
      await modelManager.removeFallback(resolvedId);

      return {
        success: true,
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
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      const config = await modelManager.getModelConfig(resolvedId);

      if (!config) {
        reply.code(404);
        return { error: `No configuration found for model: ${id}` };
      }

      return {
        modelId: resolvedId,
        config,
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

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      await modelManager.setModelConfig(resolvedId, config);

      return {
        success: true,
        modelId: resolvedId,
        config,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set model config" };
    }
  });

  // Delete model-specific configuration
  fastify.delete("/api/models/:id/config", async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const resolvedId = await modelManager.resolveAlias(id);
      await modelManager.removeModelConfig(resolvedId);

      return {
        success: true,
        deleted: resolvedId,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to delete model config" };
    }
  });
}
