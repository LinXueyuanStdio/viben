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
import { modelManager } from "../../models";
import type { ModelConfig } from "../../types";

// ============================================================================
// Request/Response Types
// ============================================================================

interface CreateModelBody {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
  maxOutputTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
  setAsDefault?: boolean;
}

interface UpdateModelBody {
  name?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  inputPrice?: number;
  outputPrice?: number;
}

interface SetDefaultBody {
  modelId: string;
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
  // Model CRUD
  // ========================================================================

  // List all models
  fastify.get("/api/models", async () => {
    const models = await modelManager.listModels();
    const defaultModel = await modelManager.getDefault();
    return {
      models,
      total: models.length,
      defaultModelId: defaultModel,
    };
  });

  // Get a specific model by ID
  fastify.get("/api/models/:id", async (
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

    const modelConfig = await modelManager.getModelConfig(resolvedId);
    const defaultModel = await modelManager.getDefault();

    return {
      ...model,
      isDefault: defaultModel === resolvedId,
      config: modelConfig,
    };
  });

  // Create/register a new model (Note: KNOWN_MODELS is read-only, this sets config)
  fastify.post("/api/models", async (
    request: FastifyRequest<{ Body: CreateModelBody }>,
    reply: FastifyReply
  ) => {
    const { id, setAsDefault, ...config } = request.body;

    if (!id) {
      reply.code(400);
      return { error: "Model ID is required" };
    }

    try {
      // For now, we can only configure existing known models or set aliases
      // Check if model exists
      const existingModel = modelManager.getModelInfo(id);

      if (existingModel) {
        // Model exists, set its config
        const modelConfig: ModelConfig = {
          temperature: undefined,
          maxTokens: config.maxOutputTokens,
        };
        await modelManager.setModelConfig(id, modelConfig);
      }

      // Set as default if requested
      if (setAsDefault) {
        await modelManager.setDefault(id);
      }

      reply.code(201);
      return {
        success: true,
        id,
        isDefault: setAsDefault || false,
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
        maxTokens: updates.maxOutputTokens ?? currentConfig?.maxTokens,
      };
      await modelManager.setModelConfig(resolvedId, newConfig);

      return {
        success: true,
        id: resolvedId,
      };
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
  // Default Model Management
  // ========================================================================

  // Get the default model
  fastify.get("/api/models/default", async () => {
    const defaultModel = await modelManager.getDefault();
    return {
      defaultModelId: defaultModel,
    };
  });

  // Set the default model
  fastify.put("/api/models/default", async (
    request: FastifyRequest<{ Body: SetDefaultBody }>,
    reply: FastifyReply
  ) => {
    const { modelId } = request.body;

    if (!modelId) {
      reply.code(400);
      return { error: "Model ID is required" };
    }

    try {
      await modelManager.setDefault(modelId);
      return {
        success: true,
        defaultModelId: modelId,
      };
    } catch (e) {
      reply.code(400);
      return { error: e instanceof Error ? e.message : "Failed to set default model" };
    }
  });

  // ========================================================================
  // Model Aliases
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
  // Model Configuration
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

  // ========================================================================
  // Fallback Chain Management
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
  // Provider-Specific Model Listing
  // ========================================================================

  // Get models by provider
  fastify.get("/api/providers/:provider/models", async (
    request: FastifyRequest<{ Params: { provider: string } }>
  ) => {
    const { provider } = request.params;
    const models = await modelManager.getModelsByProvider(provider);
    return {
      provider,
      models,
      total: models.length,
    };
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
}
