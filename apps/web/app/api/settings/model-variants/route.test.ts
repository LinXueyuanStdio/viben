import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ModelVariant } from "@/lib/model-variants";

vi.mock("server-only", () => ({}));

const PROVIDER_OPTIONS_MAX_BYTES = 16 * 1024;

interface MockPreferences {
  defaultModelId: string;
  defaultSubagentModelId: string | null;
  defaultSandboxType: "vercel";
  defaultDiffMode: "unified" | "split";
  modelVariants: ModelVariant[];
}

const state = vi.hoisted(() => {
  const s = {
    currentSession: {
      user: {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
      },
    } as {
      authProvider?: "vercel" | "github";
      user: {
        id: string;
        username: string;
        email?: string;
      };
    } | null,
    preferences: {} as MockPreferences,
  };
  return s;
});

function resetPreferences() {
  state.preferences = {
    defaultModelId: "anthropic/claude-haiku-4.5",
    defaultSubagentModelId: null,
    defaultSandboxType: "vercel",
    defaultDiffMode: "unified",
    modelVariants: [],
  };
}

function createProviderOptionsWithExactSize(
  targetBytes: number,
): Record<string, string> {
  const emptyPayload = { payload: "" };
  const emptySize = new TextEncoder().encode(
    JSON.stringify(emptyPayload),
  ).length;
  const payloadLength = Math.max(0, targetBytes - emptySize);

  return {
    payload: "x".repeat(payloadLength),
  };
}

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentSession,
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => state.preferences,
  updateUserPreferences: async (
    _userId: string,
    updates: Partial<MockPreferences>,
  ) => {
    state.preferences = {
      ...state.preferences,
      ...updates,
      modelVariants: updates.modelVariants ?? state.preferences.modelVariants,
    };
    return state.preferences;
  },
}));

import * as route from "./route";

