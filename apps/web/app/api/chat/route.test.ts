import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface TestSessionRecord {
  id: string;
  userId: string;
  title: string;
  cloneUrl: string;
  repoOwner: string;
  repoName: string;
  status: "running" | "archived";
  prNumber?: number | null;
  autoCommitPushOverride?: boolean | null;
  autoCreatePrOverride?: boolean | null;
  sandboxState: {
    type: "vercel";
  };
}

interface TestChatRecord {
  sessionId: string;
  modelId: string | null;
  activeStreamId: string | null;
}

const state = vi.hoisted(() => {
  const s = {
    sessionRecord: null as TestSessionRecord | null,
    chatRecord: null as TestChatRecord | null,
    currentAuthSession: null as {
      authProvider?: "vercel" | "github";
      user: {
        id: string;
        email?: string;
      };
    } | null,
    existingUserMessageCount: 0,
    existingChatMessage: null as { id: string } | null,
    existingScopedChatMessage: null as { id: string } | null,
    isSandboxActive: true,
    existingRunStatus: "completed" as string,
    getRunShouldThrow: false,
    claimActiveStreamDefaultResult: true,
    compareAndSetDefaultResult: true,
    compareAndSetResults: [] as boolean[],
    startCalls: [] as unknown[][],
    routeEvents: [] as string[],
    preferencesState: {
      autoCommitPush: true,
      autoCreatePr: false,
      modelVariants: [] as Array<{
        id: string;
        name: string;
        baseModelId: string;
        providerOptions: Record<string, unknown>;
      }>,
    },
    cachedSkillsState: null as unknown,
    discoverSkillDirsCalls: [] as string[][],
  };

  return Object.assign(s, {
    claimChatActiveStreamIdSpy: vi.fn(
      async () => s.claimActiveStreamDefaultResult,
    ),
    compareAndSetChatActiveStreamIdSpy: vi.fn(async () => {
      const nextResult = s.compareAndSetResults.shift();
      return nextResult ?? s.compareAndSetDefaultResult;
    }),
    createChatMessageIfNotExistsSpy: vi.fn(async ({ id }: { id: string }) => {
      s.routeEvents.push("persist-user");
      return { id };
    }),
    touchChatSpy: vi.fn(async () => {
      s.routeEvents.push("touch-chat");
    }),
    isFirstChatMessageSpy: vi.fn(async () => true),
    updateChatSpy: vi.fn(async () => {
      s.routeEvents.push("update-chat");
    }),
  });
});

const originalFetch = globalThis.fetch;

