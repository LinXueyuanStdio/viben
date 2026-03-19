/**
 * Model Routes Tests
 *
 * Tests for:
 * - Model CRUD operations (list, get, create, update, delete)
 * - Default model management (get, set)
 * - Model aliases (list, create, delete)
 * - Model configuration (get, set, delete)
 * - Fallback chain management (get, set, add, remove, clear)
 * - Model enable/disable
 * - Reload configuration
 * - Error handling (404, 400)
 *
 * These tests verify the HTTP route handlers using a mock Fastify instance
 * that simulates HTTP requests and invokes actual route handlers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
    createModel: vi.fn(),
    enableModel: vi.fn(),
    disableModel: vi.fn(),
  },
}));

// Mock the providerManager module
vi.mock("../../providers", () => ({
  providerManager: {
    listProviders: vi.fn().mockResolvedValue([]),
  },
}));

// Import the mocked modelManager
import { modelManager } from "../../models";

// Sample test data
const mockModels: Model[] = [
  {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    provider: "anthropic",
    contextLength: 200000,
    maxOutputTokens: 8192,
    isDefault: true,
    enabled: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextLength: 128000,
    maxOutputTokens: 4096,
    isDefault: false,
    enabled: true,
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "google",
    contextLength: 1000000,
    maxOutputTokens: 8192,
    isDefault: false,
    enabled: false,
  },
];

const mockModelConfig: ModelConfig = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 0.9,
};

/**
 * Mock Fastify instance for testing route handlers
 */
interface MockReply {
  code: ReturnType<typeof vi.fn>;
}

interface RouteOptions {
  schema?: unknown;
}

interface MockRouteHandler {
  method: string;
  url: string;
  handler: (request: unknown, reply: MockReply) => Promise<unknown>;
}

function createMockFastify() {
  const routes: MockRouteHandler[] = [];

  const fastify = {
    get: vi.fn((url: string, optionsOrHandler: RouteOptions | ((req: unknown, rep: MockReply) => Promise<unknown>), handler?: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      const actualHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
      routes.push({ method: "GET", url, handler: actualHandler });
    }),
    post: vi.fn((url: string, optionsOrHandler: RouteOptions | ((req: unknown, rep: MockReply) => Promise<unknown>), handler?: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      const actualHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
      routes.push({ method: "POST", url, handler: actualHandler });
    }),
    put: vi.fn((url: string, optionsOrHandler: RouteOptions | ((req: unknown, rep: MockReply) => Promise<unknown>), handler?: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      const actualHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
      routes.push({ method: "PUT", url, handler: actualHandler });
    }),
    patch: vi.fn((url: string, optionsOrHandler: RouteOptions | ((req: unknown, rep: MockReply) => Promise<unknown>), handler?: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      const actualHandler = typeof optionsOrHandler === "function" ? optionsOrHandler : handler!;
      routes.push({ method: "PATCH", url, handler: actualHandler });
    }),
    delete: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "DELETE", url, handler });
    }),
    routes,
    // Helper to find and execute a route handler
    async inject(options: { method: string; url: string; payload?: unknown }) {
      const { method, url, payload } = options;
      const parsedUrl = new URL(url, "http://localhost");
      const pathname = parsedUrl.pathname;
      const searchParams = Object.fromEntries(parsedUrl.searchParams.entries());

      // Convert string params to appropriate types
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(searchParams)) {
        query[key] = value;
      }

      // Find matching route
      let matchingRoute: MockRouteHandler | undefined;
      let params: Record<string, string> = {};

      for (const route of routes) {
        if (route.method !== method) continue;

        // Check for exact match
        if (route.url === pathname) {
          matchingRoute = route;
          break;
        }

        // Check for parameterized match (e.g., /api/models/:id)
        const routeParts = route.url.split("/");
        const urlParts = pathname.split("/");

        if (routeParts.length === urlParts.length) {
          let isMatch = true;
          const extractedParams: Record<string, string> = {};

          for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(":")) {
              extractedParams[routeParts[i].slice(1)] = urlParts[i];
            } else if (routeParts[i] !== urlParts[i]) {
              isMatch = false;
              break;
            }
          }

          if (isMatch) {
            matchingRoute = route;
            params = extractedParams;
            break;
          }
        }
      }

      if (!matchingRoute) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Route not found" }),
        };
      }

      // Create mock request and reply
      const request = {
        query,
        params,
        body: payload,
      };

      let statusCode = 200;
      const reply: MockReply = {
        code: vi.fn((code: number) => {
          statusCode = code;
          return reply;
        }),
      };

      const result = await matchingRoute.handler(request, reply);

      return {
        statusCode,
        body: JSON.stringify(result),
      };
    },
  };

  return fastify;
}

