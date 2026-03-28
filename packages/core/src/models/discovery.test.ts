/**
 * Model Discovery Tests
 *
 * Tests for the model discovery module that discovers models from provider APIs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  discoverModels,
  discoverAllModels,
  enrichModel,
  type DiscoveredModel,
} from "./discovery";
import { providerManager } from "../providers";
import { KNOWN_MODELS, getKnownModel } from "./known-models";
import type { Provider } from "../types";

// Mock the providerManager module
vi.mock("../providers", () => ({
  providerManager: {
    getProvider: vi.fn(),
    listProviders: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Helper to create a mock provider with required fields
 */
function createMockProvider(overrides: Partial<Provider>): Provider {
  return {
    id: "test-provider",
    type: "custom",
    name: "Test Provider",
    isDefault: false,
    enabled: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("discoverModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("OpenAI API format", () => {
    it("should discover models from OpenAI provider", async () => {
      const mockProvider = createMockProvider({
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        apiKey: "sk-test-key",
        base_url: "https://api.openai.com/v1",
      });

      const mockResponse = {
        data: [
          { id: "gpt-4o", created: 1700000000, owned_by: "openai" },
          { id: "gpt-4-turbo", created: 1699000000, owned_by: "openai" },
          { id: "gpt-3.5-turbo", created: 1698000000, owned_by: "openai" },
        ],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("openai-1");

      expect(result.providerId).toBe("openai-1");
      expect(result.providerType).toBe("openai");
      expect(result.error).toBeUndefined();
      expect(result.models).toHaveLength(3);
      expect(result.models[0]).toEqual({
        id: "gpt-4o",
        name: "gpt-4o",
        created_at: 1700000000,
        owned_by: "openai",
      });
    });

    it("should use custom baseUrl for OpenAI provider", async () => {
      const mockProvider = createMockProvider({
        id: "local-openai",
        type: "openai",
        name: "Local OpenAI",
        apiKey: "sk-local-key",
        base_url: "http://localhost:8080/v1",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await discoverModels("local-openai");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/v1/models",
        expect.objectContaining({
          headers: { Authorization: "Bearer sk-local-key" },
        })
      );
    });

    it("should handle OpenAI API error", async () => {
      const mockProvider = createMockProvider({
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        apiKey: "sk-invalid-key",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await discoverModels("openai-1");

      expect(result.error).toBe("OpenAI API error: 401 Unauthorized");
      expect(result.models).toEqual([]);
    });

    it("should handle empty data array", async () => {
      const mockProvider = createMockProvider({
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        apiKey: "sk-test-key",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      const result = await discoverModels("openai-1");

      expect(result.models).toEqual([]);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Ollama API format", () => {
    it("should discover models from Ollama provider", async () => {
      const mockProvider = createMockProvider({
        id: "ollama-local",
        type: "ollama",
        name: "Ollama Local",
        base_url: "http://localhost:11434",
      });

      const mockResponse = {
        models: [
          {
            name: "llama3:latest",
            size: 4700000000,
            digest: "abc123",
            modified_at: "2024-01-15T10:00:00Z",
          },
          {
            name: "codellama:7b",
            size: 3500000000,
            digest: "def456",
            modified_at: "2024-01-14T09:00:00Z",
          },
        ],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("ollama-local");

      expect(result.providerId).toBe("ollama-local");
      expect(result.providerType).toBe("ollama");
      expect(result.models).toHaveLength(2);
      expect(result.models[0]).toEqual({
        id: "llama3:latest",
        name: "llama3:latest",
        metadata: {
          size: 4700000000,
          digest: "abc123",
          modifiedAt: "2024-01-15T10:00:00Z",
        },
      });
    });

    it("should use default Ollama URL when baseUrl not provided", async () => {
      const mockProvider = createMockProvider({
        id: "ollama-default",
        type: "ollama",
        name: "Ollama",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });

      await discoverModels("ollama-default");

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:11434/api/tags");
    });

    it("should handle Ollama API error", async () => {
      const mockProvider = createMockProvider({
        id: "ollama-local",
        type: "ollama",
        name: "Ollama Local",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await discoverModels("ollama-local");

      expect(result.error).toBe("Ollama API error: 500 Internal Server Error");
      expect(result.models).toEqual([]);
    });

    it("should handle empty models array", async () => {
      const mockProvider = createMockProvider({
        id: "ollama-empty",
        type: "ollama",
        name: "Ollama Empty",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: null }),
      });

      const result = await discoverModels("ollama-empty");

      expect(result.models).toEqual([]);
    });
  });

  describe("OpenRouter API format", () => {
    it("should discover models from OpenRouter provider", async () => {
      const mockProvider = createMockProvider({
        id: "openrouter-1",
        type: "openrouter",
        name: "OpenRouter",
        apiKey: "sk-or-test-key",
      });

      const mockResponse = {
        data: [
          {
            id: "anthropic/claude-3-opus",
            name: "Claude 3 Opus",
            context_length: 200000,
            pricing: { prompt: 15, completion: 75 },
            architecture: { model_type: "chat" },
          },
          {
            id: "openai/gpt-4o",
            name: "GPT-4o",
            context_length: 128000,
            pricing: { prompt: 2.5, completion: 10 },
          },
        ],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("openrouter-1");

      expect(result.providerId).toBe("openrouter-1");
      expect(result.providerType).toBe("openrouter");
      expect(result.models).toHaveLength(2);
      expect(result.models[0]).toEqual({
        id: "anthropic/claude-3-opus",
        name: "Claude 3 Opus",
        metadata: {
          contextLength: 200000,
          pricing: { prompt: 15, completion: 75 },
          architecture: { model_type: "chat" },
        },
      });
    });

    it("should use model ID as name when name not provided", async () => {
      const mockProvider = createMockProvider({
        id: "openrouter-1",
        type: "openrouter",
        name: "OpenRouter",
        apiKey: "sk-or-test-key",
      });

      const mockResponse = {
        data: [{ id: "some-model/variant" }],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("openrouter-1");

      expect(result.models[0].name).toBe("some-model/variant");
    });

    it("should handle OpenRouter API error", async () => {
      const mockProvider = createMockProvider({
        id: "openrouter-1",
        type: "openrouter",
        name: "OpenRouter",
        apiKey: "sk-invalid",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const result = await discoverModels("openrouter-1");

      expect(result.error).toBe("OpenRouter API error: 403 Forbidden");
    });
  });

  describe("Google AI API format", () => {
    it("should discover models from Google AI provider", async () => {
      const mockProvider = createMockProvider({
        id: "google-1",
        type: "google",
        name: "Google AI",
        apiKey: "google-api-key",
      });

      const mockResponse = {
        models: [
          {
            name: "models/gemini-1.5-pro",
            displayName: "Gemini 1.5 Pro",
            supportedGenerationMethods: ["generateContent", "countTokens"],
            description: "A versatile model",
            inputTokenLimit: 1000000,
            outputTokenLimit: 8192,
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
          },
          {
            name: "models/gemini-1.5-flash",
            displayName: "Gemini 1.5 Flash",
            supportedGenerationMethods: ["generateContent"],
            inputTokenLimit: 1000000,
            outputTokenLimit: 8192,
          },
        ],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("google-1");

      expect(result.providerId).toBe("google-1");
      expect(result.providerType).toBe("google");
      expect(result.models).toHaveLength(2);
      expect(result.models[0]).toEqual({
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        capabilities: ["generateContent", "countTokens"],
        metadata: {
          description: "A versatile model",
          inputTokenLimit: 1000000,
          outputTokenLimit: 8192,
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
        },
      });
    });

    it("should handle models without name prefix", async () => {
      const mockProvider = createMockProvider({
        id: "google-1",
        type: "google",
        name: "Google AI",
        apiKey: "google-api-key",
      });

      const mockResponse = {
        models: [{ name: "gemini-pro", displayName: "Gemini Pro" }],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("google-1");

      expect(result.models[0].id).toBe("gemini-pro");
    });

    it("should handle Google AI API error", async () => {
      const mockProvider = createMockProvider({
        id: "google-1",
        type: "google",
        name: "Google AI",
        apiKey: "invalid-key",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const result = await discoverModels("google-1");

      expect(result.error).toBe("Google AI API error: 400 Bad Request");
    });
  });

  describe("Anthropic provider", () => {
    it("should return known Anthropic models (no API call)", async () => {
      const mockProvider = createMockProvider({
        id: "anthropic-1",
        type: "anthropic",
        name: "Anthropic",
        apiKey: "sk-ant-test",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      const result = await discoverModels("anthropic-1");

      expect(result.providerId).toBe("anthropic-1");
      expect(result.providerType).toBe("anthropic");
      expect(result.error).toBeUndefined();
      expect(result.models.length).toBeGreaterThan(0);
      // Should include Claude models from KNOWN_MODELS
      expect(result.models.some((m) => m.id.includes("claude"))).toBe(true);
      // Anthropic discovery doesn't make fetch calls
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Azure provider", () => {
    it("should return known Azure-compatible models (no API call)", async () => {
      const mockProvider = createMockProvider({
        id: "azure-1",
        type: "azure",
        name: "Azure OpenAI",
        apiKey: "azure-key",
        base_url: "https://my-resource.openai.azure.com",
        deployment: "gpt-4-deployment",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      const result = await discoverModels("azure-1");

      expect(result.providerId).toBe("azure-1");
      expect(result.providerType).toBe("azure");
      expect(result.error).toBeUndefined();
      expect(result.models.length).toBeGreaterThan(0);
      // Should include OpenAI-compatible models
      expect(result.models.some((m) => m.id.includes("gpt"))).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Custom provider", () => {
    it("should try OpenAI-compatible endpoint for custom provider with baseUrl", async () => {
      const mockProvider = createMockProvider({
        id: "custom-1",
        type: "custom",
        name: "Custom LLM",
        apiKey: "custom-key",
        base_url: "http://custom-llm.local/v1",
      });

      const mockResponse = {
        data: [{ id: "custom-model-1" }, { id: "custom-model-2" }],
      };

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await discoverModels("custom-1");

      expect(result.providerId).toBe("custom-1");
      expect(result.providerType).toBe("custom");
      expect(result.models).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://custom-llm.local/v1/models",
        expect.any(Object)
      );
    });

    it("should return empty models for custom provider without baseUrl", async () => {
      const mockProvider = createMockProvider({
        id: "custom-2",
        type: "custom",
        name: "Custom No URL",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      const result = await discoverModels("custom-2");

      expect(result.models).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should handle provider not found", async () => {
      vi.mocked(providerManager.getProvider).mockResolvedValue(null);

      const result = await discoverModels("nonexistent");

      expect(result.providerId).toBe("nonexistent");
      expect(result.providerType).toBe("custom");
      expect(result.models).toEqual([]);
      expect(result.error).toBe("Provider not found: nonexistent");
    });

    it("should handle unsupported provider type", async () => {
      // Use type assertion for unsupported type test
      const mockProvider = createMockProvider({
        id: "unknown-1",
        name: "Unknown Provider",
      });
      // Override type to unsupported value for testing
      (mockProvider as { type: string }).type = "unsupported-type";

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);

      const result = await discoverModels("unknown-1");

      expect(result.error).toBe("Unsupported provider type: unsupported-type");
      expect(result.models).toEqual([]);
    });

    it("should handle network errors gracefully", async () => {
      const mockProvider = createMockProvider({
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        apiKey: "sk-test",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await discoverModels("openai-1");

      expect(result.error).toBe("Network error");
      expect(result.models).toEqual([]);
    });

    it("should handle non-Error exceptions", async () => {
      const mockProvider = createMockProvider({
        id: "openai-1",
        type: "openai",
        name: "OpenAI",
        apiKey: "sk-test",
      });

      vi.mocked(providerManager.getProvider).mockResolvedValue(mockProvider);
      mockFetch.mockRejectedValue("String error");

      const result = await discoverModels("openai-1");

      expect(result.error).toBe("String error");
      expect(result.models).toEqual([]);
    });
  });
});

describe("discoverAllModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should call discoverModels for each configured provider", async () => {
    const mockProviders = [
      createMockProvider({ id: "openai-1", type: "openai", name: "OpenAI", apiKey: "sk-1" }),
      createMockProvider({ id: "anthropic-1", type: "anthropic", name: "Anthropic", apiKey: "sk-ant" }),
      createMockProvider({ id: "ollama-1", type: "ollama", name: "Ollama" }),
    ];

    vi.mocked(providerManager.listProviders).mockResolvedValue(mockProviders);

    // Mock getProvider to return appropriate provider for each ID
    vi.mocked(providerManager.getProvider).mockImplementation(async (id) => {
      return mockProviders.find((p) => p.id === id) || null;
    });

    // Mock fetch responses
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("api.openai.com") || url.includes("/models")) {
        return {
          ok: true,
          json: () => Promise.resolve({ data: [{ id: "gpt-4o" }] }),
        };
      }
      if (url.includes("ollama") || url.includes("/api/tags")) {
        return {
          ok: true,
          json: () => Promise.resolve({ models: [{ name: "llama3" }] }),
        };
      }
      return { ok: true, json: () => Promise.resolve({ data: [] }) };
    });

    const results = await discoverAllModels();

    expect(results).toHaveLength(3);
    expect(results[0].providerId).toBe("openai-1");
    expect(results[1].providerId).toBe("anthropic-1");
    expect(results[2].providerId).toBe("ollama-1");
  });

  it("should return empty array when no providers configured", async () => {
    vi.mocked(providerManager.listProviders).mockResolvedValue([]);

    const results = await discoverAllModels();

    expect(results).toEqual([]);
  });

  it("should include results with errors for failed discoveries", async () => {
    const mockProviders = [
      createMockProvider({ id: "working", type: "anthropic", name: "Working", apiKey: "sk" }),
      createMockProvider({ id: "failing", type: "openai", name: "Failing", apiKey: "sk" }),
    ];

    vi.mocked(providerManager.listProviders).mockResolvedValue(mockProviders);
    vi.mocked(providerManager.getProvider).mockImplementation(async (id) => {
      return mockProviders.find((p) => p.id === id) || null;
    });

    mockFetch.mockRejectedValue(new Error("API unavailable"));

    const results = await discoverAllModels();

    expect(results).toHaveLength(2);
    // Anthropic doesn't make API calls so it succeeds
    expect(results[0].error).toBeUndefined();
    // OpenAI fails due to fetch error
    expect(results[1].error).toBe("API unavailable");
  });
});

describe("enrichModel", () => {
  it("should enrich discovered model with known model information", () => {
    const discovered: DiscoveredModel = {
      id: "gpt-4o",
      name: "gpt-4o",
      created_at: 1700000000,
      owned_by: "openai",
    };

    const enriched = enrichModel(discovered);

    // Should return a Model type with known information
    expect(enriched).toHaveProperty("contextLength");
    expect(enriched).toHaveProperty("maxOutputTokens");
    expect(enriched).toHaveProperty("inputPrice");
    expect(enriched).toHaveProperty("outputPrice");

    // Should match known model data
    const knownGpt4o = getKnownModel("gpt-4o");
    expect(enriched.id).toBe("gpt-4o");
    expect(enriched.name).toBe(knownGpt4o?.name);
    if ("provider" in enriched) {
      expect(enriched.provider).toBe(knownGpt4o?.provider);
      expect(enriched.contextLength).toBe(knownGpt4o?.contextLength);
    }
  });

  it("should enrich Claude model with known information", () => {
    const discovered: DiscoveredModel = {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      capabilities: ["chat", "vision"],
    };

    const enriched = enrichModel(discovered);

    expect(enriched.id).toBe("claude-3-5-sonnet-20241022");
    if ("provider" in enriched) {
      expect(enriched.provider).toBe("anthropic");
      expect(enriched.contextLength).toBe(200000);
    }
  });

  it("should return discovered model as-is when not in known models", () => {
    const discovered: DiscoveredModel = {
      id: "custom-model-xyz",
      name: "Custom Model XYZ",
      metadata: { custom: true },
    };

    const enriched = enrichModel(discovered);

    // Should return the original discovered model
    expect(enriched).toEqual(discovered);
    expect(enriched.id).toBe("custom-model-xyz");
    expect(enriched.name).toBe("Custom Model XYZ");
    // Should not have known model fields
    expect("contextLength" in enriched).toBe(false);
    expect("provider" in enriched).toBe(false);
  });

  it("should handle discovered model with minimal fields", () => {
    const discovered: DiscoveredModel = {
      id: "minimal-model",
    };

    const enriched = enrichModel(discovered);

    expect(enriched.id).toBe("minimal-model");
  });

  it("should enrich GPT-4-turbo model", () => {
    const discovered: DiscoveredModel = {
      id: "gpt-4-turbo",
      name: "gpt-4-turbo",
      owned_by: "openai",
    };

    const enriched = enrichModel(discovered);

    if ("provider" in enriched) {
      expect(enriched.provider).toBe("openai");
      expect(enriched.contextLength).toBe(128000);
      expect(enriched.maxOutputTokens).toBe(4096);
    }
  });
});

describe("Known models integration", () => {
  it("should have KNOWN_MODELS available", () => {
    expect(KNOWN_MODELS).toBeDefined();
    expect(KNOWN_MODELS.length).toBeGreaterThan(0);
  });

  it("should include OpenAI models in KNOWN_MODELS", () => {
    const openaiModels = KNOWN_MODELS.filter((m) => m.provider === "openai");
    expect(openaiModels.length).toBeGreaterThan(0);
    expect(openaiModels.some((m) => m.id === "gpt-4o")).toBe(true);
  });

  it("should include Anthropic models in KNOWN_MODELS", () => {
    const anthropicModels = KNOWN_MODELS.filter((m) => m.provider === "anthropic");
    expect(anthropicModels.length).toBeGreaterThan(0);
    expect(anthropicModels.some((m) => m.id.includes("claude"))).toBe(true);
  });

  it("should find known model by ID", () => {
    const model = getKnownModel("gpt-4o");
    expect(model).toBeDefined();
    expect(model?.name).toBe("GPT-4o");
    expect(model?.provider).toBe("openai");
  });

  it("should return undefined for unknown model ID", () => {
    const model = getKnownModel("nonexistent-model-id");
    expect(model).toBeUndefined();
  });
});