globalThis.fetch = (async (_input: RequestInfo | URL) => {
  return new Response("{}", {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}) as typeof fetch;

vi.mock("next/server", () => ({
  after: (task: Promise<unknown>) => {
    void Promise.resolve(task);
  },
}));

vi.mock("ai", () => ({
  createUIMessageStreamResponse: ({
    stream,
    headers,
  }: {
    stream: ReadableStream;
    headers?: Record<string, string>;
  }) => new Response(stream, { status: 200, headers }),
  generateId: () => "gen-id-1",
  isToolUIPart: (part: { type: string }) =>
    part.type === "tool-invocation" || part.type.startsWith("tool-"),
}));

vi.mock("workflow/api", () => ({
  start: async (...args: unknown[]) => {
    state.routeEvents.push("start-workflow");
    state.startCalls.push(args);
    return {
      runId: "wrun_test-123",
      getReadable: () =>
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
    };
  },
  getRun: () => {
    if (state.getRunShouldThrow) {
      throw new Error("Run not found");
    }

    return {
      status: Promise.resolve(state.existingRunStatus),
      getReadable: () =>
        new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
      cancel: () => Promise.resolve(),
    };
  },
}));

vi.mock("@/app/workflows/chat", () => ({
  runAgentWorkflow: async () => {},
}));

vi.mock("@/lib/chat/create-cancelable-readable-stream", () => ({
  createCancelableReadableStream: (stream: ReadableStream) => stream,
}));

vi.mock("@viben/agent", () => ({
  discoverSkills: async (_sandbox: unknown, skillDirs: string[]) => {
    state.discoverSkillDirsCalls.push(skillDirs);
    return [];
  },
  gateway: () => "mock-model",
}));

vi.mock("@viben/sandbox", () => ({
  connectSandbox: async () => ({
    workingDirectory: "/vercel/sandbox",
    exec: async () => ({ success: true, stdout: "", stderr: "" }),
    getState: () => ({
      type: "vercel",
      sandboxId: "sandbox-1",
      expiresAt: Date.now() + 60_000,
    }),
  }),
}));

vi.mock("@/lib/db/sessions", () => ({
  claimChatActiveStreamId: state.claimChatActiveStreamIdSpy,
  compareAndSetChatActiveStreamId: state.compareAndSetChatActiveStreamIdSpy,
  countUserMessagesByUserId: async () => state.existingUserMessageCount,
  createChatMessageIfNotExists: state.createChatMessageIfNotExistsSpy,
  getChatById: async () => state.chatRecord,
  getChatMessageById: async () => state.existingChatMessage,
  getChatMessageByIdForChat: async () => state.existingScopedChatMessage,
  getSessionById: async () => state.sessionRecord,
  isFirstChatMessage: state.isFirstChatMessageSpy,
  touchChat: state.touchChatSpy,
  updateChat: state.updateChatSpy,
  updateChatActiveStreamId: async () => {},
  updateChatAssistantActivity: async () => {},
  updateSession: async (_sessionId: string, patch: Record<string, unknown>) =>
    patch,
  upsertChatMessageScoped: async () => ({ status: "inserted" as const }),
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => state.preferencesState,
}));

vi.mock("@/lib/skills-cache", () => ({
  getCachedSkills: async () => state.cachedSkillsState,
  setCachedSkills: async () => {},
}));

vi.mock("@/lib/github/token", () => ({
  getGithubOAuthToken: async () => null,
}));

vi.mock("@/lib/sandbox/config", () => ({
  DEFAULT_SANDBOX_PORTS: [],
}));

vi.mock("@/lib/sandbox/lifecycle", () => ({
  buildActiveLifecycleUpdate: () => ({}),
}));

vi.mock("@/lib/sandbox/utils", () => ({
  isSandboxActive: () => state.isSandboxActive,
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentAuthSession,
}));

import * as route from "./route";

afterAll(() => {
  globalThis.fetch = originalFetch;
});

function createRequest(body: string, url = "http://localhost/api/chat") {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "session=abc",
    },
    body,
  });
}

function createValidRequest() {
  return createRequest(
    JSON.stringify({
      sessionId: "session-1",
      chatId: "chat-1",
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Fix the bug" }],
        },
      ],
    }),
  );
}

