/**
 * Provider routes
 *
 * Provides HTTP API for:
 * - Provider CRUD operations (stored in ~/.viben/providers.yaml)
 * - Model discovery from provider APIs
 * - Provider-specific model management (enable/disable)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { providerManager } from "../../providers";
import { modelManager } from "../../models";
import { discoverModels } from "../../models/discovery";
import type { Provider, ProviderType, CreateProviderOptions, ProviderStatus } from "../../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Provider response (snake_case to match API conventions)
 */
interface ProviderResponse {
  id: string;
  type: string;
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

/**
 * Transform provider to API response format (snake_case)
 */
function toSnakeCaseProvider(provider: Provider): ProviderResponse {
  return {
    id: provider.id,
    type: provider.type,
    name: provider.name,
    api_key: provider.apiKey,
    base_url: provider.baseUrl,
    api_version: provider.apiVersion,
    deployment: provider.deployment,
    timeout: provider.timeout,
    max_retries: provider.maxRetries,
    headers: provider.headers,
    is_default: provider.isDefault,
    enabled: provider.enabled,
    created_at: provider.createdAt,
    updated_at: provider.updatedAt,
  };
}

/**
 * Create provider request body
 */
interface CreateProviderBody {
  type: string;
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

/**
 * Update provider request body
 */
interface UpdateProviderBody {
  type?: string;
  name?: string;
  api_key?: string;
  base_url?: string;
  api_version?: string;
  deployment?: string;
  timeout?: number;
  max_retries?: number;
  headers?: Record<string, string>;
}

/**
 * Set default provider request body
 */
interface SetDefaultProviderBody {
  provider_id: string;
}

/**
 * Model with enabled status (snake_case for API response)
 */
interface ProviderModelResponse {
  id: string;
  name: string;
  provider: string;
  description?: string;
  enabled: boolean;
  is_known: boolean;
  capabilities?: {
    chat?: boolean;
    code?: boolean;
    vision?: boolean;
    tools?: boolean;
  };
  context_window?: number;
  max_output_tokens?: number;
  input_price?: number;
  output_price?: number;
}

/**
 * Response for list provider models
 */
interface ProviderModelsResponse {
  provider_id: string;
  models: ProviderModelResponse[];
  total: number;
}

/**
 * Response for discover models (raw discovery without user config)
 */
interface DiscoverModelsResponse {
  provider_id: string;
  models: Array<{
    id: string;
    name?: string;
    description?: string;
    capabilities?: {
      chat?: boolean;
      code?: boolean;
      vision?: boolean;
      tools?: boolean;
    };
    context_window?: number;
    max_output_tokens?: number;
  }>;
  error?: string;
}

/**
 * Response for enable/disable model
 */
interface ModelToggleResponse {
  success: boolean;
  provider_id: string;
  model_id: string;
  enabled: boolean;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register provider routes
 */
export function registerProviderRoutes(fastify: FastifyInstance): void {
  // ========================================================================
  // Default Provider Management (MUST be registered before :id routes)
  // ========================================================================

  /**
   * Get the default provider
   * GET /api/providers/default
   */
  fastify.get("/api/providers/default", async () => {
    const defaultProviderId = await providerManager.getDefault();
    if (!defaultProviderId) {
      return { default_provider_id: null };
    }

    const provider = await providerManager.getProvider(defaultProviderId);
    return {
      default_provider_id: defaultProviderId,
      provider: provider ? toSnakeCaseProvider(provider) : null,
    };
  });

  /**
   * Set the default provider
   * PUT /api/providers/default
   */
  fastify.put(
    "/api/providers/default",
    async (
      request: FastifyRequest<{ Body: SetDefaultProviderBody }>,
      reply: FastifyReply
    ) => {
      const { provider_id } = request.body;

      if (!provider_id) {
        reply.code(400);
        return { error: "Provider ID is required" };
      }

      try {
        await providerManager.setDefault(provider_id);
        return {
          success: true,
          default_provider_id: provider_id,
        };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to set default provider" };
      }
    }
  );

  /**
   * Reload providers configuration from disk
   * POST /api/providers/reload
   */
  fastify.post("/api/providers/reload", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await providerManager.reload();
      return {
        success: true,
        message: "Providers configuration reloaded",
      };
    } catch (e) {
      reply.code(500);
      return { error: e instanceof Error ? e.message : "Failed to reload configuration" };
    }
  });

  // ========================================================================
  // Provider CRUD (with :id param - registered AFTER specific routes)
  // ========================================================================

