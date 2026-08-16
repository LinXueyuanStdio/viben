import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UIMessageChunk } from "ai";

type TestSessionRecord = {
  id: string;
  userId: string;
  agentType: "work" | "chat";
  autoCommitPushOverride: boolean | null;
  autoCreatePrOverride: boolean | null;
  repoOwner: string | null;
  repoName: string | null;
};

type TestChatRecord = {
  id: string;
  sessionId: string;
  modelId: string | null;
};

type TestPreferences = {
  defaultModelId: string;
  defaultSubagentModelId: string | null;
  defaultSandboxType: "vercel";
  defaultDiffMode: "unified";
  autoCommitPush: boolean;
  autoCreatePr: boolean;
  alertsEnabled: boolean;
  alertSoundEnabled: boolean;
  publicUsageEnabled: boolean;
  globalSkillRefs: never[];
  modelVariants: never[];
  enabledModelIds: string[];
};

type TestResolvedChatSandboxRuntime = {
  sandboxState: {
    type: "vercel";
    sandboxName: string;
    expiresAt: number;
  };
  workingDirectory: string;
  currentBranch: string;
  environmentDetails: string;
  skills: never[];
  didSetupWorkspace: boolean;
  sessionTitle: string;
  repoOwner?: string;
  repoName?: string;
};

// ── Spy state ──────────────────────────────────────────────────────

const state = vi.hoisted(() => {
  const s = {
    writtenChunks: [] as UIMessageChunk[],
    runStatus: "running",
    throwOnAgentStream: false,
    agentStreamParts: [] as Array<Record<string, unknown>>,
    agentAssistantParts: undefined as Array<Record<string, unknown>> | undefined,
    agentFinishReason: "stop",
    agentRawFinishReason: "provider_stop" as string | undefined,
    agentTotalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    agentResponseMessages: [] as unknown[],
    agentResponse: {} as Record<string, unknown>,
    streamOnFinishCallback: undefined as
      | ((args: { responseMessage: unknown }) => void)
      | undefined,
    agentWarnings: undefined as unknown[] | undefined,
    agentRequestBody: undefined as unknown,
    agentResponseHeaders: undefined as Record<string, string> | undefined,
    agentResponseBody: undefined as unknown,
    agentProviderMetadata: undefined as Record<string, unknown> | undefined,
    agentInputMessages: undefined as unknown,
    testSessionRecord: {} as TestSessionRecord,
    testChatRecord: {} as TestChatRecord,
    testPreferences: {} as TestPreferences,
  };

  s.agentResponse = { messages: s.agentResponseMessages };

  function createResolvedChatSandboxRuntime(
    overrides: Partial<TestResolvedChatSandboxRuntime> = {},
  ): TestResolvedChatSandboxRuntime {
    return {
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-1",
        expiresAt: Date.now() + 60_000,
      },
      workingDirectory: "/vercel/sandbox",
      currentBranch: "main",
      environmentDetails: "test sandbox",
      skills: [],
      didSetupWorkspace: false,
      sessionTitle: "Session title",
      repoOwner: "acme",
      repoName: "repo",
      ...overrides,
    };
  }

  function buildAgentSteps() {
    return [
      {
        stepNumber: 0,
        model: {
          provider: "openai",
          modelId:
            typeof s.agentResponse.modelId === "string"
              ? s.agentResponse.modelId
              : "test-model",
        },
        finishReason: s.agentFinishReason,
        rawFinishReason: s.agentRawFinishReason,
        usage: s.agentTotalUsage,
        warnings: s.agentWarnings,
        content: [{ type: "text" }],
        toolCalls: [],
        toolResults: [],
        request: { body: s.agentRequestBody },
        response: {
          id:
            typeof s.agentResponse.id === "string"
              ? s.agentResponse.id
              : "response-1",
          modelId:
            typeof s.agentResponse.modelId === "string"
              ? s.agentResponse.modelId
              : "test-model",
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
          headers: s.agentResponseHeaders,
          body: s.agentResponseBody,
          messages: s.agentResponseMessages,
        },
        providerMetadata: s.agentProviderMetadata,
      },
    ];
  }

  const testWorkAgent = {
    tools: {},
    stream: async ({ messages }: { messages: unknown }) => {
      if (s.throwOnAgentStream) {
        throw new Error("Agent failed");
      }
      s.agentInputMessages = messages;
      return {
        toUIMessageStream: (opts: {
          sendStart?: boolean;
          sendFinish?: boolean;
          originalMessages?: Array<Record<string, unknown>>;
          messageMetadata?: (args: {
            part: Record<string, unknown>;
          }) => unknown;
          onFinish?: (args: { responseMessage: unknown }) => void;
        }) => {
          const priorAssistantMessage = opts.originalMessages?.at(-1);
          const assistantMessage = (
            priorAssistantMessage?.role === "assistant"
              ? structuredClone(priorAssistantMessage)
              : {
                  id: "assistant-1",
                  role: "assistant",
                  parts: s.agentAssistantParts ?? [{ type: "text", text: "Hello!" }],
                  metadata: {},
                }
          ) as {
            id: string;
            role: "assistant";
            parts: Array<Record<string, unknown>>;
            metadata?: unknown;
          };

          s.streamOnFinishCallback = opts.onFinish;
          // Return an async iterable that yields parts and calls onFinish
          return {
            async *[Symbol.asyncIterator]() {
              for (const part of s.agentStreamParts) {
                yield part;

                const metadata = opts.messageMetadata?.({ part });
                if (metadata) {
                  assistantMessage.metadata = Object.assign(
                    {},
                    assistantMessage.metadata as
                      | Record<string, unknown>
                      | undefined,
                    metadata as Record<string, unknown>,
                  );
                  yield {
                    type: "message-metadata",
                    messageMetadata: metadata,
                  };
                }
              }
              if (s.streamOnFinishCallback) {
                s.streamOnFinishCallback({
                  responseMessage: assistantMessage,
                });
              }
            },
          };
        },
        totalUsage: Promise.resolve(s.agentTotalUsage),
        finishReason: Promise.resolve(s.agentFinishReason),
        rawFinishReason: Promise.resolve(s.agentRawFinishReason),
        response: Promise.resolve(s.agentResponse),
        steps: Promise.resolve(buildAgentSteps()),
      };
    },
  };

  const spies = {
    persistUserMessage: vi.fn(() => Promise.resolve()),
    persistAssistantMessageWithToolResults: vi.fn(() => Promise.resolve()),
    persistAssistantMessage: vi.fn((_chatId?: unknown, _message?: unknown) =>
      Promise.resolve(),
    ),
    persistSandboxState: vi.fn(
      (_sessionId?: unknown, _sandboxState?: unknown) => Promise.resolve(),
    ),
    resolveChatSandboxRuntime: vi.fn((_params: { assistantId?: string }) => {
      return Promise.resolve(createResolvedChatSandboxRuntime());
    }),
    claimActiveStream: vi.fn(
      async (
        _chatId?: unknown,
        _workflowRunId?: unknown,
        writable?: WritableStream<UIMessageChunk>,
        messageId?: string,
      ) => {
        if (writable && messageId) {
          const writer = writable.getWriter();
          try {
            await writer.write({ type: "start", messageId });
          } finally {
            writer.releaseLock();
          }
        }
        return "claimed";
      },
    ),
    closeStream: vi.fn((writable: WritableStream<UIMessageChunk>) =>
      writable.close(),
    ),
    clearActiveStream: vi.fn(
      (_chatId?: unknown, _workflowRunId?: unknown) => Promise.resolve(),
    ),
    sendFinish: vi.fn(async (writable: WritableStream<UIMessageChunk>) => {
      const writer = writable.getWriter();
      try {
        await writer.write({ type: "finish", finishReason: "stop" });
      } finally {
        writer.releaseLock();
      }
    }),
    recordWorkflowUsage: vi.fn(() => Promise.resolve()),
    refreshDiffCache: vi.fn(
      (_sessionId?: unknown, _sandboxState?: unknown) => Promise.resolve(),
    ),
    refreshLifecycleActivity: vi.fn(() => Promise.resolve()),
    hasAutoCommitChangesStep: vi.fn(() => Promise.resolve(true)),
    runAutoCommitStep: vi.fn(() =>
      Promise.resolve({ committed: false, pushed: false }),
    ),
    runAutoCreatePrStep: vi.fn(() =>
      Promise.resolve({
        created: true,
        syncedExisting: false,
        skipped: false,
        prNumber: 42,
        prUrl: "https://github.com/acme/repo/pull/42",
      }),
    ),
    runPageAgentStep: vi.fn(() =>
      Promise.resolve({
        responseMessage: {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Page answer" }],
          metadata: {},
        },
        responseMessages: [],
        finishReason: "stop",
        rawFinishReason: "provider_stop",
        stepUsage: s.agentTotalUsage,
        stepCost: undefined,
        stepWasAborted: false,
        stepTiming: {
          stepNumber: 1,
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:00:01.000Z",
          durationMs: 1000,
          finishReason: "stop",
          rawFinishReason: "provider_stop",
        },
      }),
    ),
  };

  return Object.assign(s, {
    createResolvedChatSandboxRuntime,
    buildAgentSteps,
    testWorkAgent,
    spies,
  });
});

