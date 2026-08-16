import { beforeEach, describe, expect, test, vi } from "vitest";

const state = vi.hoisted(() => {
  const s = {
    currentSession: { user: { id: "user-1" } } as {
      authProvider?: "vercel" | "github";
      user: { id: string; email?: string };
    } | null,
    preferencesState: {
      defaultModelId: "anthropic/claude-haiku-4.5",
      defaultSubagentModelId: null as string | null,
      defaultSandboxType: "vercel" as const,
      defaultDiffMode: "unified" as const,
      autoCommitPush: false,
      autoCreatePr: false,
      alertsEnabled: true,
      alertSoundEnabled: true,
      publicUsageEnabled: false,
      globalSkillRefs: [] as Array<{ source: string; skillName: string }>,
      modelVariants: [] as Array<Record<string, unknown>>,
      enabledModelIds: [] as string[],
    },
    updateCalls: [] as Array<Record<string, unknown>>,
  };
  return s;
});

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentSession,
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async (_userId: string) => state.preferencesState,
  updateUserPreferences: async (
    _userId: string,
    updates: Record<string, unknown>,
  ) => {
    state.updateCalls.push(updates);
    return {
      ...state.preferencesState,
      ...updates,
    };
  },
}));

import * as route from "./route";

function createJsonRequest(method: "PATCH" | "GET", body?: unknown): Request {
  return new Request("http://localhost/api/settings/preferences", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("/api/settings/preferences", () => {
  beforeEach(() => {
    state.currentSession = { user: { id: "user-1" } };
    state.preferencesState.defaultModelId = "anthropic/claude-haiku-4.5";
    state.preferencesState.defaultSubagentModelId = null;
    state.preferencesState.modelVariants = [];
    state.preferencesState.enabledModelIds = [];
    state.updateCalls.length = 0;
  });

  test("GET returns 401 when unauthenticated", async () => {
    state.currentSession = null;
    const { GET } = route;

    const response = await GET(createJsonRequest("GET"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  test("GET returns preferences including autoCommitPush and autoCreatePr", async () => {
    const { GET } = route;

    const response = await GET(createJsonRequest("GET"));
    const body = (await response.json()) as {
      preferences: typeof state.preferencesState;
    };

    expect(response.status).toBe(200);
    expect(body.preferences.autoCommitPush).toBe(false);
    expect(body.preferences.autoCreatePr).toBe(false);
    expect(body.preferences.defaultSandboxType).toBe("vercel");
    expect(body.preferences.globalSkillRefs).toEqual([]);
  });

  test("GET hides Opus defaults for managed trial users", async () => {
    const { GET } = route;

    state.currentSession = {
      authProvider: "vercel",
      user: { id: "user-1", email: "person@example.com" },
    };
    state.preferencesState.defaultModelId = "anthropic/claude-opus-4.6";
    state.preferencesState.defaultSubagentModelId =
      "variant:builtin:claude-opus-4.6-high";
    state.preferencesState.modelVariants = [
      {
        id: "variant:user-opus",
        name: "User Opus",
        baseModelId: "anthropic/claude-opus-4.6",
        providerOptions: {},
      },
    ];

    const response = await GET(
      new Request("https://viben-web.vercel.app/api/settings/preferences"),
    );
    const body = (await response.json()) as {
      preferences: typeof state.preferencesState;
    };

    expect(body.preferences.defaultModelId).toBe("openai/gpt-5.4");
    expect(body.preferences.defaultSubagentModelId).toBe("openai/gpt-5.4");
    expect(body.preferences.modelVariants).toEqual([]);
  });

  test("PATCH rejects invalid sandbox types", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { defaultSandboxType: "invalid" }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid sandbox type");
    expect(state.updateCalls).toHaveLength(0);
  });

  test("PATCH rejects invalid autoCommitPush values", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { autoCommitPush: "yes" }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid autoCommitPush value");
    expect(state.updateCalls).toHaveLength(0);
  });

  test("PATCH updates autoCommitPush when boolean is provided", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { autoCommitPush: true }),
    );
    const body = (await response.json()) as {
      preferences: typeof state.preferencesState;
    };

    expect(response.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({ autoCommitPush: true });
    expect(body.preferences.autoCommitPush).toBe(true);
  });

  test("PATCH rejects invalid autoCreatePr values", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { autoCreatePr: "yes" }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid autoCreatePr value");
    expect(state.updateCalls).toHaveLength(0);
  });

  test("PATCH updates autoCreatePr when boolean is provided", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { autoCreatePr: true }),
    );
    const body = (await response.json()) as {
      preferences: typeof state.preferencesState;
    };

    expect(response.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({ autoCreatePr: true });
    expect(body.preferences.autoCreatePr).toBe(true);
  });

  test("PATCH rejects invalid publicUsageEnabled values", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { publicUsageEnabled: "yes" }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid publicUsageEnabled value");
    expect(state.updateCalls).toHaveLength(0);
  });

  test("PATCH updates publicUsageEnabled when boolean is provided", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", { publicUsageEnabled: true }),
    );
    const body = (await response.json()) as {
      preferences: typeof state.preferencesState;
    };

    expect(response.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({ publicUsageEnabled: true });
    expect(body.preferences.publicUsageEnabled).toBe(true);
  });

  test("PATCH rejects invalid globalSkillRefs values", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", {
        globalSkillRefs: [{ source: "vercel/ai", skillName: "bad name" }],
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid globalSkillRefs value");
    expect(state.updateCalls).toHaveLength(0);
  });

  test("PATCH updates globalSkillRefs when valid refs are provided", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      createJsonRequest("PATCH", {
        globalSkillRefs: [
          { source: "vercel/ai", skillName: "ai-sdk" },
          { source: "vercel/ai", skillName: "ai-sdk" },
        ],
      }),
    );
    const body = (await response.json()) as {
      preferences: typeof state.preferencesState;
    };

    expect(response.status).toBe(200);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0]).toEqual({
      globalSkillRefs: [{ source: "vercel/ai", skillName: "ai-sdk" }],
    });
    expect(body.preferences.globalSkillRefs).toEqual([
      { source: "vercel/ai", skillName: "ai-sdk" },
    ]);
  });

  test("PATCH returns 400 for invalid JSON", async () => {
    const { PATCH } = route;

    const response = await PATCH(
      new Request("http://localhost/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });
});
