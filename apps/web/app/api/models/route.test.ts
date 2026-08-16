import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

interface MockGatewayModel extends Record<string, unknown> {
  id: string;
  name?: string;
  description?: string | null;
  modelType: string;
  context_window?: number;
}

const state = vi.hoisted(() => {
  const s = {
    gatewayModels: [] as MockGatewayModel[],
    requestedUrls: [] as string[],
    gatewayError: null as unknown,
    modelsDevApiData: {} as unknown,
    currentSession: null as {
      authProvider?: "vercel" | "github";
      user: { id: string; email?: string; username?: string; avatar?: string };
    } | null,
  };
  return s;
});

const originalFetch = globalThis.fetch;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

vi.mock("@viben/agent", () => ({
  gatewayInstance: {
    getAvailableModels: async () => {
      if (state.gatewayError) {
        throw state.gatewayError;
      }

      return { models: state.gatewayModels };
    },
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentSession,
}));

import * as route from "./route";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("/api/models context window enrichment", () => {
  beforeEach(() => {
    state.gatewayModels.length = 0;
    state.requestedUrls.length = 0;
    state.gatewayError = null;
    state.modelsDevApiData = {};
    state.currentSession = null;

    globalThis.fetch = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      state.requestedUrls.push(getRequestUrl(input));
      return Promise.resolve(
        new Response(JSON.stringify(state.modelsDevApiData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;
  });

  test("overrides gateway context windows from models.dev", async () => {
    state.gatewayModels.push(
      {
        id: "openai/gpt-5.3-codex",
        modelType: "language",
        context_window: 200_000,
      },
      {
        id: "anthropic/claude-opus-4.6",
        modelType: "language",
        context_window: 200_000,
      },
      {
        id: "openai/gpt-4o-mini",
        modelType: "language",
        context_window: 128_000,
      },
      {
        id: "openai/image-gen",
        modelType: "image",
        context_window: 200_000,
      },
    );

    state.modelsDevApiData = {
      openai: {
        models: {
          "gpt-5.3-codex": {
            limit: { context: 400_000 },
          },
        },
      },
      anthropic: {
        models: {
          "claude-opus-4.6": {
            limit: { context: 1_000_000 },
          },
        },
      },
    };

    const { GET } = route;
    const response = await GET(new Request("http://localhost/api/models"));

    expect(response.ok).toBe(true);

    const body = (await response.json()) as {
      models: Array<{ id: string; context_window?: number }>;
    };
    const contextById = new Map(
      body.models.map((model) => [model.id, model.context_window]),
    );

    expect(contextById.get("openai/gpt-5.3-codex")).toBe(400_000);
    expect(contextById.get("anthropic/claude-opus-4.6")).toBe(1_000_000);
    expect(contextById.get("openai/gpt-4o-mini")).toBe(128_000);
    expect(contextById.has("openai/image-gen")).toBe(false);
    expect(state.requestedUrls).toContain("https://models.dev/api.json");
  });

  test("hides Claude Opus models for managed trial users", async () => {
    state.gatewayModels.push(
      {
        id: "anthropic/claude-opus-4.6",
        modelType: "language",
      },
      {
        id: "anthropic/claude-haiku-4.5",
        modelType: "language",
      },
    );
    state.currentSession = {
      authProvider: "vercel",
      user: { id: "user-1", email: "person@example.com" },
    };

    const { GET } = route;
    const response = await GET(
      new Request("https://viben-web.vercel.app/api/models"),
    );
    const body = (await response.json()) as {
      models: Array<{ id: string }>;
    };

    expect(body.models.map((model) => model.id)).toEqual([
      "anthropic/claude-haiku-4.5",
    ]);
  });

  test("keeps gateway context window when models.dev only has related ids", async () => {
    state.gatewayModels.push({
      id: "openai/gpt-5.3-codex-2026-02-15",
      modelType: "language",
      context_window: 200_000,
    });

    state.modelsDevApiData = {
      openai: {
        models: {
          "gpt-5": {
            limit: { context: 272_000 },
          },
          "gpt-5.3-codex": {
            limit: { context: 400_000 },
          },
        },
      },
    };

    const { GET } = route;
    const response = await GET(new Request("http://localhost/api/models"));

    expect(response.ok).toBe(true);

    const body = (await response.json()) as {
      models: Array<{ id: string; context_window?: number }>;
    };

    expect(body.models).toHaveLength(1);
    expect(body.models[0]?.context_window).toBe(200_000);
  });

  test("keeps valid models.dev metadata when sibling fields are invalid", async () => {
    state.gatewayModels.push({
      id: "openai/gpt-5.3-codex",
      modelType: "language",
      context_window: 200_000,
    });

    state.modelsDevApiData = {
      invalidProvider: "bad",
      openai: {
        models: {
          "gpt-5.3-codex": {
            limit: { context: "400_000" },
            cost: {
              input: 1.25,
              output: 10,
              context_over_200k: {
                input: 2.5,
              },
            },
          },
          broken: {
            limit: { context: "not-a-number" },
            cost: { input: "expensive" },
          },
        },
      },
    };

    const { GET } = route;
    const response = await GET(new Request("http://localhost/api/models"));

    expect(response.ok).toBe(true);

    const body = (await response.json()) as {
      models: Array<{
        id: string;
        context_window?: number;
        cost?: {
          input?: number;
          output?: number;
          context_over_200k?: {
            input?: number;
          };
        };
      }>;
    };

    expect(body.models).toHaveLength(1);
    expect(body.models[0]).toMatchObject({
      id: "openai/gpt-5.3-codex",
      context_window: 200_000,
      cost: {
        input: 1.25,
        output: 10,
        context_over_200k: {
          input: 2.5,
        },
      },
    });
  });

  test("recovers from gateway validation errors when response still includes models", async () => {
    state.gatewayError = {
      response: {
        models: [
          {
            id: "openai/gpt-5.4",
            name: "GPT 5.4",
            description: "Latest GPT model",
            modelType: "language",
          },
          {
            id: "openai/gpt-5.4-broken",
            modelType: "language",
          },
          {
            id: "cohere/rerank-v3.5",
            name: "Cohere Rerank 3.5",
            description: "Reranking model",
            modelType: "reranking",
          },
        ],
      },
    };

    const { GET } = route;
    const response = await GET(new Request("http://localhost/api/models"));

    expect(response.ok).toBe(true);

    const body = (await response.json()) as {
      models: Array<{
        id: string;
        name: string;
        description?: string | null;
        modelType?: string;
      }>;
    };

    expect(body.models).toEqual([
      {
        id: "openai/gpt-5.4",
        name: "GPT 5.4",
        description: "Latest GPT model",
        modelType: "language",
      },
    ]);
  });
});