// ── Module mocks ───────────────────────────────────────────────────

vi.mock("workflow", () => ({
  getWorkflowMetadata: () => ({ workflowRunId: "wrun_test-123" }),
  getWritable: () => {
    const writable = new WritableStream<UIMessageChunk>({
      write(chunk) {
        state.writtenChunks.push(chunk);
      },
    });
    return writable;
  },
}));

vi.mock("workflow/api", () => ({
  getRun: () => ({
    get status() {
      return Promise.resolve(state.runStatus);
    },
  }),
}));

vi.mock("./chat-post-finish", () => state.spies);

vi.mock("@/app/config", () => ({
  workAgent: state.testWorkAgent,
  webAgent: state.testWorkAgent,
  pageAgent: {
    tools: {},
  },
}));

vi.mock("ai", () => ({
  convertToModelMessages: async (
    msgs: Array<Record<string, unknown>>,
    options?: { convertDataPart?: (part: Record<string, unknown>) => unknown },
  ) =>
    msgs.map((message) => {
      const parts = Array.isArray(message.parts) ? message.parts : [];
      const content = parts.flatMap((part) => {
        if (typeof part !== "object" || part === null) {
          return [];
        }

        if (part.type === "text" && typeof part.text === "string") {
          return [{ type: "text", text: part.text }];
        }

        if (
          typeof part.type === "string" &&
          part.type.startsWith("data-") &&
          options?.convertDataPart
        ) {
          const convertedPart = options.convertDataPart(
            part as Record<string, unknown>,
          );
          return convertedPart === undefined ? [] : [convertedPart];
        }

        return [];
      });

      return {
        role: message.role,
        content,
      };
    }),
  generateId: () => "gen-id-1",
  isToolUIPart: (part: { type: string }) =>
    part.type === "tool-invocation" || part.type.startsWith("tool-"),
  pruneMessages: ({ messages }: { messages: Array<Record<string, unknown>> }) =>
    messages.filter((message) => {
      const content = message.content;
      return !Array.isArray(content) || content.length > 0;
    }),
}));

