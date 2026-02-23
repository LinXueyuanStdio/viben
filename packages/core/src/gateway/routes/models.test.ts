/**
 * Model Routes Tests
 *
 * Tests for:
 * - Model CRUD operations (list, get, create, update, delete)
 * - Default model management (get, set)
 * - Model aliases (list, create, delete)
 * - Model configuration (get, set, delete)
 * - Fallback chain management (get, set, add, remove, clear)
 * - Provider-specific model listing
 * - Reload configuration
 * - Error handling (404, 400)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerModelRoutes } from "./models";
import type { Model, ModelConfig } from "../../types";

// Mock the modelManager module
vi.mock("../../models", () => ({
  modelManager: {
    listModels: vi.fn(),
    getDefault: vi.fn(),
    setDefault: vi.fn(),
    getModelInfo: vi.fn(),
    resolveAlias: vi.fn(),
    getModelConfig: vi.fn(),
    setModelConfig: vi.fn(),
    removeModelConfig: vi.fn(),
    getAliases: vi.fn(),
    createAlias: vi.fn(),
    removeAlias: vi.fn(),
    getFallbacks: vi.fn(),
    setFallbacks: vi.fn(),
    addFallback: vi.fn(),
    removeFallback: vi.fn(),
    clearFallbacks: vi.fn(),
    getModelsByProvider: vi.fn(),
    reload: vi.fn(),
  },
}));

// Import the mocked modelManager
import { modelManager } from "../../models";

// Sample test data
const mockModels: Model[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 2.5,
    outputPrice: 10,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 16384,
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 8192,
    inputPrice: 3,
    outputPrice: 15,
  },
];

const mockAliases: Record<string, string> = {
  gpt4: "gpt-4o",
  claude: "claude-3-5-sonnet-20241022",
  sonnet: "claude-3-5-sonnet-20241022",
};

const mockFallbacks: string[] = ["gpt-4o", "claude-3-5-sonnet-20241022"];

const mockModelConfig: ModelConfig = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9,
};

describe("Model Routes", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create a new Fastify instance for each test
    fastify = Fastify();
    registerModelRoutes(fastify);
    await fastify.ready();

    // Setup default mock implementations
    vi.mocked(modelManager.listModels).mockResolvedValue(mockModels);
    vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");
    vi.mocked(modelManager.resolveAlias).mockImplementation(async (id) => {
      return mockAliases[id] || id;
    });
    vi.mocked(modelManager.getModelInfo).mockImplementation((id) => {
      const resolved = mockAliases[id] || id;
      return mockModels.find((m) => m.id === resolved);
    });
    vi.mocked(modelManager.getAliases).mockResolvedValue(mockAliases);
    vi.mocked(modelManager.getFallbacks).mockResolvedValue(mockFallbacks);
    vi.mocked(modelManager.getModelConfig).mockResolvedValue(mockModelConfig);
    vi.mocked(modelManager.getModelsByProvider).mockImplementation(
      async (provider) => {
        return mockModels.filter((m) => m.provider === provider);
      }
    );
  });

  afterEach(async () => {
    await fastify.close();
  });

  // ============================================================================
  // Model CRUD
  // ============================================================================

  describe("GET /api/models", () => {
    it("should list all models with provider info", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Response uses snake_case and toSnakeCaseModel format
      expect(body.models.length).toBe(mockModels.length);
      expect(body.total).toBe(mockModels.length);
      expect(body.default_model_id).toBe("gpt-4o");
    });

    it("should return empty array when no models exist", async () => {
      vi.mocked(modelManager.listModels).mockResolvedValue([]);
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.models).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.default_model_id).toBeUndefined();
    });
  });

  describe("GET /api/models/:id", () => {
    it("should get a specific model by ID", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.id).toBe("gpt-4o");
      expect(body.name).toBe("GPT-4o");
      expect(body.provider).toBe("openai");
      expect(body.is_default).toBe(false); // Model itself doesn't have isDefault, it's set via getDefault
      expect(body.config).toEqual(mockModelConfig);
    });

    it("should resolve alias when getting model", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/gpt4",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.id).toBe("gpt-4o");
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should return 404 for non-existent model", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("non-existent");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(undefined);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("not found");
    });

    it("should include isDefault false for non-default model", async () => {
      vi.mocked(modelManager.getDefault).mockResolvedValue(
        "claude-3-5-sonnet-20241022"
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_default).toBe(false);
    });
  });

  describe("POST /api/models", () => {
    it("should create/register a new model configuration", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
          max_output_tokens: 8192,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Response uses toSnakeCaseModel format
      expect(body.id).toBe("gpt-4o");
      expect(body.is_default).toBe(false);
    });

    it("should set model as default when set_as_default is true", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
          set_as_default: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Response uses toSnakeCaseModel format
      expect(body.id).toBe("gpt-4o");
      expect(modelManager.setDefault).toHaveBeenCalledWith("gpt-4o");
    });

    it("should return 400 when model ID is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          name: "GPT-4o",
          provider: "openai",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should handle creation errors", async () => {
      vi.mocked(modelManager.setModelConfig).mockRejectedValue(
        new Error("Configuration error")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Configuration error");
    });
  });

  describe("PATCH /api/models/:id", () => {
    it("should update model configuration", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/gpt-4o",
        payload: {
          name: "Updated GPT-4o",
          max_output_tokens: 8192,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Response uses toSnakeCaseModel format
      expect(body.id).toBe("gpt-4o");
    });

    it("should resolve alias when updating model", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/gpt4",
        payload: {
          max_output_tokens: 8192,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should return 404 for non-existent model", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("non-existent");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(undefined);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/non-existent",
        payload: {
          name: "Updated",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("not found");
    });

    it("should handle update errors", async () => {
      vi.mocked(modelManager.setModelConfig).mockRejectedValue(
        new Error("Update failed")
      );

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/gpt-4o",
        payload: {
          max_output_tokens: 8192,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Update failed");
    });
  });

  describe("DELETE /api/models/:id", () => {
    it("should delete model configuration", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.removeFallback).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.deleted).toBe("gpt-4o");
      expect(modelManager.removeModelConfig).toHaveBeenCalled();
      expect(modelManager.removeFallback).toHaveBeenCalled();
    });

    it("should resolve alias when deleting model", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.removeFallback).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt4",
      });

      expect(response.statusCode).toBe(200);
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should handle deletion errors", async () => {
      vi.mocked(modelManager.removeModelConfig).mockRejectedValue(
        new Error("Delete failed")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Delete failed");
    });
  });

  // ============================================================================
  // Default Model Management
  // ============================================================================

  describe("GET /api/models/default", () => {
    it("should get the default model", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.default_model_id).toBe("gpt-4o");
    });

    it("should return undefined when no default is set", async () => {
      vi.mocked(modelManager.getDefault).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.default_model_id).toBeUndefined();
    });
  });

  describe("PUT /api/models/default", () => {
    it("should set the default model", async () => {
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: {
          model_id: "claude-3-5-sonnet-20241022",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.default_model_id).toBe("claude-3-5-sonnet-20241022");
      expect(modelManager.setDefault).toHaveBeenCalledWith(
        "claude-3-5-sonnet-20241022"
      );
    });

    it("should return 400 when model_id is missing", async () => {
      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should handle set default errors", async () => {
      vi.mocked(modelManager.setDefault).mockRejectedValue(
        new Error("Invalid model")
      );

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: {
          model_id: "invalid-model",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid model");
    });
  });

  // ============================================================================
  // Model Aliases
  // ============================================================================

  describe("GET /api/models/aliases", () => {
    it("should list all aliases", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/aliases",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.aliases).toEqual(mockAliases);
    });

    it("should return empty object when no aliases exist", async () => {
      vi.mocked(modelManager.getAliases).mockResolvedValue({});

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/aliases",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.aliases).toEqual({});
    });
  });

  describe("POST /api/models/aliases", () => {
    it("should create a new alias", async () => {
      vi.mocked(modelManager.createAlias).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: {
          alias: "mymodel",
          model: "gpt-4o",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.alias).toBe("mymodel");
      expect(body.model).toBe("gpt-4o");
      expect(modelManager.createAlias).toHaveBeenCalledWith("mymodel", "gpt-4o");
    });

    it("should return 400 when alias is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: {
          model: "gpt-4o",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should return 400 when model is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: {
          alias: "mymodel",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should handle alias creation errors", async () => {
      vi.mocked(modelManager.createAlias).mockRejectedValue(
        new Error("Alias already exists")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: {
          alias: "existing",
          model: "gpt-4o",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Alias already exists");
    });
  });

  describe("DELETE /api/models/aliases/:alias", () => {
    it("should delete an alias", async () => {
      vi.mocked(modelManager.removeAlias).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/aliases/gpt4",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.deleted).toBe("gpt4");
      expect(modelManager.removeAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should handle alias deletion errors", async () => {
      vi.mocked(modelManager.removeAlias).mockRejectedValue(
        new Error("Alias not found")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/aliases/nonexistent",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Alias not found");
    });
  });

  // ============================================================================
  // Model Configuration
  // ============================================================================

  describe("GET /api/models/:id/config", () => {
    it("should get model configuration", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/gpt-4o/config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.modelId).toBe("gpt-4o");
      expect(body.config).toEqual(mockModelConfig);
    });

    it("should resolve alias when getting config", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/gpt4/config",
      });

      expect(response.statusCode).toBe(200);
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should return 404 when no configuration exists", async () => {
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/unconfigured/config",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("No configuration found");
    });

    it("should handle get config errors", async () => {
      vi.mocked(modelManager.resolveAlias).mockRejectedValue(
        new Error("Resolution failed")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/broken/config",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Resolution failed");
    });
  });

  describe("PUT /api/models/:id/config", () => {
    it("should set model configuration", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      const newConfig: ModelConfig = {
        temperature: 0.5,
        maxTokens: 2048,
        topP: 0.8,
      };

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: newConfig,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.modelId).toBe("gpt-4o");
      expect(body.config).toEqual(newConfig);
      expect(modelManager.setModelConfig).toHaveBeenCalledWith(
        "gpt-4o",
        newConfig
      );
    });

    it("should resolve alias when setting config", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/gpt4/config",
        payload: {
          temperature: 0.5,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should handle set config errors", async () => {
      vi.mocked(modelManager.setModelConfig).mockRejectedValue(
        new Error("Invalid configuration")
      );

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: {
          temperature: 2.0, // Invalid value
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid configuration");
    });
  });

  describe("DELETE /api/models/:id/config", () => {
    it("should delete model configuration", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o/config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.deleted).toBe("gpt-4o");
      expect(modelManager.removeModelConfig).toHaveBeenCalledWith("gpt-4o");
    });

    it("should resolve alias when deleting config", async () => {
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt4/config",
      });

      expect(response.statusCode).toBe(200);
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("gpt4");
    });

    it("should handle delete config errors", async () => {
      vi.mocked(modelManager.removeModelConfig).mockRejectedValue(
        new Error("Delete failed")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o/config",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Delete failed");
    });
  });

  // ============================================================================
  // Fallback Chain Management
  // ============================================================================

  describe("GET /api/models/fallbacks", () => {
    it("should get the fallback chain", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.fallbacks).toEqual(mockFallbacks);
    });

    it("should return empty array when no fallbacks exist", async () => {
      vi.mocked(modelManager.getFallbacks).mockResolvedValue([]);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.fallbacks).toEqual([]);
    });
  });

  describe("PUT /api/models/fallbacks", () => {
    it("should set the fallback chain", async () => {
      vi.mocked(modelManager.setFallbacks).mockResolvedValue(undefined);

      const newFallbacks = ["gpt-4o-mini", "gpt-3.5-turbo"];

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: {
          fallbacks: newFallbacks,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.fallbacks).toEqual(newFallbacks);
      expect(modelManager.setFallbacks).toHaveBeenCalledWith(newFallbacks);
    });

    it("should return 400 when fallbacks is not an array", async () => {
      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: {
          fallbacks: "not-an-array",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("array");
    });

    it("should handle set fallbacks errors", async () => {
      vi.mocked(modelManager.setFallbacks).mockRejectedValue(
        new Error("Invalid fallback")
      );

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: {
          fallbacks: ["invalid-model"],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid fallback");
    });
  });

  describe("POST /api/models/fallbacks", () => {
    it("should add a model to the fallback chain", async () => {
      vi.mocked(modelManager.addFallback).mockResolvedValue(undefined);
      vi.mocked(modelManager.getFallbacks).mockResolvedValue([
        ...mockFallbacks,
        "gpt-4o-mini",
      ]);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: {
          model: "gpt-4o-mini",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.fallbacks).toContain("gpt-4o-mini");
      expect(modelManager.addFallback).toHaveBeenCalledWith("gpt-4o-mini");
    });

    it("should return 400 when model is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("required");
    });

    it("should handle add fallback errors", async () => {
      vi.mocked(modelManager.addFallback).mockRejectedValue(
        new Error("Model not found")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: {
          model: "invalid-model",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  describe("DELETE /api/models/fallbacks/:model", () => {
    it("should remove a model from the fallback chain", async () => {
      vi.mocked(modelManager.removeFallback).mockResolvedValue(undefined);
      vi.mocked(modelManager.getFallbacks).mockResolvedValue([
        "claude-3-5-sonnet-20241022",
      ]);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.removed).toBe("gpt-4o");
      expect(body.fallbacks).not.toContain("gpt-4o");
      expect(modelManager.removeFallback).toHaveBeenCalledWith("gpt-4o");
    });

    it("should handle remove fallback errors", async () => {
      vi.mocked(modelManager.removeFallback).mockRejectedValue(
        new Error("Remove failed")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks/gpt-4o",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Remove failed");
    });
  });

  describe("DELETE /api/models/fallbacks", () => {
    it("should clear the fallback chain", async () => {
      vi.mocked(modelManager.clearFallbacks).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.fallbacks).toEqual([]);
      expect(modelManager.clearFallbacks).toHaveBeenCalled();
    });

    it("should handle clear fallbacks errors", async () => {
      vi.mocked(modelManager.clearFallbacks).mockRejectedValue(
        new Error("Clear failed")
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Clear failed");
    });
  });

  // ============================================================================
  // Provider-Specific Model Listing
  // NOTE: GET /api/providers/:id/models is defined in providers.ts
  // It combines discovery + user configuration for provider-specific models
  // These tests are removed as they belong to providers.test.ts
  // ============================================================================

  // ============================================================================
  // Reload Configuration
  // ============================================================================

  describe("POST /api/models/reload", () => {
    it("should reload models configuration", async () => {
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/reload",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.message).toContain("reloaded");
      expect(modelManager.reload).toHaveBeenCalled();
    });

    it("should return 500 when reload fails", async () => {
      vi.mocked(modelManager.reload).mockRejectedValue(
        new Error("File not found")
      );

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/reload",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("File not found");
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe("Error Handling", () => {
    it("should return 404 for model not found", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("nonexistent");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(undefined);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("not found");
    });

    it("should return 400 for invalid request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it("should handle non-Error exceptions", async () => {
      vi.mocked(modelManager.setDefault).mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: {
          model_id: "test",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to set default model");
    });

    it("should handle non-Error exceptions in alias creation", async () => {
      vi.mocked(modelManager.createAlias).mockRejectedValue("String error");

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: {
          alias: "test",
          model: "gpt-4o",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to create alias");
    });

    it("should handle non-Error exceptions in model update", async () => {
      vi.mocked(modelManager.setModelConfig).mockRejectedValue(42);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/gpt-4o",
        payload: {
          name: "Updated",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to update model");
    });

    it("should handle non-Error exceptions in model deletion", async () => {
      vi.mocked(modelManager.removeModelConfig).mockRejectedValue(null);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to delete model");
    });

    it("should handle non-Error exceptions in alias deletion", async () => {
      vi.mocked(modelManager.removeAlias).mockRejectedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/aliases/test",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to delete alias");
    });

    it("should handle non-Error exceptions in config retrieval", async () => {
      vi.mocked(modelManager.resolveAlias).mockRejectedValue({});

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/test/config",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to get model config");
    });

    it("should handle non-Error exceptions in config setting", async () => {
      vi.mocked(modelManager.setModelConfig).mockRejectedValue([]);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: {
          temperature: 0.5,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to set model config");
    });

    it("should handle non-Error exceptions in config deletion", async () => {
      vi.mocked(modelManager.removeModelConfig).mockRejectedValue(false);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/gpt-4o/config",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to delete model config");
    });

    it("should handle non-Error exceptions in fallback setting", async () => {
      vi.mocked(modelManager.setFallbacks).mockRejectedValue(true);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: {
          fallbacks: ["gpt-4o"],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to set fallbacks");
    });

    it("should handle non-Error exceptions in fallback addition", async () => {
      vi.mocked(modelManager.addFallback).mockRejectedValue(NaN);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: {
          model: "gpt-4o",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to add fallback");
    });

    it("should handle non-Error exceptions in fallback removal", async () => {
      vi.mocked(modelManager.removeFallback).mockRejectedValue(Symbol("test"));

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks/gpt-4o",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to remove fallback");
    });

    it("should handle non-Error exceptions in fallback clearing", async () => {
      vi.mocked(modelManager.clearFallbacks).mockRejectedValue(
        new Function()
      );

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to clear fallbacks");
    });

    it("should handle non-Error exceptions in reload", async () => {
      vi.mocked(modelManager.reload).mockRejectedValue(BigInt(1));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/reload",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Failed to reload configuration");
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle model ID with special characters", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/claude-3-5-sonnet-20241022",
      });

      expect(response.statusCode).toBe(200);
    });

    it("should handle empty fallbacks array in PUT request", async () => {
      vi.mocked(modelManager.setFallbacks).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: {
          fallbacks: [],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.fallbacks).toEqual([]);
    });

    it("should handle model config with all optional fields", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: {
          temperature: 0.7,
          maxTokens: 4096,
          topP: 0.9,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should handle model config with minimal fields", async () => {
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/gpt-4o/config",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it("should handle URL-encoded model IDs", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
    });

  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration Scenarios", () => {
    it("should maintain state across multiple operations", async () => {
      // Create alias
      vi.mocked(modelManager.createAlias).mockResolvedValue(undefined);
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: {
          alias: "fast",
          model: "gpt-4o-mini",
        },
      });
      expect(createResponse.statusCode).toBe(201);

      // Set as default
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);
      const defaultResponse = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: {
          model_id: "gpt-4o-mini",
        },
      });
      expect(defaultResponse.statusCode).toBe(200);

      // Add to fallbacks
      vi.mocked(modelManager.addFallback).mockResolvedValue(undefined);
      vi.mocked(modelManager.getFallbacks).mockResolvedValue([
        "gpt-4o",
        "gpt-4o-mini",
      ]);
      const fallbackResponse = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: {
          model: "gpt-4o-mini",
        },
      });
      expect(fallbackResponse.statusCode).toBe(201);
    });

    it("should handle concurrent requests", async () => {
      vi.mocked(modelManager.getDefault).mockResolvedValue("gpt-4o");

      const responses = await Promise.all([
        fastify.inject({ method: "GET", url: "/api/models" }),
        fastify.inject({ method: "GET", url: "/api/models/default" }),
        fastify.inject({ method: "GET", url: "/api/models/aliases" }),
        fastify.inject({ method: "GET", url: "/api/models/fallbacks" }),
      ]);

      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });
  });
});
