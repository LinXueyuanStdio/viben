/**
 * Provider routes
 *
 * Provides HTTP API for:
 * - Model discovery from provider APIs
 * - Provider-specific model management (enable/disable)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { providerManager } from "../../providers";
import { modelManager } from "../../models";
import { discoverModels } from "../../models/discovery";

// ============================================================================
// Types
// ============================================================================

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