/**
 * Helper to create a mock model
 */
function createMockModel(overrides: Partial<Model> = {}): Model {
  return {
    id: "test-model",
    name: "Test Model",
    provider: "test-provider",
    contextLength: 100000,
    maxOutputTokens: 4096,
    isDefault: false,
    enabled: true,
    ...overrides,
  };
}

describe("Model Routes", () => {
  let fastify: ReturnType<typeof createMockFastify>;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();
    registerModelRoutes(fastify as never);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // GET /api/models - List all models
  // ============================================================================

  describe("GET /api/models", () => {
    it("should return empty array when no models exist", async () => {
      vi.mocked(modelManager.listModels).mockResolvedValue([]);
      vi.mocked(modelManager.getDefault).mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.models).toEqual([]);
      expect(body.total).toBe(0);
      expect(modelManager.listModels).toHaveBeenCalled();
    });

    it("should return list of all models with snake_case transformation", async () => {
      vi.mocked(modelManager.listModels).mockResolvedValue(mockModels);
      vi.mocked(modelManager.getDefault).mockResolvedValue("claude-sonnet");

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.models).toHaveLength(3);
      expect(body.total).toBe(3);
      expect(body.default_model_id).toBe("claude-sonnet");
      // Verify snake_case transformation
      expect(body.models[0].id).toBe("claude-sonnet");
      expect(body.models[0].context_window).toBe(200000);
      expect(body.models[0].max_output_tokens).toBe(8192);
      expect(body.models[0].is_default).toBe(true);
      expect(body.models[0].enabled).toBe(true);
    });

    it("should include workspace_path in response", async () => {
      vi.mocked(modelManager.listModels).mockResolvedValue([]);
      vi.mocked(modelManager.getDefault).mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models?workspace_path=/test/workspace",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe("/test/workspace");
    });
  });

  // ============================================================================
  // GET /api/models/:id - Get specific model
  // ============================================================================

  describe("GET /api/models/:id", () => {
    it("should return model when found with snake_case transformation", async () => {
      const mockModel = createMockModel({
        id: "claude-sonnet",
        name: "Claude Sonnet",
        provider: "anthropic",
        contextLength: 200000,
        maxOutputTokens: 8192,
        isDefault: true,
        enabled: true,
      });

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(mockModelConfig);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/claude-sonnet",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("claude-sonnet");
      expect(body.name).toBe("Claude Sonnet");
      expect(body.provider).toBe("anthropic");
      expect(body.context_window).toBe(200000);
      expect(body.max_output_tokens).toBe(8192);
      expect(body.is_default).toBe(true);
      expect(body.enabled).toBe(true);
      expect(body.config).toEqual(mockModelConfig);
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("claude-sonnet");
    });

    it("should return 404 when model not found", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("nonexistent");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(undefined);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/nonexistent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
      expect(body.error).toContain("nonexistent");
    });

    it("should resolve alias and return model", async () => {
      const mockModel = createMockModel({
        id: "claude-sonnet",
        name: "Claude Sonnet",
      });

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/sonnet",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("claude-sonnet");
      expect(modelManager.resolveAlias).toHaveBeenCalledWith("sonnet");
    });
  });

  // ============================================================================
  // GET /api/models/default - Get default model
  // ============================================================================

  describe("GET /api/models/default", () => {
    it("should return the default model ID", async () => {
      vi.mocked(modelManager.getDefault).mockResolvedValue("claude-sonnet");

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.default_model_id).toBe("claude-sonnet");
      expect(modelManager.getDefault).toHaveBeenCalled();
    });

    it("should return null when no default model is set", async () => {
      vi.mocked(modelManager.getDefault).mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.default_model_id).toBeNull();
    });
  });

  // ============================================================================
  // PUT /api/models/default - Set default model
  // ============================================================================

  describe("PUT /api/models/default", () => {
    it("should set the default model", async () => {
      vi.mocked(modelManager.setDefault).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: { model_id: "gpt-4o" },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.default_model_id).toBe("gpt-4o");
      expect(modelManager.setDefault).toHaveBeenCalledWith("gpt-4o");
    });

    it("should return 400 when model_id is missing", async () => {
      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model ID is required");
    });

    it("should return 400 when setDefault fails", async () => {
      vi.mocked(modelManager.setDefault).mockRejectedValue(new Error("Model not found"));

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/default",
        payload: { model_id: "nonexistent" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  // ============================================================================
  // GET /api/models/aliases - List all aliases
  // ============================================================================

  describe("GET /api/models/aliases", () => {
    it("should return all aliases", async () => {
      const mockAliases = {
        sonnet: "claude-sonnet",
        gpt: "gpt-4o",
        gemini: "gemini-pro",
      };
      vi.mocked(modelManager.getAliases).mockResolvedValue(mockAliases);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/aliases",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.aliases).toEqual(mockAliases);
      expect(modelManager.getAliases).toHaveBeenCalled();
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

  // ============================================================================
  // POST /api/models/aliases - Create alias
  // ============================================================================

  describe("POST /api/models/aliases", () => {
    it("should create a new alias", async () => {
      vi.mocked(modelManager.createAlias).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { alias: "sonnet", model: "claude-sonnet" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.alias).toBe("sonnet");
      expect(body.model).toBe("claude-sonnet");
      expect(modelManager.createAlias).toHaveBeenCalledWith("sonnet", "claude-sonnet");
    });

    it("should return 400 when alias is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { model: "claude-sonnet" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Alias and model are required");
    });

    it("should return 400 when model is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { alias: "sonnet" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Alias and model are required");
    });

    it("should return 400 when createAlias fails", async () => {
      vi.mocked(modelManager.createAlias).mockRejectedValue(new Error("Alias already exists"));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/aliases",
        payload: { alias: "sonnet", model: "claude-sonnet" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Alias already exists");
    });
  });

  // ============================================================================
  // DELETE /api/models/aliases/:alias - Delete alias
  // ============================================================================

  describe("DELETE /api/models/aliases/:alias", () => {
    it("should delete an alias", async () => {
      vi.mocked(modelManager.removeAlias).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/aliases/sonnet",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.deleted).toBe("sonnet");
      expect(modelManager.removeAlias).toHaveBeenCalledWith("sonnet");
    });

    it("should return 400 when removeAlias fails", async () => {
      vi.mocked(modelManager.removeAlias).mockRejectedValue(new Error("Alias not found"));

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
  // GET /api/models/fallbacks - Get fallback chain
  // ============================================================================

  describe("GET /api/models/fallbacks", () => {
    it("should return the fallback chain", async () => {
      const mockFallbacks = ["claude-sonnet", "gpt-4o", "gemini-pro"];
      vi.mocked(modelManager.getFallbacks).mockResolvedValue(mockFallbacks);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fallbacks).toEqual(mockFallbacks);
      expect(modelManager.getFallbacks).toHaveBeenCalled();
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

  // ============================================================================
  // PUT /api/models/fallbacks - Set fallback chain
  // ============================================================================

  describe("PUT /api/models/fallbacks", () => {
    it("should set the fallback chain", async () => {
      vi.mocked(modelManager.setFallbacks).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: { fallbacks: ["claude-sonnet", "gpt-4o"] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.fallbacks).toEqual(["claude-sonnet", "gpt-4o"]);
      expect(modelManager.setFallbacks).toHaveBeenCalledWith(["claude-sonnet", "gpt-4o"]);
    });

    it("should return 400 when fallbacks is not an array", async () => {
      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: { fallbacks: "not-an-array" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Fallbacks must be an array");
    });

    it("should return 400 when setFallbacks fails", async () => {
      vi.mocked(modelManager.setFallbacks).mockRejectedValue(new Error("Invalid model in fallbacks"));

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/fallbacks",
        payload: { fallbacks: ["nonexistent"] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid model in fallbacks");
    });
  });

  // ============================================================================
  // POST /api/models/fallbacks - Add to fallback chain
  // ============================================================================

  describe("POST /api/models/fallbacks", () => {
    it("should add a model to the fallback chain", async () => {
      vi.mocked(modelManager.addFallback).mockResolvedValue(undefined);
      vi.mocked(modelManager.getFallbacks).mockResolvedValue(["claude-sonnet", "gpt-4o"]);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: { model: "gpt-4o" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.model).toBe("gpt-4o");
      expect(body.fallbacks).toEqual(["claude-sonnet", "gpt-4o"]);
      expect(modelManager.addFallback).toHaveBeenCalledWith("gpt-4o");
    });

    it("should return 400 when model is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model is required");
    });

    it("should return 400 when addFallback fails", async () => {
      vi.mocked(modelManager.addFallback).mockRejectedValue(new Error("Model not found"));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/fallbacks",
        payload: { model: "nonexistent" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  // ============================================================================
  // DELETE /api/models/fallbacks/:model - Remove from fallback chain
  // ============================================================================

  describe("DELETE /api/models/fallbacks/:model", () => {
    it("should remove a model from the fallback chain", async () => {
      vi.mocked(modelManager.removeFallback).mockResolvedValue(undefined);
      vi.mocked(modelManager.getFallbacks).mockResolvedValue(["claude-sonnet"]);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks/gpt-4o",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.removed).toBe("gpt-4o");
      expect(body.fallbacks).toEqual(["claude-sonnet"]);
      expect(modelManager.removeFallback).toHaveBeenCalledWith("gpt-4o");
    });

    it("should return 400 when removeFallback fails", async () => {
      vi.mocked(modelManager.removeFallback).mockRejectedValue(new Error("Model not in fallbacks"));

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks/nonexistent",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not in fallbacks");
    });
  });

  // ============================================================================
  // DELETE /api/models/fallbacks - Clear fallback chain
  // ============================================================================

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

    it("should return 400 when clearFallbacks fails", async () => {
      vi.mocked(modelManager.clearFallbacks).mockRejectedValue(new Error("Failed to clear"));

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/fallbacks",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Failed to clear");
    });
  });

  // ============================================================================
  // POST /api/models/reload - Reload configuration
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
      expect(body.message).toBe("Models configuration reloaded");
      expect(modelManager.reload).toHaveBeenCalled();
    });

    it("should return 500 when reload fails", async () => {
      vi.mocked(modelManager.reload).mockRejectedValue(new Error("Failed to reload"));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/reload",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Failed to reload");
    });
  });

  // ============================================================================
  // POST /api/models - Create model
  // ============================================================================

  describe("POST /api/models", () => {
    it("should create a new model", async () => {
      const newModel = createMockModel({
        id: "custom-model",
        name: "Custom Model",
        provider: "custom",
      });

      vi.mocked(modelManager.getModelInfo).mockReturnValueOnce(undefined).mockReturnValueOnce(newModel);
      vi.mocked(modelManager.createModel).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "custom-model",
          name: "Custom Model",
          provider: "custom",
          context_window: 100000,
          max_output_tokens: 4096,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("custom-model");
      expect(modelManager.createModel).toHaveBeenCalled();
    });

    it("should update existing model config", async () => {
      const existingModel = createMockModel({
        id: "claude-sonnet",
        name: "Claude Sonnet",
      });

      vi.mocked(modelManager.getModelInfo).mockReturnValue(existingModel);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "claude-sonnet",
          name: "Claude Sonnet",
          provider: "anthropic",
          max_output_tokens: 8192,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(modelManager.setModelConfig).toHaveBeenCalled();
    });

    it("should return 400 when model_id is missing", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          name: "Custom Model",
          provider: "custom",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model ID is required");
    });

    it("should set model as default when set_as_default is true", async () => {
      const newModel = createMockModel({
        id: "custom-model",
        isDefault: true,
      });

      vi.mocked(modelManager.getModelInfo).mockReturnValueOnce(undefined).mockReturnValueOnce(newModel);
      vi.mocked(modelManager.createModel).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models",
        payload: {
          id: "custom-model",
          name: "Custom Model",
          provider: "custom",
          set_as_default: true,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(modelManager.createModel).toHaveBeenCalledWith(
        expect.objectContaining({
          setAsDefault: true,
        })
      );
    });
  });

  // ============================================================================
  // PATCH /api/models/:id - Update model
  // ============================================================================

  describe("PATCH /api/models/:id", () => {
    it("should update model configuration", async () => {
      const mockModel = createMockModel({
        id: "claude-sonnet",
        name: "Claude Sonnet",
      });

      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(mockModel);
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(mockModelConfig);
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.reload).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/claude-sonnet",
        payload: {
          name: "Updated Claude Sonnet",
          max_output_tokens: 16384,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe("claude-sonnet");
      expect(modelManager.setModelConfig).toHaveBeenCalled();
    });

    it("should return 404 when model not found", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("nonexistent");
      vi.mocked(modelManager.getModelInfo).mockReturnValue(undefined);

      const response = await fastify.inject({
        method: "PATCH",
        url: "/api/models/nonexistent",
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  // ============================================================================
  // DELETE /api/models/:id - Delete model
  // ============================================================================

  describe("DELETE /api/models/:id", () => {
    it("should delete model configuration", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("custom-model");
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);
      vi.mocked(modelManager.removeFallback).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/custom-model",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.deleted).toBe("custom-model");
      expect(modelManager.removeModelConfig).toHaveBeenCalledWith("custom-model");
      expect(modelManager.removeFallback).toHaveBeenCalledWith("custom-model");
    });

    it("should return 400 when deletion fails", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("nonexistent");
      vi.mocked(modelManager.removeModelConfig).mockRejectedValue(new Error("Model not found"));

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/nonexistent",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  // ============================================================================
  // POST /api/models/:id/enable - Enable model
  // ============================================================================

  describe("POST /api/models/:id/enable", () => {
    it("should enable a model", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.enableModel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/claude-sonnet/enable",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.model_id).toBe("claude-sonnet");
      expect(body.enabled).toBe(true);
      expect(modelManager.enableModel).toHaveBeenCalledWith("claude-sonnet");
    });

    it("should return 404 when model not found", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("nonexistent");
      vi.mocked(modelManager.enableModel).mockRejectedValue(new Error("Model not found"));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/nonexistent/enable",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  // ============================================================================
  // POST /api/models/:id/disable - Disable model
  // ============================================================================

  describe("POST /api/models/:id/disable", () => {
    it("should disable a model", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.disableModel).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/claude-sonnet/disable",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.model_id).toBe("claude-sonnet");
      expect(body.enabled).toBe(false);
      expect(modelManager.disableModel).toHaveBeenCalledWith("claude-sonnet");
    });

    it("should return 404 when model not found", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("nonexistent");
      vi.mocked(modelManager.disableModel).mockRejectedValue(new Error("Model not found"));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/models/nonexistent/disable",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Model not found");
    });
  });

  // ============================================================================
  // GET /api/models/:id/config - Get model config
  // ============================================================================

  describe("GET /api/models/:id/config", () => {
    it("should return model configuration", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(mockModelConfig);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/claude-sonnet/config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.modelId).toBe("claude-sonnet");
      expect(body.config).toEqual(mockModelConfig);
      expect(modelManager.getModelConfig).toHaveBeenCalledWith("claude-sonnet");
    });

    it("should return 404 when no config found", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.getModelConfig).mockResolvedValue(null);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/models/claude-sonnet/config",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("No configuration found");
    });
  });

  // ============================================================================
  // PUT /api/models/:id/config - Set model config
  // ============================================================================

  describe("PUT /api/models/:id/config", () => {
    it("should set model configuration", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.setModelConfig).mockResolvedValue(undefined);

      const newConfig = {
        temperature: 0.8,
        maxTokens: 8192,
      };

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/claude-sonnet/config",
        payload: newConfig,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.modelId).toBe("claude-sonnet");
      expect(body.config).toEqual(newConfig);
      expect(modelManager.setModelConfig).toHaveBeenCalledWith("claude-sonnet", newConfig);
    });

    it("should return 400 when setModelConfig fails", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.setModelConfig).mockRejectedValue(new Error("Invalid config"));

      const response = await fastify.inject({
        method: "PUT",
        url: "/api/models/claude-sonnet/config",
        payload: { temperature: 2.0 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Invalid config");
    });
  });

  // ============================================================================
  // DELETE /api/models/:id/config - Delete model config
  // ============================================================================

  describe("DELETE /api/models/:id/config", () => {
    it("should delete model configuration", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.removeModelConfig).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/claude-sonnet/config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.deleted).toBe("claude-sonnet");
      expect(modelManager.removeModelConfig).toHaveBeenCalledWith("claude-sonnet");
    });

    it("should return 400 when removeModelConfig fails", async () => {
      vi.mocked(modelManager.resolveAlias).mockResolvedValue("claude-sonnet");
      vi.mocked(modelManager.removeModelConfig).mockRejectedValue(new Error("Config not found"));

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/models/claude-sonnet/config",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Config not found");
    });
  });
});