vi.mock("@viben/agent", () => ({}));

vi.mock("@/lib/db/sessions", () => ({
  getChatById: async () => state.testChatRecord,
  getSessionById: async () => state.testSessionRecord,
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => state.testPreferences,
}));

vi.mock("./chat-sandbox-runtime", () => ({
  resolveChatSandboxRuntime: state.spies.resolveChatSandboxRuntime,
}));

vi.mock("./chat-page-runtime", () => ({
  runPageAgentStep: state.spies.runPageAgentStep,
}));

import { runAgentWorkflow } from "./chat";

// ── Helpers ────────────────────────────────────────────────────────

function makeOptions(overrides?: Record<string, unknown>) {
  return {
    messages: [
      {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text", text: "Hello" }],
      },
    ],
    chatId: "chat-1",
    sessionId: "session-1",
    userId: "user-1",
    requestUrl: "http://localhost/api/chat",
    authSession: {
      authProvider: "vercel" as const,
      user: {
        id: "user-1",
        username: "user",
        email: "user@example.com",
        avatar: "",
      },
    },
    selectedModelId: "gpt-4",
    modelId: "gpt-4",
    agentOptions: {},
    maxSteps: 1,
    ...overrides,
  } as Parameters<typeof runAgentWorkflow>[0];
}

// ── Tests ──────────────────────────────────────────────────────────

beforeEach(() => {
  state.writtenChunks.length = 0;
  state.runStatus = "running";
  state.throwOnAgentStream = false;
  state.agentStreamParts = [{ type: "text-delta", textDelta: "Hi" }];
  state.agentAssistantParts = undefined;
  state.agentFinishReason = "stop";
  state.agentRawFinishReason = "provider_stop";
  state.agentTotalUsage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
  state.agentResponseMessages = [];
  state.agentResponse = { messages: state.agentResponseMessages };
  state.agentWarnings = undefined;
  state.agentRequestBody = undefined;
  state.agentResponseHeaders = undefined;
  state.agentResponseBody = undefined;
  state.agentProviderMetadata = undefined;
  state.agentInputMessages = undefined;
  state.streamOnFinishCallback = undefined;
  state.testSessionRecord = {
    id: "session-1",
    userId: "user-1",
    agentType: "work",
    autoCommitPushOverride: null,
    autoCreatePrOverride: null,
    repoOwner: "acme",
    repoName: "repo",
  };
  state.testChatRecord = {
    id: "chat-1",
    sessionId: "session-1",
    modelId: null,
  };
  state.testPreferences = {
    defaultModelId: "anthropic/claude-haiku-4.5",
    defaultSubagentModelId: null,
    defaultSandboxType: "vercel",
    defaultDiffMode: "unified",
    autoCommitPush: false,
    autoCreatePr: false,
    alertsEnabled: true,
    alertSoundEnabled: true,
    publicUsageEnabled: false,
    globalSkillRefs: [],
    modelVariants: [],
    enabledModelIds: [],
  };
  Object.values(state.spies).forEach((s) => s.mockClear());
});