describe("/api/chat route", () => {
  beforeEach(() => {
    state.isSandboxActive = true;
    state.existingRunStatus = "completed";
    state.getRunShouldThrow = false;
    state.claimActiveStreamDefaultResult = true;
    state.compareAndSetDefaultResult = true;
    state.compareAndSetResults = [];
    state.startCalls = [];
    state.routeEvents = [];
    state.cachedSkillsState = null;
    state.discoverSkillDirsCalls = [];
    state.existingUserMessageCount = 0;
    state.existingChatMessage = null;
    state.existingScopedChatMessage = null;
    state.preferencesState = {
      autoCommitPush: true,
      autoCreatePr: false,
      modelVariants: [],
    };
    state.claimChatActiveStreamIdSpy.mockClear();
    state.compareAndSetChatActiveStreamIdSpy.mockClear();
    state.createChatMessageIfNotExistsSpy.mockClear();
    state.touchChatSpy.mockClear();
    state.isFirstChatMessageSpy.mockClear();
    state.updateChatSpy.mockClear();
    state.currentAuthSession = {
      user: {
        id: "user-1",
      },
    };

    state.sessionRecord = {
      id: "session-1",
      userId: "user-1",
      title: "Session title",
      status: "running",
      cloneUrl: "https://github.com/acme/repo.git",
      repoOwner: "acme",
      repoName: "repo",
      prNumber: null,
      autoCommitPushOverride: null,
      autoCreatePrOverride: null,
      sandboxState: {
        type: "vercel",
      },
    };

    state.chatRecord = {
      sessionId: "session-1",
      modelId: null,
      activeStreamId: null,
    };
  });

  test("starts a workflow and returns a streaming response", async () => {
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
  });

  test("returns 400 for archived sessions without starting a workflow", async () => {
    if (!state.sessionRecord) {
      throw new Error("sessionRecord must be set");
    }
    state.sessionRecord.status = "archived";
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Session is archived",
    });
    expect(state.startCalls).toHaveLength(0);
    expect(state.createChatMessageIfNotExistsSpy).not.toHaveBeenCalled();
  });

  test("persists the latest user message before starting the workflow", async () => {
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.createChatMessageIfNotExistsSpy).toHaveBeenCalledWith({
      id: "user-1",
      chatId: "chat-1",
      role: "user",
      parts: expect.objectContaining({ id: "user-1", role: "user" }),
    });
    expect(state.routeEvents.indexOf("persist-user")).toBeGreaterThanOrEqual(0);
    expect(state.routeEvents.indexOf("start-workflow")).toBeGreaterThan(
      state.routeEvents.indexOf("persist-user"),
    );
  });

  test("blocks a sixth message for managed template trial users", async () => {
    const { POST } = route;
    state.currentAuthSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        email: "person@example.com",
      },
    };
    state.existingUserMessageCount = 5;

    const response = await POST(
      createRequest(
        JSON.stringify({
          sessionId: "session-1",
          chatId: "chat-1",
          messages: [
            {
              id: "user-6",
              role: "user",
              parts: [{ type: "text", text: "One more thing" }],
            },
          ],
        }),
        "https://viben-web.vercel.app/api/chat",
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe(
      "This hosted demo has a 5 message limit. Deploy your own copy to unlock the full Viben Assistant template.",
    );
    expect(state.startCalls).toHaveLength(0);
  });

  test("does not let trial users replay a message id from another chat", async () => {
    const { POST } = route;
    state.currentAuthSession = {
      authProvider: "vercel",
      user: {
        id: "user-1",
        email: "person@example.com",
      },
    };
    state.existingUserMessageCount = 5;
    state.existingChatMessage = { id: "user-1" };
    state.existingScopedChatMessage = null;

    const response = await POST(
      createRequest(
        JSON.stringify({
          sessionId: "session-1",
          chatId: "chat-1",
          messages: [
            {
              id: "user-1",
              role: "user",
              parts: [{ type: "text", text: "Replay this" }],
            },
          ],
        }),
        "https://viben-web.vercel.app/api/chat",
      ),
    );

    expect(response.status).toBe(403);
    expect(state.startCalls).toHaveLength(0);
  });

  test("passes the 500 maxSteps limit to the workflow", async () => {
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.startCalls).toHaveLength(1);
    expect(state.startCalls[0]?.[1]).toEqual([
      expect.objectContaining({
        assistantId: "gen-id-1",
        maxSteps: 500,
        requestUrl: "http://localhost/api/chat",
        authSession: state.currentAuthSession,
      }),
    ]);
  });

  test("defers selected model resolution to the workflow", async () => {
    const { POST } = route;
    if (!state.chatRecord) {
      throw new Error("chatRecord must be set");
    }

    state.chatRecord.modelId = "variant:test-model";
    state.preferencesState.modelVariants = [
      {
        id: "variant:test-model",
        name: "Test model",
        baseModelId: "openai/gpt-5",
        providerOptions: {},
      },
    ];

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.startCalls).toHaveLength(1);
    expect(state.startCalls[0]?.[1]).toEqual([
      expect.not.objectContaining({
        selectedModelId: expect.anything(),
        modelId: expect.anything(),
      }),
    ]);
  });

  test("does not connect to the sandbox before starting the workflow", async () => {
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.discoverSkillDirsCalls).toEqual([]);
    expect(state.startCalls[0]?.[1]).toEqual([
      expect.not.objectContaining({
        agentOptions: expect.anything(),
      }),
    ]);
  });

  test("passes autoCreatePrEnabled when auto commit and auto PR are enabled", async () => {
    const { POST } = route;
    state.preferencesState.autoCreatePr = true;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.startCalls).toHaveLength(1);
    expect(state.startCalls[0]?.[1]).toEqual([
      expect.not.objectContaining({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
      }),
    ]);
  });

  test("keeps auto PR enabled when the session already has PR metadata", async () => {
    const { POST } = route;
    state.preferencesState.autoCreatePr = true;
    if (!state.sessionRecord) {
      throw new Error("sessionRecord must be set");
    }
    state.sessionRecord.prNumber = 42;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.startCalls).toHaveLength(1);
    expect(state.startCalls[0]?.[1]).toEqual([
      expect.not.objectContaining({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
      }),
    ]);
  });

  test("does not enable auto PR when auto commit is disabled", async () => {
    const { POST } = route;
    state.preferencesState.autoCommitPush = false;
    state.preferencesState.autoCreatePr = true;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.startCalls).toHaveLength(1);
    expect(state.startCalls[0]?.[1]).toEqual([
      expect.not.objectContaining({
        autoCommitEnabled: true,
      }),
    ]);
  });

  test("returns 401 when not authenticated", async () => {
    state.currentAuthSession = null;
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Not authenticated",
    });
  });

  test("returns 400 for invalid JSON body", async () => {
    const { POST } = route;

    const response = await POST(createRequest("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  test("returns 400 when sessionId and chatId are missing", async () => {
    const { POST } = route;

    const response = await POST(
      createRequest(
        JSON.stringify({
          messages: [
            {
              id: "user-1",
              role: "user",
              parts: [{ type: "text", text: "Fix the bug" }],
            },
          ],
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "sessionId and chatId are required",
    });
  });

  test("returns 404 when session does not exist", async () => {
    state.sessionRecord = null;
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Session not found",
    });
  });

  test("returns 403 when session is not owned by user", async () => {
    if (!state.sessionRecord) {
      throw new Error("sessionRecord must be set");
    }
    state.sessionRecord.userId = "user-2";

    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  test("starts a workflow when sandbox is not active", async () => {
    state.isSandboxActive = false;
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.startCalls).toHaveLength(1);
  });

  test("reconnects to existing running workflow instead of starting new one", async () => {
    if (!state.chatRecord) throw new Error("chatRecord must be set");
    state.chatRecord.activeStreamId = "wrun_existing-456";
    state.existingRunStatus = "running";

    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(response.headers.get("x-workflow-run-id")).toBe("wrun_existing-456");
    expect(state.startCalls).toHaveLength(0);
    expect(state.createChatMessageIfNotExistsSpy).not.toHaveBeenCalled();
    expect(state.compareAndSetChatActiveStreamIdSpy).not.toHaveBeenCalled();
  });

  test("starts new workflow when existing run is completed and clears the stale stream id first", async () => {
    if (!state.chatRecord) throw new Error("chatRecord must be set");
    state.chatRecord.activeStreamId = "wrun_old-789";
    state.existingRunStatus = "completed";

    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(response.headers.get("x-workflow-run-id")).toBe("wrun_test-123");

    const compareAndSetCalls = state.compareAndSetChatActiveStreamIdSpy.mock
      .calls as unknown[][];
    expect(compareAndSetCalls).toEqual([["chat-1", "wrun_old-789", null]]);
    expect(state.claimChatActiveStreamIdSpy).toHaveBeenCalledWith(
      "chat-1",
      "wrun_test-123",
    );
  });

  test("starts new workflow when the existing run cannot be loaded and clears the stale stream id first", async () => {
    if (!state.chatRecord) throw new Error("chatRecord must be set");
    state.chatRecord.activeStreamId = "wrun_missing-789";
    state.getRunShouldThrow = true;

    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(response.headers.get("x-workflow-run-id")).toBe("wrun_test-123");

    const compareAndSetCalls = state.compareAndSetChatActiveStreamIdSpy.mock
      .calls as unknown[][];
    expect(compareAndSetCalls).toEqual([["chat-1", "wrun_missing-789", null]]);
    expect(state.claimChatActiveStreamIdSpy).toHaveBeenCalledWith(
      "chat-1",
      "wrun_test-123",
    );
  });

  test("succeeds when the started workflow already claimed the stream slot", async () => {
    state.compareAndSetDefaultResult = false;
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(state.claimChatActiveStreamIdSpy).toHaveBeenCalledWith(
      "chat-1",
      "wrun_test-123",
    );
  });

  test("returns 409 when a different workflow owns the stream slot", async () => {
    state.claimActiveStreamDefaultResult = false;
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Another workflow is already running for this chat",
    });
  });

  test("includes x-workflow-run-id header on success", async () => {
    const { POST } = route;

    const response = await POST(createValidRequest());

    expect(response.ok).toBe(true);
    expect(response.headers.get("x-workflow-run-id")).toBe("wrun_test-123");
  });
});