  /**
   * List all providers
   * GET /api/providers
   */
  fastify.get("/api/providers", async () => {
    const providers = await providerManager.listProviders();
    const defaultProviderId = await providerManager.getDefault();
    return {
      providers: providers.map((p) => toSnakeCaseProvider(p)),
      total: providers.length,
      default_provider_id: defaultProviderId,
    };
  });

  /**
   * Create a new provider
   * POST /api/providers
   */
  fastify.post(
    "/api/providers",
    async (
      request: FastifyRequest<{ Body: CreateProviderBody }>,
      reply: FastifyReply
    ) => {
      const body = request.body;

      if (!body.type || !body.name) {
        reply.code(400);
        return { error: "Type and name are required" };
      }

      try {
        const options: CreateProviderOptions = {
          type: body.type as ProviderType,
          name: body.name,
          apiKey: body.api_key,
          baseUrl: body.base_url,
          apiVersion: body.api_version,
          deployment: body.deployment,
          timeout: body.timeout,
          maxRetries: body.max_retries,
          headers: body.headers,
          setAsDefault: body.set_as_default,
        };

        const provider = await providerManager.createProvider(options);
        reply.code(201);
        return toSnakeCaseProvider(provider);
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to create provider" };
      }
    }
  );

  /**
   * Get a specific provider by ID
   * GET /api/providers/:id
   */
  fastify.get(
    "/api/providers/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      const provider = await providerManager.getProvider(id);
      if (!provider) {
        reply.code(404);
        return { error: `Provider not found: ${id}` };
      }

      return toSnakeCaseProvider(provider);
    }
  );

