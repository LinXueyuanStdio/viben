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
 * Discovered model with enabled status
 */
interface DiscoveredModelResponse {
  id: string;
  name?: string;
  description?: string;
  enabled: boolean;
  capabilities?: {
    chat?: boolean;
    code?: boolean;
    vision?: boolean;
    tools?: boolean;
  };
  context_window?: number;
  max_output_tokens?: number;
}

/**
 * Response for discover models
 */
interface DiscoverModelsResponse {
  provider_id: string;
  models: DiscoveredModelResponse[];
  error?: string;
}

/**
 * Response for list enabled models
 */
interface EnabledModelsResponse {
  provider_id: string;
  enabled_models: string[];
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
// In-memory enabled models tracking
// Provider-specific model enablement is stored per-provider
// ============================================================================

const enabledModelsPerProvider = new Map<string, Set<string>>();

/**
 * Get enabled models for a provider
 */
function getEnabledModels(providerId: string): Set<string> {
  if (!enabledModelsPerProvider.has(providerId)) {
    enabledModelsPerProvider.set(providerId, new Set());
  }
  return enabledModelsPerProvider.get(providerId)!;
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
  // Model Discovery
  // ========================================================================

  /**
   * Discover all available models from a provider
   * GET /api/providers/:id/discover-models
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

      // Discover models from the provider
      const result = await discoverModels(id);

      if (result.error) {
        return {
          provider_id: id,
          models: [],
          error: result.error,
        };
      }

      // Get enabled models for this provider
      const enabledSet = getEnabledModels(id);

      // Map discovered models to response format
      const models: DiscoveredModelResponse[] = result.models.map((m) => ({
        id: m.id,
        name: m.name,
        description: undefined,
        enabled: enabledSet.has(m.id),
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
  // Enabled Models Management
  // ========================================================================

  /**
   * List enabled models for a provider
   * GET /api/providers/:id/models
   */
  fastify.get(
    "/api/providers/:id/models",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ): Promise<EnabledModelsResponse> => {
      const { id } = request.params;

      // Check if provider exists
      const provider = await providerManager.getProvider(id);
      if (!provider) {
        reply.code(404);
        throw new Error(`Provider not found: ${id}`);
      }

      // Get enabled models for this provider
      const enabledSet = getEnabledModels(id);

      return {
        provider_id: id,
        enabled_models: Array.from(enabledSet),
      };
    }
  );

  /**
   * Enable a model for a provider
   * POST /api/providers/:provider_id/models/:model_id/enable
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
        throw new Error(`Provider not found: ${provider_id}`);
      }

      // Enable the model
      const enabledSet = getEnabledModels(provider_id);
      enabledSet.add(model_id);

      return {
        success: true,
        provider_id,
        model_id,
        enabled: true,
      };
    }
  );

  /**
   * Disable a model for a provider
   * POST /api/providers/:provider_id/models/:model_id/disable
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
        throw new Error(`Provider not found: ${provider_id}`);
      }

      // Disable the model
      const enabledSet = getEnabledModels(provider_id);
      enabledSet.delete(model_id);

      return {
        success: true,
        provider_id,
        model_id,
        enabled: false,
      };
    }
  );
}
