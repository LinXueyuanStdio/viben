import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerProviderRoutes } from "./providers";
import type { Provider } from "../../types";

vi.mock("../../providers", () => ({
  providerManager: {
    listProviders: vi.fn(),
    getDefault: vi.fn(),
    getProvider: vi.fn(),
    createProvider: vi.fn(),
    updateProvider: vi.fn(),
    removeProvider: vi.fn(),
    setDefault: vi.fn(),
    reload: vi.fn(),
    setEnabled: vi.fn(),
    checkStatus: vi.fn(),
  },
}));

vi.mock("../../models", () => ({
  modelManager: {
    getModelsByProvider: vi.fn(),
    getModelsByProviderId: vi.fn(),
    enableModel: vi.fn(),
    disableModel: vi.fn(),
  },
}));

vi.mock("../../models/discovery", () => ({
  discoverModels: vi.fn(),
}));

import { providerManager } from "../../providers";
import { modelManager } from "../../models";

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
    put: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "PUT", url, handler });
    }),
    patch: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "PATCH", url, handler });
    }),
    delete: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "DELETE", url, handler });
    }),
    async inject(options: { method: string; url: string; payload?: unknown }) {
      const parsedUrl = new URL(options.url, "http://localhost");
      const pathname = parsedUrl.pathname;
      const query = Object.fromEntries(parsedUrl.searchParams.entries());
      let matchingRoute: MockRouteHandler | undefined;
      let params: Record<string, string> = {};

      for (const route of routes) {
        if (route.method !== options.method) continue;
        if (route.url === pathname) {
          matchingRoute = route;
          break;
        }

        const routeParts = route.url.split("/");
        const urlParts = pathname.split("/");
        if (routeParts.length !== urlParts.length) continue;

        const extractedParams: Record<string, string> = {};
        let isMatch = true;
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

      if (!matchingRoute) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Route not found" }),
        };
      }

      let statusCode = 200;
      const reply: MockReply = {
        code: vi.fn((code: number) => {
          statusCode = code;
          return reply;
        }),
      };

      const result = await matchingRoute.handler(
        { query, params, body: options.payload },
        reply
      );
      return {
        statusCode,
        body: JSON.stringify(result),
      };
    },
  };

  return fastify;
}

function createMockProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "openai",
    type: "openai",
    category: "llm",
    name: "OpenAI",
    surfaces: ["chat"],
    isDefault: false,
    enabled: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Provider Routes", () => {
  let fastify: ReturnType<typeof createMockFastify>;

  beforeEach(() => {
    vi.clearAllMocks();
    fastify = createMockFastify();
    registerProviderRoutes(fastify as never);
  });

  it("filters media providers with snake_case query params", async () => {
    const providers = [
      createMockProvider({ id: "openai", type: "openai", category: "llm", surfaces: ["chat"] }),
      createMockProvider({
        id: "fal",
        type: "fal",
        category: "media",
        name: "fal.ai",
        surfaces: ["image", "video"],
        supportsCustomModel: true,
      }),
    ];
    vi.mocked(providerManager.listProviders).mockResolvedValue(providers);
    vi.mocked(providerManager.getDefault).mockResolvedValue("openai");

    const response = await fastify.inject({
      method: "GET",
      url: "/api/providers?category=media&surface=video",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toEqual([
      expect.objectContaining({
        id: "fal",
        type: "fal",
        category: "media",
        surfaces: ["image", "video"],
        supports_custom_model: true,
      }),
    ]);
  });

  it("passes media provider fields when creating providers", async () => {
    const provider = createMockProvider({
      id: "fal",
      type: "fal",
      category: "media",
      surfaces: ["image", "video"],
      supportsCustomModel: true,
    });
    vi.mocked(providerManager.createProvider).mockResolvedValue(provider);

    const response = await fastify.inject({
      method: "POST",
      url: "/api/providers",
      payload: {
        type: "fal",
        name: "fal.ai",
        category: "media",
        surfaces: ["image", "video"],
        supports_custom_model: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(providerManager.createProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "fal",
        name: "fal.ai",
        category: "media",
        surfaces: ["image", "video"],
        supportsCustomModel: true,
      })
    );
  });

  it("passes media provider fields when updating providers", async () => {
    const provider = createMockProvider({
      id: "fal",
      type: "fal",
      category: "media",
      surfaces: ["video"],
    });
    vi.mocked(providerManager.updateProvider).mockResolvedValue(provider);

    const response = await fastify.inject({
      method: "PATCH",
      url: "/api/providers/fal",
      payload: {
        category: "media",
        surfaces: ["video"],
        supports_custom_model: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(providerManager.updateProvider).toHaveBeenCalledWith(
      "fal",
      expect.objectContaining({
        category: "media",
        surfaces: ["video"],
        supportsCustomModel: false,
      })
    );
  });

  it("lists models by provider_id instead of provider type", async () => {
    vi.mocked(providerManager.getProvider).mockResolvedValue(
      createMockProvider({ id: "deepseek-openai", type: "openai" })
    );
    vi.mocked(modelManager.getModelsByProviderId).mockResolvedValue([
      {
        id: "gpt-4o",
        name: "GPT-4o via DeepSeek",
        provider: "openai",
        provider_id: "deepseek-openai",
        enabled: true,
      },
    ]);

    const response = await fastify.inject({
      method: "GET",
      url: "/api/providers/deepseek-openai/models",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.provider_id).toBe("deepseek-openai");
    expect(body.models).toEqual([
      expect.objectContaining({
        id: "gpt-4o",
        provider: "openai",
        enabled: true,
      }),
    ]);
    expect(modelManager.getModelsByProviderId).toHaveBeenCalledWith("deepseek-openai");
    expect(modelManager.getModelsByProvider).not.toHaveBeenCalled();
  });

  it("uses route provider_id when enabling provider-scoped duplicate model ids", async () => {
    vi.mocked(providerManager.getProvider).mockResolvedValue(
      createMockProvider({ id: "deepseek-openai", type: "openai" })
    );
    vi.mocked(modelManager.enableModel).mockResolvedValue(undefined);

    const response = await fastify.inject({
      method: "POST",
      url: "/api/providers/deepseek-openai/models/gpt-4o/enable",
      payload: { provider_id: "openai-main" },
    });

    expect(response.statusCode).toBe(200);
    expect(modelManager.enableModel).toHaveBeenCalledWith(
      "gpt-4o",
      "openai",
      "deepseek-openai"
    );
  });

  it("uses route provider_id when disabling provider-scoped duplicate model ids", async () => {
    vi.mocked(providerManager.getProvider).mockResolvedValue(
      createMockProvider({ id: "deepseek-openai", type: "openai" })
    );
    vi.mocked(modelManager.disableModel).mockResolvedValue(undefined);

    const response = await fastify.inject({
      method: "POST",
      url: "/api/providers/deepseek-openai/models/gpt-4o/disable",
      payload: { provider_id: "openai-main" },
    });

    expect(response.statusCode).toBe(200);
    expect(modelManager.disableModel).toHaveBeenCalledWith(
      "gpt-4o",
      "openai",
      "deepseek-openai"
    );
  });
});