describe("/api/settings/model-variants", () => {
  beforeEach(() => {
    state.currentSession = {
      user: {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
      },
    };
    resetPreferences();
  });

  test("GET returns 401 when unauthenticated", async () => {
    state.currentSession = null;

    const { GET } = route;
    const response = await GET(
      new Request("http://localhost/api/settings/model-variants"),
    );

    expect(response.status).toBe(401);
  });

  test("GET hides Opus-backed variants for managed trial users", async () => {
    state.preferences.modelVariants = [
      {
        id: "variant:user-opus",
        name: "User Opus",
        baseModelId: "anthropic/claude-opus-4.6",
        providerOptions: {},
      },
    ];
    state.currentSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
      },
    };

    const { GET } = route;
    const response = await GET(
      new Request("https://viben-web.vercel.app/api/settings/model-variants"),
    );
    const body = (await response.json()) as { modelVariants: ModelVariant[] };

    expect(body.modelVariants.map((variant) => variant.id)).toEqual([
      "variant:builtin:gpt-5.4-xhigh",
    ]);
  });

  test("POST rejects invalid JSON body", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/settings/model-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
  });

  test("POST creates a model variant and returns full list", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/settings/model-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "OpenAI Medium",
          baseModelId: "openai/gpt-5",
          providerOptions: {
            reasoningEffort: "medium",
          },
        }),
      }),
    );

    expect(response.ok).toBe(true);

    const body = (await response.json()) as { modelVariants: ModelVariant[] };
    expect(body.modelVariants).toHaveLength(3);
    expect(body.modelVariants[2]?.id.startsWith("variant:")).toBe(true);
    expect(body.modelVariants[2]?.name).toBe("OpenAI Medium");
  });

  test("POST rejects Opus-backed variants for managed trial users", async () => {
    state.currentSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        username: "alice",
        email: "alice@example.com",
      },
    };

    const { POST } = route;
    const response = await POST(
      new Request("https://viben-web.vercel.app/api/settings/model-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "User Opus",
          baseModelId: "anthropic/claude-opus-4.6",
          providerOptions: {},
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("POST accepts provider options exactly at 16KB", async () => {
    const { POST } = route;

    const exactProviderOptions = createProviderOptionsWithExactSize(
      PROVIDER_OPTIONS_MAX_BYTES,
    );

    const response = await POST(
      new Request("http://localhost/api/settings/model-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Exact 16KB",
          baseModelId: "openai/gpt-5",
          providerOptions: exactProviderOptions,
        }),
      }),
    );

    expect(response.ok).toBe(true);
  });

  test("POST rejects provider options larger than 16KB", async () => {
    const { POST } = route;

    const response = await POST(
      new Request("http://localhost/api/settings/model-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Too big",
          baseModelId: "openai/gpt-5",
          providerOptions: {
            payload: "x".repeat(17_000),
          },
        }),
      }),
    );

    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("16 KB");
  });

  test("PATCH rejects payloads without fields to update", async () => {
    state.preferences.modelVariants = [
      {
        id: "variant:openai-medium",
        name: "OpenAI Medium",
        baseModelId: "openai/gpt-5",
        providerOptions: { reasoningEffort: "medium" },
      },
    ];

    const { PATCH } = route;
    const response = await PATCH(
      new Request("http://localhost/api/settings/model-variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "variant:openai-medium",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("PATCH returns 403 for built-in variant", async () => {
    const { PATCH } = route;
    const response = await PATCH(
      new Request("http://localhost/api/settings/model-variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "variant:builtin:gpt-5.4-xhigh",
          name: "Modified",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("PATCH returns 404 when variant does not exist", async () => {
    const { PATCH } = route;
    const response = await PATCH(
      new Request("http://localhost/api/settings/model-variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "variant:missing",
          name: "Updated",
        }),
      }),
    );

    expect(response.status).toBe(404);
  });

  test("PATCH updates a model variant and returns full list", async () => {
    state.preferences.modelVariants = [
      {
        id: "variant:openai-medium",
        name: "OpenAI Medium",
        baseModelId: "openai/gpt-5",
        providerOptions: { reasoningEffort: "medium" },
      },
    ];

    const { PATCH } = route;
    const response = await PATCH(
      new Request("http://localhost/api/settings/model-variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "variant:openai-medium",
          providerOptions: { reasoningEffort: "high" },
        }),
      }),
    );

    expect(response.ok).toBe(true);

    const body = (await response.json()) as { modelVariants: ModelVariant[] };
    expect(body.modelVariants[2]?.providerOptions).toEqual({
      reasoningEffort: "high",
    });
  });

  test("PATCH rejects provider options larger than 16KB", async () => {
    state.preferences.modelVariants = [
      {
        id: "variant:openai-medium",
        name: "OpenAI Medium",
        baseModelId: "openai/gpt-5",
        providerOptions: { reasoningEffort: "medium" },
      },
    ];

    const { PATCH } = route;
    const response = await PATCH(
      new Request("http://localhost/api/settings/model-variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "variant:openai-medium",
          providerOptions: {
            payload: "x".repeat(17_000),
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("DELETE returns 403 for built-in variant", async () => {
    const { DELETE } = route;

    const response = await DELETE(
      new Request("http://localhost/api/settings/model-variants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "variant:builtin:gpt-5.4-xhigh" }),
      }),
    );

    expect(response.status).toBe(403);
  });

  test("DELETE returns 404 when variant does not exist", async () => {
    const { DELETE } = route;

    const response = await DELETE(
      new Request("http://localhost/api/settings/model-variants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "variant:missing" }),
      }),
    );

    expect(response.status).toBe(404);
  });

  test("DELETE removes a model variant and returns full list", async () => {
    state.preferences.modelVariants = [
      {
        id: "variant:remove-me",
        name: "To remove",
        baseModelId: "anthropic/claude-haiku-4.5",
        providerOptions: {},
      },
    ];

    const { DELETE } = route;
    const response = await DELETE(
      new Request("http://localhost/api/settings/model-variants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "variant:remove-me" }),
      }),
    );

    expect(response.ok).toBe(true);

    const body = (await response.json()) as { modelVariants: ModelVariant[] };
    expect(body.modelVariants).toHaveLength(2);
  });
});