  /**
   * Update a provider
   * PATCH /api/providers/:id
   */
  fastify.patch(
    "/api/providers/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateProviderBody }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const body = request.body;

      try {
        const updates: Partial<CreateProviderOptions> = {
          type: body.type as ProviderType | undefined,
          name: body.name,
          apiKey: body.api_key,
          baseUrl: body.base_url,
          apiVersion: body.api_version,
          deployment: body.deployment,
          timeout: body.timeout,
          maxRetries: body.max_retries,
          headers: body.headers,
        };

        const provider = await providerManager.updateProvider(id, updates);
        return toSnakeCaseProvider(provider);
      } catch (e) {
        if (e instanceof Error && e.message.includes("not found")) {
          reply.code(404);
          return { error: `Provider not found: ${id}` };
        }
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to update provider" };
      }
    }
  );

  /**
   * Delete a provider
   * DELETE /api/providers/:id
   */
  fastify.delete(
    "/api/providers/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        await providerManager.removeProvider(id);
        return {
          success: true,
          deleted: id,
        };
      } catch (e) {
        if (e instanceof Error && e.message.includes("not found")) {
          reply.code(404);
          return { error: `Provider not found: ${id}` };
        }
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to delete provider" };
      }
    }
  );

  /**
   * Enable a provider
   * POST /api/providers/:id/enable
   */
  fastify.post(
    "/api/providers/:id/enable",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        await providerManager.setEnabled(id, true);
        return {
          success: true,
          provider_id: id,
          enabled: true,
        };
      } catch (e) {
        if (e instanceof Error && e.message.includes("not found")) {
          reply.code(404);
          return { error: `Provider not found: ${id}` };
        }
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to enable provider" };
      }
    }
  );

  /**
   * Disable a provider
   * POST /api/providers/:id/disable
   */
  fastify.post(
    "/api/providers/:id/disable",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        await providerManager.setEnabled(id, false);
        return {
          success: true,
          provider_id: id,
          enabled: false,
        };
      } catch (e) {
        if (e instanceof Error && e.message.includes("not found")) {
          reply.code(404);
          return { error: `Provider not found: ${id}` };
        }
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to disable provider" };
      }
    }
  );

  /**
   * Test provider connection
   * POST /api/providers/:id/test
   */
  fastify.post(
    "/api/providers/:id/test",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      try {
        const status = await providerManager.checkStatus(id);
        return {
          provider_id: id,
          connected: status.connected,
          latency: status.latency,
          error: status.error,
          checked_at: status.checkedAt,
        };
      } catch (e) {
        reply.code(400);
        return { error: e instanceof Error ? e.message : "Failed to test provider" };
      }
    }
  );

  // ========================================================================
  // Model Discovery (raw API discovery without user config)
  // ========================================================================

  /**
   * Discover all available models from a provider's API
   * GET /api/providers/:id/discover-models
   *
   * This returns raw models from the provider API without user configuration.
   * Use GET /api/providers/:id/models for the combined list with enabled status.
   */
  fastify.get(
    "/api/providers/:id/discover-models",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<DiscoverModelsResponse> => {
      const { id } = request.params;

      // Check if provider exists
      const provider = await providerManager.getProvider(id);
      if (!provider) {
        reply.code(404);
        return {
          provider_id: id,
          models: [],
          error: `Provider not found: ${id}`,
        };
      }

      // Discover models from the provider API
      const result = await discoverModels(id);

      if (result.error) {
        return {
          provider_id: id,
          models: [],
          error: result.error,
        };
      }

      // Map discovered models to response format (without enabled status)
      const models = result.models.map((m) => ({
        id: m.id,
        name: m.name,
        description: undefined,
        capabilities: m.capabilities
          ? {
              chat: m.capabilities.includes("chat"),
              code: m.capabilities.includes("code"),
              vision: m.capabilities.includes("vision"),
              tools: m.capabilities.includes("tools"),
            }
          : undefined,
        context_window: m.metadata?.contextLength as number | undefined,
        max_output_tokens: m.metadata?.outputTokenLimit as number | undefined,
      }));

      return {
        provider_id: id,
        models,
      };
    }
  );

  // ========================================================================
  // Provider Models (combined discover + user config)
  // ========================================================================

  /**
   * List models for a provider (combines discovery + user configuration)
   * GET /api/providers/:id/models
   *
   * Returns models from:
   * 1. Known models for this provider type (from KNOWN_MODELS)
   * 2. User's custom models for this provider
   * Each model includes enabled status from user configuration.
   */
  fastify.get(
    "/api/providers/:id/models",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<ProviderModelsResponse> => {
      const { id } = request.params;

      // Check if provider exists
      const provider = await providerManager.getProvider(id);
      if (!provider) {
        reply.code(404);
        return {
          provider_id: id,
          models: [],
          total: 0,
        };
      }

      // Get models for this provider from modelManager (includes enabled status)
      const models = await modelManager.getModelsByProvider(provider.type);

      // Transform to response format
      const responseModels: ProviderModelResponse[] = models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        description: m.description,
        enabled: m.enabled ?? true,
        is_known: true, // TODO: distinguish known vs custom models
        context_window: m.contextLength,
        max_output_tokens: m.maxOutputTokens,
        input_price: m.inputPrice,
        output_price: m.outputPrice,
      }));

      return {
        provider_id: id,
        models: responseModels,
        total: responseModels.length,
      };
    }
  );

  /**
   * Enable a model
   * POST /api/providers/:provider_id/models/:model_id/enable
   *
   * Persists the enabled state to modelManager configuration.
   */
  fastify.post(
    "/api/providers/:provider_id/models/:model_id/enable",
    async (
      request: FastifyRequest<{ Params: { provider_id: string; model_id: string } }>,
      reply: FastifyReply
    ): Promise<ModelToggleResponse> => {
      const { provider_id, model_id } = request.params;

      // Check if provider exists
      const provider = await providerManager.getProvider(provider_id);
      if (!provider) {
        reply.code(404);
        return {
          success: false,
          provider_id,
          model_id,
          enabled: false,
        };
      }

      try {
        // Enable the model via modelManager (persists to config)
        await modelManager.enableModel(model_id);

        return {
          success: true,
          provider_id,
          model_id,
          enabled: true,
        };
      } catch (e) {
        reply.code(400);
        return {
          success: false,
          provider_id,
          model_id,
          enabled: false,
        };
      }
    }
  );

  /**
   * Disable a model
   * POST /api/providers/:provider_id/models/:model_id/disable
   *
   * Persists the disabled state to modelManager configuration.
   */
  fastify.post(
    "/api/providers/:provider_id/models/:model_id/disable",
    async (
      request: FastifyRequest<{ Params: { provider_id: string; model_id: string } }>,
      reply: FastifyReply
    ): Promise<ModelToggleResponse> => {
      const { provider_id, model_id } = request.params;

      // Check if provider exists
      const provider = await providerManager.getProvider(provider_id);
      if (!provider) {
        reply.code(404);
        return {
          success: false,
          provider_id,
          model_id,
          enabled: true,
        };
      }

      try {
        // Disable the model via modelManager (persists to config)
        await modelManager.disableModel(model_id);

        return {
          success: true,
          provider_id,
          model_id,
          enabled: false,
        };
      } catch (e) {
        reply.code(400);
        return {
          success: false,
          provider_id,
          model_id,
          enabled: true,
        };
      }
    }
  );
}