describe("runAgentWorkflow", () => {
  test("throws when no messages provided", async () => {
    try {
      await runAgentWorkflow(makeOptions({ messages: [] }));
      expect(true).toBe(false);
    } catch (error) {
      expect((error as Error).message).toContain("at least one message");
    }
  });

  test("exits before side effects when another workflow owns the stream slot", async () => {
    state.spies.claimActiveStream.mockImplementationOnce(() =>
      Promise.resolve("conflict"),
    );

    await runAgentWorkflow(makeOptions());

    expect(state.writtenChunks).toEqual([]);
    expect(state.agentInputMessages).toBeUndefined();
    expect(state.spies.persistAssistantMessage).not.toHaveBeenCalled();
    expect(state.spies.clearActiveStream).not.toHaveBeenCalled();
    expect(state.spies.recordWorkflowUsage).not.toHaveBeenCalled();
  });

  test("continues when claiming the stream errors", async () => {
    state.spies.claimActiveStream.mockImplementationOnce(
      async (
        _chatId?: unknown,
        _workflowRunId?: unknown,
        writable?: WritableStream<UIMessageChunk>,
        messageId?: string,
      ) => {
        if (writable && messageId) {
          const writer = writable.getWriter();
          try {
            await writer.write({ type: "start", messageId });
          } finally {
            writer.releaseLock();
          }
        }
        return "error";
      },
    );

    await runAgentWorkflow(makeOptions());

    const types = state.writtenChunks.map((chunk) => chunk.type);
    expect(types[0]).toBe("start");
    expect(types[types.length - 1]).toBe("finish");
    expect(state.spies.persistAssistantMessage).toHaveBeenCalledTimes(1);
  });

  test("work sessions keep sandbox runtime and work post-finish steps", async () => {
    state.testSessionRecord.agentType = "work";

    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
      }),
    );

    expect(state.spies.resolveChatSandboxRuntime).toHaveBeenCalledTimes(1);
    expect(state.spies.runPageAgentStep).not.toHaveBeenCalled();
    expect(state.spies.refreshLifecycleActivity).toHaveBeenCalledTimes(1);
    expect(state.spies.persistSandboxState).toHaveBeenCalledTimes(1);
    expect(state.spies.runAutoCommitStep).toHaveBeenCalledTimes(1);
    expect(state.spies.runAutoCreatePrStep).toHaveBeenCalledTimes(1);
  });

  test("chat sessions execute page runtime without sandbox or git steps", async () => {
    state.testSessionRecord.agentType = "chat";

    await runAgentWorkflow(makeOptions());

    expect(state.spies.runPageAgentStep).toHaveBeenCalledTimes(1);
    expect(state.spies.resolveChatSandboxRuntime).not.toHaveBeenCalled();
    expect(state.spies.persistSandboxState).not.toHaveBeenCalled();
    expect(state.spies.refreshDiffCache).not.toHaveBeenCalled();
    expect(state.spies.refreshLifecycleActivity).not.toHaveBeenCalled();
    expect(state.spies.runAutoCommitStep).not.toHaveBeenCalled();
    expect(state.spies.runAutoCreatePrStep).not.toHaveBeenCalled();
    expect(state.spies.persistAssistantMessage).toHaveBeenCalled();
    expect(state.spies.recordWorkflowUsage).toHaveBeenCalled();
    expect(state.spies.clearActiveStream).toHaveBeenCalled();
  });

  test("page runtime failure persists a retryable assistant error and clears stream", async () => {
    state.testSessionRecord.agentType = "chat";
    state.spies.runPageAgentStep.mockImplementationOnce(() =>
      Promise.reject(new Error("Page unavailable")),
    );

    await expect(runAgentWorkflow(makeOptions())).rejects.toThrow(
      "Page unavailable",
    );

    expect(state.spies.resolveChatSandboxRuntime).not.toHaveBeenCalled();
    expect(state.spies.persistAssistantMessage).toHaveBeenCalled();
    expect(state.spies.clearActiveStream).toHaveBeenCalled();
  });

  test("page runtime failure emits page-chat setup message instead of workspace wording", async () => {
    state.testSessionRecord.agentType = "chat";
    state.spies.runPageAgentStep.mockImplementationOnce(() =>
      Promise.reject(new Error("Page unavailable")),
    );

    await expect(runAgentWorkflow(makeOptions())).rejects.toThrow(
      "Page unavailable",
    );

    const deltas = state.writtenChunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.delta);
    expect(deltas).toContain("Page unavailable. Try again in a moment.");
    expect(deltas.join(" ")).not.toContain("Workspace setup failed");
  });

  test("generic page runtime failure emits a page-chat setup message", async () => {
    state.testSessionRecord.agentType = "chat";
    state.spies.runPageAgentStep.mockImplementationOnce(() =>
      Promise.reject(new Error("Server does not support resource subscriptions")),
    );

    await expect(runAgentWorkflow(makeOptions())).rejects.toThrow(
      "Server does not support resource subscriptions",
    );

    const deltas = state.writtenChunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.delta);
    expect(deltas).toContain(
      "Unable to start the page assistant. Try again in a moment.",
    );
    expect(deltas.join(" ")).not.toContain("Workspace setup failed");
  });

  test("sends start and finish chunks to writable", async () => {
    await runAgentWorkflow(makeOptions());

    const types = state.writtenChunks.map((c) => c.type);
    expect(types[0]).toBe("start");
    expect(types[types.length - 1]).toBe("finish");
  });

  test("does not stream transient workspace setup status from runtime prep", async () => {
    state.spies.resolveChatSandboxRuntime.mockImplementationOnce(async () => {
      return state.createResolvedChatSandboxRuntime({
        didSetupWorkspace: true,
      });
    });

    await runAgentWorkflow(makeOptions());

    expect(state.writtenChunks[0]).toEqual({
      type: "start",
      messageId: "gen-id-1",
    });
    expect(
      state.writtenChunks.some((chunk) => chunk.type === "data-workspace-status"),
    ).toBe(false);
  });

  test("streams a user-visible message when workspace setup fails", async () => {
    state.spies.resolveChatSandboxRuntime.mockImplementationOnce(async () => {
      throw new Error("Connect GitHub to access repositories");
    });

    await expect(runAgentWorkflow(makeOptions())).rejects.toThrow(
      "Connect GitHub to access repositories",
    );

    expect(state.writtenChunks).toEqual(
      expect.arrayContaining([
        { type: "start", messageId: "gen-id-1" },
        { type: "text-start", id: "setup-error" },
        {
          type: "text-delta",
          id: "setup-error",
          delta: "Connect GitHub to access this repository, then try again.",
        },
        { type: "text-end", id: "setup-error" },
      ]),
    );
    expect(state.spies.persistAssistantMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({
        id: "gen-id-1",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Connect GitHub to access this repository, then try again.",
          },
        ],
      }),
    );
  });

  test("streams an archived-session setup message when runtime rejects", async () => {
    state.spies.resolveChatSandboxRuntime.mockImplementationOnce(async () => {
      throw new Error("Session is archived");
    });

    await expect(runAgentWorkflow(makeOptions())).rejects.toThrow(
      "Session is archived",
    );

    expect(state.writtenChunks).toEqual(
      expect.arrayContaining([
        {
          type: "text-delta",
          id: "setup-error",
          delta: "This session is archived. Unarchive it to continue.",
        },
      ]),
    );
  });

  test("persists assistant message after run", async () => {
    await runAgentWorkflow(makeOptions());

    expect(state.spies.persistAssistantMessage).toHaveBeenCalledTimes(1);
    const paCalls = state.spies.persistAssistantMessage.mock.calls as unknown[][];
    expect(paCalls[0][0]).toBe("chat-1");
  });

  test("persists incoming messages during workflow startup", async () => {
    await runAgentWorkflow(makeOptions());

    expect(state.spies.persistUserMessage).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({ id: "user-1", role: "user" }),
    );
    expect(state.spies.persistAssistantMessageWithToolResults).toHaveBeenCalledWith(
      "chat-1",
      expect.objectContaining({ id: "user-1", role: "user" }),
    );
  });

  test("records usage after run", async () => {
    await runAgentWorkflow(makeOptions());

    expect(state.spies.recordWorkflowUsage).toHaveBeenCalledTimes(1);
    const rwCalls = state.spies.recordWorkflowUsage.mock.calls as unknown[][];
    expect(rwCalls[0][0]).toBe("user-1");
    expect(rwCalls[0][1]).toBe("gpt-4");
  });

  test("persists model metadata even without a finish-step chunk", async () => {
    await runAgentWorkflow(
      makeOptions({
        selectedModelId: "variant:builtin:gpt-5.4-xhigh",
        modelId: "openai/gpt-5.4",
      }),
    );

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        selectedModelId?: string;
        modelId?: string;
      };
    };

    expect(persistedMessage.metadata).toMatchObject({
      selectedModelId: "variant:builtin:gpt-5.4-xhigh",
      modelId: "openai/gpt-5.4",
    });
  });

  test("streams model metadata in finish-step chunks", async () => {
    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "stop",
        rawFinishReason: "provider_stop",
        usage: state.agentTotalUsage,
      },
    ];

    await runAgentWorkflow(
      makeOptions({
        selectedModelId: "variant:builtin:gpt-5.4-xhigh",
        modelId: "openai/gpt-5.4",
      }),
    );

    const metadataChunks = state.writtenChunks.filter(
      (
        chunk,
      ): chunk is UIMessageChunk & {
        type: "message-metadata";
        messageMetadata: {
          selectedModelId?: string;
          modelId?: string;
        };
      } => chunk.type === "message-metadata",
    );

    expect(metadataChunks.at(-1)?.messageMetadata).toMatchObject({
      selectedModelId: "variant:builtin:gpt-5.4-xhigh",
      modelId: "openai/gpt-5.4",
    });

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        selectedModelId?: string;
        modelId?: string;
      };
    };

    expect(persistedMessage.metadata).toMatchObject({
      selectedModelId: "variant:builtin:gpt-5.4-xhigh",
      modelId: "openai/gpt-5.4",
    });
  });

  test("overwrites model metadata when resuming an assistant message", async () => {
    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "stop",
        rawFinishReason: "provider_stop",
        usage: state.agentTotalUsage,
      },
    ];

    await runAgentWorkflow(
      makeOptions({
        messages: [
          {
            id: "assistant-1",
            role: "assistant" as const,
            parts: [{ type: "text", text: "Need your approval" }],
            metadata: {
              selectedModelId: "variant:builtin:gpt-5.4-xhigh",
              modelId: "openai/gpt-5.4",
            },
          },
        ],
        selectedModelId: "anthropic/claude-opus-4.6",
        modelId: "anthropic/claude-opus-4.6",
      }),
    );

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        selectedModelId?: string;
        modelId?: string;
      };
    };

    expect(persistedMessage.metadata).toMatchObject({
      selectedModelId: "anthropic/claude-opus-4.6",
      modelId: "anthropic/claude-opus-4.6",
    });
  });

  test("marks workflow run as failed when maxSteps is exhausted", async () => {
    state.agentFinishReason = "tool-calls";
    state.agentRawFinishReason = "provider_tool_use";

    await runAgentWorkflow(
      makeOptions({
        maxSteps: 2,
      }),
    );

    const rwCalls = state.spies.recordWorkflowUsage.mock.calls as unknown[][];
    const workflowRun = rwCalls[0][5] as {
      workflowRunId: string;
      status: string;
      totalDurationMs: number;
      stepTimings: Array<{
        stepNumber: number;
        durationMs: number;
        finishReason?: string;
      }>;
    };

    expect(workflowRun.workflowRunId).toBe("wrun_test-123");
    expect(workflowRun.status).toBe("failed");
    expect(workflowRun.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(workflowRun.stepTimings).toHaveLength(2);
    expect(workflowRun.stepTimings).toEqual([
      expect.objectContaining({
        stepNumber: 1,
        durationMs: expect.any(Number),
        finishReason: "tool-calls",
      }),
      expect.objectContaining({
        stepNumber: 2,
        durationMs: expect.any(Number),
        finishReason: "tool-calls",
      }),
    ]);
  });

  test("logs full step diagnostics when the agent finishes with reason other", async () => {
    state.agentFinishReason = "other";
    state.agentRawFinishReason = "provider_other";
    state.agentResponseMessages = [{ role: "assistant" }];
    state.agentResponse = {
      id: "response-1",
      messages: state.agentResponseMessages,
      modelId: "test-model",
    };
    state.agentWarnings = [
      {
        type: "unsupported-setting",
        setting: "text.verbosity",
        details: "Provider ignored the requested verbosity.",
      },
    ];
    state.agentRequestBody = {
      model: "openai/gpt-5",
      store: false,
      max_output_tokens: 512,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Hello" }],
        },
      ],
      tools: [{ type: "function", name: "read" }],
    };
    state.agentResponseHeaders = { "x-request-id": "req-123" };
    state.agentResponseBody = {
      id: "response-body-1",
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [
        {
          id: "msg-1",
          type: "message",
          status: "completed",
          role: "assistant",
          content: [{ type: "output_text", text: "Hi" }],
        },
      ],
      usage: { total_tokens: 15 },
      service_tier: "default",
    };
    state.agentProviderMetadata = {
      openai: { responseId: "response-1", serviceTier: "default" },
    };

    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      await runAgentWorkflow(makeOptions());

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toHaveLength(1);
      const warning = warnings[0]?.[0];
      expect(typeof warning).toBe("string");
      expect(
        (warning as string).startsWith(
          "[workflow] Agent step finished with reason 'other':\n",
        ),
      ).toBe(true);

      const payload = JSON.parse(
        (warning as string).replace(
          "[workflow] Agent step finished with reason 'other':\n",
          "",
        ),
      );

      expect(payload).toMatchObject({
        workflowRunId: "wrun_test-123",
        chatId: "chat-1",
        sessionId: "session-1",
        messageId: "gen-id-1",
        selectedModelId: "gpt-4",
        finishReason: "other",
        rawFinishReason: "provider_other",
        response: state.agentResponse,
        stepDiagnostics: [
          {
            stepNumber: 0,
            model: { provider: "openai", modelId: "test-model" },
            finishReason: "other",
            rawFinishReason: "provider_other",
            warnings: state.agentWarnings,
            request: {
              body: {
                model: "openai/gpt-5",
                store: false,
                maxOutputTokens: 512,
                inputCount: 1,
                toolsCount: 1,
              },
            },
            response: {
              id: "response-1",
              modelId: "test-model",
              headers: { "x-request-id": "req-123" },
              body: {
                id: "response-body-1",
                status: "incomplete",
                incompleteDetails: { reason: "max_output_tokens" },
                outputCount: 1,
                serviceTier: "default",
              },
              messageCount: 1,
            },
            providerMetadata: {
              openai: { responseId: "response-1", serviceTier: "default" },
            },
          },
        ],
      });
    } finally {
      console.warn = originalWarn;
    }
  });

  test("persists raw finish reasons for each agent step in message metadata", async () => {
    state.agentFinishReason = "tool-calls";
    state.agentStreamParts = [
      { type: "text-delta", textDelta: "Hi" },
      {
        type: "finish-step",
        finishReason: "tool-calls",
        rawFinishReason: "provider_tool_use",
        usage: state.agentTotalUsage,
      },
    ];

    await runAgentWorkflow(
      makeOptions({
        maxSteps: 2,
      }),
    );

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        lastStepFinishReason?: string;
        lastStepRawFinishReason?: string;
        stepFinishReasons?: Array<{
          finishReason: string;
          rawFinishReason?: string;
        }>;
      };
    };

    expect(persistedMessage.metadata?.lastStepFinishReason).toBe("tool-calls");
    expect(persistedMessage.metadata?.lastStepRawFinishReason).toBe(
      "provider_tool_use",
    );
    expect(persistedMessage.metadata?.stepFinishReasons).toEqual([
      {
        finishReason: "tool-calls",
        rawFinishReason: "provider_tool_use",
      },
      {
        finishReason: "tool-calls",
        rawFinishReason: "provider_tool_use",
      },
    ]);
  });

  test("streams and persists cumulative total message usage", async () => {
    state.agentFinishReason = "tool-calls";
    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "tool-calls",
        rawFinishReason: "provider_tool_use",
        usage: state.agentTotalUsage,
      },
    ];

    await runAgentWorkflow(
      makeOptions({
        maxSteps: 2,
      }),
    );

    const metadataChunks = state.writtenChunks.filter(
      (
        chunk,
      ): chunk is UIMessageChunk & {
        type: "message-metadata";
        messageMetadata: {
          totalMessageUsage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
          };
        };
      } => chunk.type === "message-metadata",
    );

    expect(
      metadataChunks.map((chunk) => ({
        inputTokens: chunk.messageMetadata.totalMessageUsage?.inputTokens,
        outputTokens: chunk.messageMetadata.totalMessageUsage?.outputTokens,
        totalTokens: chunk.messageMetadata.totalMessageUsage?.totalTokens,
      })),
    ).toEqual([
      { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    ]);

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        totalMessageUsage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        };
      };
    };

    expect({
      inputTokens: persistedMessage.metadata?.totalMessageUsage?.inputTokens,
      outputTokens: persistedMessage.metadata?.totalMessageUsage?.outputTokens,
      totalTokens: persistedMessage.metadata?.totalMessageUsage?.totalTokens,
    }).toEqual({
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30,
    });
  });

  test("streams and persists cumulative gateway cost", async () => {
    state.agentFinishReason = "tool-calls";
    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "tool-calls",
        rawFinishReason: "provider_tool_use",
        usage: state.agentTotalUsage,
        providerMetadata: {
          gateway: { cost: "0.0025" },
        },
      },
    ];
    state.agentProviderMetadata = {
      gateway: { cost: "0.0025" },
    };

    await runAgentWorkflow(
      makeOptions({
        maxSteps: 2,
      }),
    );

    const metadataChunks = state.writtenChunks.filter(
      (
        chunk,
      ): chunk is UIMessageChunk & {
        type: "message-metadata";
        messageMetadata: {
          lastStepCost?: number;
          totalMessageCost?: number;
        };
      } => chunk.type === "message-metadata",
    );

    expect(
      metadataChunks.map((chunk) => ({
        lastStepCost: chunk.messageMetadata.lastStepCost,
        totalMessageCost: chunk.messageMetadata.totalMessageCost,
      })),
    ).toEqual([
      { lastStepCost: 0.0025, totalMessageCost: 0.0025 },
      { lastStepCost: 0.0025, totalMessageCost: 0.005 },
    ]);

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        lastStepCost?: number;
        totalMessageCost?: number;
      };
    };

    expect(persistedMessage.metadata?.lastStepCost).toBe(0.0025);
    expect(persistedMessage.metadata?.totalMessageCost).toBeCloseTo(0.005, 10);
  });

  test("preserves previously accumulated gateway cost when resuming an assistant message", async () => {
    const existingTotalMessageCost = 0.0025;
    const resumedStepCost = 0.001;
    const expectedTotalMessageCost = existingTotalMessageCost + resumedStepCost;

    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "stop",
        rawFinishReason: "provider_stop",
        usage: state.agentTotalUsage,
        providerMetadata: {
          gateway: { cost: String(resumedStepCost) },
        },
      },
    ];
    state.agentProviderMetadata = {
      gateway: { cost: String(resumedStepCost) },
    };

    await runAgentWorkflow(
      makeOptions({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            parts: [{ type: "text", text: "Need your approval" }],
            metadata: {
              totalMessageCost: existingTotalMessageCost,
            },
          },
        ],
      }),
    );

    const metadataChunks = state.writtenChunks.filter(
      (
        chunk,
      ): chunk is UIMessageChunk & {
        type: "message-metadata";
        messageMetadata: {
          lastStepCost?: number;
          totalMessageCost?: number;
        };
      } => chunk.type === "message-metadata",
    );

    expect(metadataChunks.at(-1)?.messageMetadata.lastStepCost).toBe(
      resumedStepCost,
    );
    expect(
      metadataChunks.at(-1)?.messageMetadata.totalMessageCost,
    ).toBeCloseTo(expectedTotalMessageCost, 10);

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        lastStepCost?: number;
        totalMessageCost?: number;
      };
    };

    expect(persistedMessage.metadata?.lastStepCost).toBe(resumedStepCost);
    expect(persistedMessage.metadata?.totalMessageCost).toBeCloseTo(
      expectedTotalMessageCost,
      10,
    );
  });

  test("omits cost metadata when provider does not report gateway cost", async () => {
    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "stop",
        rawFinishReason: "provider_stop",
        usage: state.agentTotalUsage,
      },
    ];

    await runAgentWorkflow(makeOptions());

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      metadata?: {
        lastStepCost?: number;
        totalMessageCost?: number;
      };
    };

    expect(persistedMessage.metadata?.lastStepCost).toBeUndefined();
    expect(persistedMessage.metadata?.totalMessageCost).toBeUndefined();
  });

  test("refreshes lifecycle activity before clearing the active stream", async () => {
    const callOrder: string[] = [];
    state.spies.refreshLifecycleActivity.mockImplementationOnce(async () => {
      callOrder.push("refresh-lifecycle");
    });
    state.spies.clearActiveStream.mockImplementationOnce(async () => {
      callOrder.push("clear-stream");
    });

    await runAgentWorkflow(makeOptions());

    expect(state.spies.refreshLifecycleActivity).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["refresh-lifecycle", "clear-stream"]);
  });

  test("persists sandbox state when sandbox is present", async () => {
    await runAgentWorkflow(makeOptions());

    expect(state.spies.persistSandboxState).toHaveBeenCalledTimes(1);
  });

  test("clears active stream in finally block", async () => {
    await runAgentWorkflow(makeOptions());

    expect(state.spies.clearActiveStream).toHaveBeenCalledWith(
      "chat-1",
      "wrun_test-123",
    );
  });

  test("skips diff cache refresh when no file-changing tools ran", async () => {
    await runAgentWorkflow(makeOptions());

    expect(state.spies.refreshDiffCache).not.toHaveBeenCalled();
  });

  test("refreshes diff cache after a write tool runs", async () => {
    state.agentStreamParts = [];
    state.agentResponseMessages = [];
    state.agentResponse = { messages: state.agentResponseMessages };
    state.streamOnFinishCallback = undefined;
    const writeToolPart = {
      type: "tool-write",
      toolCallId: "write-1",
      state: "output-available",
      input: { filePath: "app/page.tsx" },
      output: { success: true },
    };
    state.agentAssistantParts = [writeToolPart];

    await runAgentWorkflow(makeOptions());

    expect(state.spies.refreshDiffCache).toHaveBeenCalledTimes(1);
  });

  test("runs auto-commit when enabled and not aborted", async () => {
    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        sessionTitle: "My session",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(state.spies.runAutoCommitStep).toHaveBeenCalledTimes(1);
    expect(state.spies.runAutoCommitStep).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );
  });

  test("runs auto PR creation when enabled and not aborted", async () => {
    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
        sessionTitle: "My session",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(state.spies.runAutoCreatePrStep).toHaveBeenCalledTimes(1);
    expect(state.spies.runAutoCreatePrStep).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        repoOwner: "acme",
        repoName: "repo",
      }),
    );
  });

  test("skips optimistic commit streaming when preflight finds no changes", async () => {
    state.spies.hasAutoCommitChangesStep.mockImplementationOnce(() =>
      Promise.resolve(false),
    );

    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(state.spies.runAutoCommitStep).not.toHaveBeenCalled();
    expect(state.spies.runAutoCreatePrStep).toHaveBeenCalledTimes(1);
    expect(
      state.writtenChunks.filter((chunk) => chunk.type === "data-commit"),
    ).toEqual([]);
  });

  test("streams and persists resolved git data parts", async () => {
    state.spies.runAutoCommitStep.mockImplementationOnce(() =>
      Promise.resolve({
        committed: true,
        pushed: true,
        commitMessage: "feat: add auto git status",
        commitSha: "abc123",
      }),
    );
    state.spies.runAutoCreatePrStep.mockImplementationOnce(() =>
      Promise.resolve({
        created: true,
        syncedExisting: false,
        skipped: false,
        prNumber: 101,
        prUrl: "https://github.com/acme/repo/pull/101",
      }),
    );

    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(
      state.writtenChunks.filter((chunk) => chunk.type === "data-commit"),
    ).toEqual([
      {
        type: "data-commit",
        id: "gen-id-1:commit",
        data: { status: "pending" },
      },
      {
        type: "data-commit",
        id: "gen-id-1:commit",
        data: {
          status: "success",
          committed: true,
          pushed: true,
          commitMessage: "feat: add auto git status",
          commitSha: "abc123",
          url: "https://github.com/acme/repo/commit/abc123",
        },
      },
    ]);
    expect(state.writtenChunks.filter((chunk) => chunk.type === "data-pr")).toEqual(
      [
        {
          type: "data-pr",
          id: "gen-id-1:pr",
          data: { status: "pending" },
        },
        {
          type: "data-pr",
          id: "gen-id-1:pr",
          data: {
            status: "success",
            created: true,
            syncedExisting: false,
            prNumber: 101,
            url: "https://github.com/acme/repo/pull/101",
          },
        },
      ],
    );

    const persistCalls = state.spies.persistAssistantMessage.mock
      .calls as unknown[][];
    const persistedMessage = persistCalls.at(-1)?.[1] as {
      parts: Array<Record<string, unknown>>;
    };

    expect(persistedMessage.parts).toEqual(
      expect.arrayContaining([
        {
          type: "data-commit",
          id: "gen-id-1:commit",
          data: {
            status: "success",
            committed: true,
            pushed: true,
            commitMessage: "feat: add auto git status",
            commitSha: "abc123",
            url: "https://github.com/acme/repo/commit/abc123",
          },
        },
        {
          type: "data-pr",
          id: "gen-id-1:pr",
          data: {
            status: "success",
            created: true,
            syncedExisting: false,
            prNumber: 101,
            url: "https://github.com/acme/repo/pull/101",
          },
        },
      ]),
    );
  });

  test("prunes synthetic git-only assistant messages before the next model call", async () => {
    await runAgentWorkflow(
      makeOptions({
        messages: [
          {
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
          {
            id: "assistant-git-1",
            role: "assistant",
            parts: [
              {
                type: "data-commit",
                id: "assistant-git-1:commit",
                data: { status: "success" },
              },
            ],
            metadata: {},
          },
          {
            id: "user-2",
            role: "user",
            parts: [{ type: "text", text: "What changed?" }],
          },
        ],
      }),
    );

    expect(state.agentInputMessages).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "What changed?" }],
      },
    ]);
  });

  test("skips auto PR creation when auto-commit does not push the latest commit", async () => {
    state.spies.runAutoCommitStep.mockImplementationOnce(() =>
      Promise.resolve({
        committed: true,
        pushed: false,
        error: "Commit succeeded but push failed",
      }),
    );

    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(state.spies.runAutoCommitStep).toHaveBeenCalledTimes(1);
    expect(state.spies.runAutoCreatePrStep).not.toHaveBeenCalled();
  });

  test("skips post-finish automation when the agent pauses for tool input", async () => {
    state.agentFinishReason = "tool-calls";
    state.agentRawFinishReason = "provider_tool_use";
    state.agentStreamParts = [
      {
        type: "finish-step",
        finishReason: "tool-calls",
        rawFinishReason: "provider_tool_use",
        usage: state.agentTotalUsage,
      },
    ];

    await runAgentWorkflow(
      makeOptions({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            parts: [
              {
                type: "tool-invocation",
                state: "approval-requested",
              },
            ],
            metadata: {},
          },
        ],
        autoCommitEnabled: true,
        autoCreatePrEnabled: true,
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(state.spies.runAutoCommitStep).not.toHaveBeenCalled();
    expect(state.spies.runAutoCreatePrStep).not.toHaveBeenCalled();
  });

  test("skips auto PR creation when not enabled", async () => {
    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
        autoCreatePrEnabled: false,
        repoOwner: "acme",
        repoName: "repo",
      }),
    );

    expect(state.spies.runAutoCreatePrStep).not.toHaveBeenCalled();
  });

  test("skips auto-commit when not enabled", async () => {
    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: false,
      }),
    );

    expect(state.spies.runAutoCommitStep).not.toHaveBeenCalled();
  });

  test("skips auto-commit when repoOwner is missing", async () => {
    state.spies.resolveChatSandboxRuntime.mockImplementationOnce(() =>
      Promise.resolve(
        state.createResolvedChatSandboxRuntime({
          repoOwner: undefined,
          repoName: "repo",
        }),
      ),
    );

    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
      }),
    );

    expect(state.spies.runAutoCommitStep).not.toHaveBeenCalled();
  });

  test("skips auto-commit when repoName is missing", async () => {
    state.spies.resolveChatSandboxRuntime.mockImplementationOnce(() =>
      Promise.resolve(
        state.createResolvedChatSandboxRuntime({
          repoOwner: "acme",
          repoName: undefined,
        }),
      ),
    );

    await runAgentWorkflow(
      makeOptions({
        autoCommitEnabled: true,
      }),
    );

    expect(state.spies.runAutoCommitStep).not.toHaveBeenCalled();
  });

  test("still clears stream and sends finish even on step error", async () => {
    state.throwOnAgentStream = true;

    try {
      await runAgentWorkflow(makeOptions());
    } catch {
      // Expected to throw
    }

    // The finally block should still fire
    expect(state.spies.clearActiveStream).toHaveBeenCalled();
  });
});
