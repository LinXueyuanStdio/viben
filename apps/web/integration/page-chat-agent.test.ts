import { act, render, screen, waitFor } from "@testing-library/react";
import { createElement, useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UIMessageChunk } from "ai";
import type { WebAgentUIMessage } from "@/app/types";
import type { Chat, Session } from "@/lib/db/schema";
import { emitPageContentChanged } from "@/lib/page-chat/page-content-events";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

const state = vi.hoisted(() => {
  const readerSession = {
    authProvider: "github" as const,
    user: {
      id: "reader-1",
      username: "reader",
      name: "Reader",
      email: "reader@example.com",
      avatar: "",
    },
  };
  const authorSession = {
    authProvider: "github" as const,
    user: {
      id: "author-1",
      username: "alice",
      name: "Alice",
      email: "alice@example.com",
      avatar: "",
    },
  };

  return {
    readerSession,
    authorSession,
    currentSession: readerSession as typeof readerSession | typeof authorSession | null,
    pageContext: null as {
      page: Record<string, unknown>;
      author: Record<string, unknown>;
    } | null,
    activePageSession: undefined as Record<string, unknown> | undefined,
    latestChat: undefined as Record<string, unknown> | undefined,
    testSessionRecord: null as Record<string, unknown> | null,
    testChatRecord: null as Record<string, unknown> | null,
    previewSessionRecord: null as Record<string, unknown> | null,
    previewPageRecord: null as Record<string, unknown> | null,
    canRead: true,
    editablePage: null as Record<string, unknown> | null,
    pageAgentMode: "reader" as "reader" | "author" | "none",
    pageAgentInputs: [] as Array<Record<string, unknown>>,
    mcpCalls: [] as Array<Record<string, unknown>>,
    transportInputs: [] as Array<Record<string, unknown>>,
    writtenChunks: [] as UIMessageChunk[],
    persistedAssistantMessages: [] as Array<Record<string, unknown>>,
    createPageSessionCalls: [] as Array<Record<string, unknown>>,
    refreshSpy: vi.fn(),
    readDrawerSpy: vi.fn(),
    clientConnect: vi.fn(),
    clientClose: vi.fn(),
    resolveChatSandboxRuntime: vi.fn(),
    persistSandboxState: vi.fn(),
    refreshDiffCache: vi.fn(),
    refreshLifecycleActivity: vi.fn(),
    runAutoCommitStep: vi.fn(),
    runAutoCreatePrStep: vi.fn(),
    hasAutoCommitChangesStep: vi.fn(),
    persistUserMessage: vi.fn(),
    persistAssistantMessageWithToolResults: vi.fn(),
    clearActiveStream: vi.fn(),
    closeStream: vi.fn(),
    sendFinish: vi.fn(),
    recordWorkflowUsage: vi.fn(),
    sanitizeUserPreferencesForSession: vi.fn((preferences: unknown) => preferences),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "community.comments": "Comments",
        "community.notes": "Notes",
        "community.read": "Read",
        "assistant.pageChat.tab": "Assistant",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: state.refreshSpy }),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => createElement("div", { "data-testid": "dynamic-panel" }),
}));

vi.mock("@/components/layout/app-shell", () => ({
  useAppShell: () => ({ isMobile: false }),
}));

vi.mock("@/components/layout/read-drawer", () => ({
  ReadDrawer: (props: object) => {
    state.readDrawerSpy(props);
    return createElement("div", { "data-testid": "read-drawer" });
  },
}));

vi.mock("@/components/assistant/lazy-streamdown", () => ({
  LazyStreamdown: ({ children }: { children: string }) =>
    createElement("div", { "data-testid": "assistant-text" }, children),
}));

vi.mock("@/components/assistant/thinking-block", () => ({
  ThinkingBlock: ({ text }: { text: string }) =>
    createElement("div", { "data-testid": "reasoning" }, text),
}));

vi.mock("@/components/assistant/tool-call", () => ({
  ToolCall: ({ part }: { part: { type: string; toolName?: string } }) =>
    createElement("div", { "data-testid": "tool-call" }, part.toolName ?? part.type),
}));

vi.mock("@/components/assistant/assistant-message-groups", () => ({
  AssistantMessageGroups: ({
    children,
  }: {
    children: (open: boolean) => ReactNode;
  }) => createElement("div", { "data-testid": "assistant-message" }, children(true)),
}));

vi.mock("@/components/assistant/message-model-pill", () => ({
  MessageModelPill: () => createElement("span", { "data-testid": "model-pill" }),
}));

vi.mock("workflow", () => ({
  getWorkflowMetadata: () => ({ workflowRunId: "wrun-page-chat" }),
  getWritable: () =>
    new WritableStream<UIMessageChunk>({
      write(chunk) {
        state.writtenChunks.push(chunk);
      },
    }),
}));

vi.mock("workflow/api", () => ({
  getRun: () => ({
    status: Promise.resolve("running"),
  }),
}));

vi.mock("ai", () => ({
  convertToModelMessages: async (messages: Array<Record<string, unknown>>) =>
    messages.map((message) => ({
      role: message.role,
      content: Array.isArray(message.parts) ? message.parts : [],
    })),
  dynamicTool: (definition: Record<string, unknown>) => definition,
  generateId: () => "assistant-1",
  isReasoningUIPart: (part: { type: string }) => part.type === "reasoning",
  isToolUIPart: (part: { type: string }) => part.type.startsWith("tool-"),
  pruneMessages: ({ messages }: { messages: Array<Record<string, unknown>> }) =>
    messages,
}));

vi.mock("@viben/agent", () => ({}));

vi.mock("@/app/config", () => {
  async function streamWithResponse(args: {
    options?: {
      tools?: Record<string, { execute?: (input: unknown, options: unknown) => unknown }>;
    };
  }) {
    if (state.pageAgentMode === "reader") {
      await args.options?.tools?.get_page?.execute?.({}, {});
    }
    if (state.pageAgentMode === "author") {
      await args.options?.tools?.update_page?.execute?.(
        { uid: "malicious", title: "Better guide" },
        {},
      );
    }

    return {
      toUIMessageStream: (options: {
        generateMessageId?: () => string;
        onFinish?: (args: { responseMessage: WebAgentUIMessage }) => void;
      }) => ({
        async *[Symbol.asyncIterator]() {
          const responseMessage = {
            id: options.generateMessageId?.() ?? "assistant-1",
            role: "assistant",
            parts:
              state.pageAgentMode === "none"
                ? [
                    {
                      type: "tool-write",
                      toolCallId: "tool-write-1",
                      state: "output-available",
                      input: {},
                      output: { ok: true },
                    },
                    { type: "text", text: "Work answer" },
                  ]
                : [{ type: "text", text: "Page answer" }],
            metadata: {},
          } as WebAgentUIMessage;
          options.onFinish?.({ responseMessage });
          yield {
            type: "finish-step",
            finishReason: "stop",
            rawFinishReason: "provider_stop",
            usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          };
        },
      }),
      totalUsage: Promise.resolve({
        inputTokens: 3,
        outputTokens: 2,
        totalTokens: 5,
      }),
      finishReason: Promise.resolve("stop"),
      rawFinishReason: Promise.resolve("provider_stop"),
      response: Promise.resolve({ messages: [] }),
      steps: Promise.resolve([
        {
          providerMetadata: undefined,
        },
      ]),
    };
  }

  return {
    pageAgent: {
      tools: {},
      stream: vi.fn(async (args: Record<string, unknown>) => {
        state.pageAgentInputs.push(args);
        return streamWithResponse(args);
      }),
    },
    webAgent: {
      tools: {},
      stream: vi.fn(streamWithResponse),
    },
    workAgent: {
      tools: {},
      stream: vi.fn(streamWithResponse),
    },
  };
});

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    async connect(transport: unknown) {
      state.clientConnect(transport);
    }

    async callTool(input: Record<string, unknown>) {
      state.mcpCalls.push(input);
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        isError: false,
      };
    }

    setNotificationHandler(_schema: unknown, _handler: unknown) {}

    async subscribeResource(_input: Record<string, unknown>) {}

    async unsubscribeResource(_input: Record<string, unknown>) {}

    async close() {
      state.clientClose();
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    constructor(endpoint: URL, options: Record<string, unknown>) {
      state.transportInputs.push({ endpoint, options });
    }
  },
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => state.currentSession,
}));

vi.mock("@/lib/botid", () => ({
  checkBotProtection: async () => ({ isBot: false }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => null,
  rateLimitKey: (parts: string[]) => parts.join(":"),
}));

vi.mock("@/lib/managed-template-trial", () => ({
  isManagedTemplateTrialUser: () => false,
  MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT: 1,
  MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT_ERROR: "trial limit",
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => ({
    defaultModelId: "openai/gpt-5.4",
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
  }),
}));

vi.mock("@/lib/model-access", () => ({
  filterModelVariantsForSession: (_variants: unknown[]) => [],
  sanitizeSelectedModelIdForSession: (modelId: string | null) => modelId,
  sanitizeUserPreferencesForSession: state.sanitizeUserPreferencesForSession,
}));

vi.mock("@/lib/services/community", () => ({
  canReadPage: () => state.canRead,
  getPublishedPageContext: async () => state.pageContext,
}));

vi.mock("@/lib/db/page-auth", () => ({
  findEditablePage: async () => state.editablePage,
}));

vi.mock("@/lib/auth/jwe", () => ({
  encryptSession: async () => "test-page-jwe",
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      sessions: {
        findFirst: async () => state.previewSessionRecord ?? state.testSessionRecord,
      },
      publishedPages: {
        findFirst: async () => state.previewPageRecord,
      },
      users: {
        findFirst: async () => ({
          id: state.currentSession?.user.id ?? "reader-1",
          username: state.currentSession?.user.username ?? "reader",
          userSlug: state.currentSession?.user.username ?? "reader",
          displayName: state.currentSession?.user.name ?? "Reader",
          email: state.currentSession?.user.email ?? "reader@example.com",
          role: "user",
          avatarUrl: state.currentSession?.user.avatar ?? "",
        }),
      },
    },
  },
}));

vi.mock("@/lib/db/sessions", () => ({
  claimActiveStream: state.clearActiveStream,
  claimChatActiveStreamId: async () => true,
  clearActiveStream: state.clearActiveStream,
  compareAndSetChatActiveStreamId: async () => true,
  countSessionsByUserId: async () => 0,
  createChatMessageIfNotExists: async () => ({}),
  createPageSessionWithInitialChat: async (input: Record<string, unknown>) => {
    state.createPageSessionCalls.push(input);
    const session = {
      id: "page-session-1",
      userId: input.userId,
      title: input.title,
      status: "running",
      agentType: "chat",
      publishedPageId: input.publishedPageId,
      pageUserSlug: input.pageUserSlug,
      pageSlug: input.pageSlug,
      sandboxState: null,
      lifecycleState: null,
    };
    const chat = {
      id: input.chatId,
      sessionId: session.id,
      title: input.chatTitle,
      modelId: input.modelId,
      activeStreamId: null,
    };
    state.activePageSession = session;
    state.latestChat = chat;
    state.testSessionRecord = session;
    state.testChatRecord = chat;
    return { session, chat };
  },
  getActivePageSession: async () => state.activePageSession,
  getChatById: async () => state.testChatRecord,
  getChatMessageByIdForChat: async () => null,
  getLatestChatBySessionId: async () => state.latestChat,
  getSessionById: async () => state.testSessionRecord,
  isFirstChatMessage: async () => true,
  persistAssistantMessage: state.persistAssistantMessageWithToolResults,
  syncPageSessionSnapshot: async (
    sessionId: string,
    snapshot: Record<string, unknown>,
  ) => ({
    ...(state.activePageSession ?? {}),
    id: sessionId,
    ...snapshot,
  }),
  touchChat: async () => {},
  updateChat: async () => {},
  updateChatActiveStreamId: async () => {},
  updateChatAssistantActivity: async () => {},
  upsertChatMessageScoped: async () => ({ status: "inserted" }),
}));

vi.mock("@/app/workflows/chat-sandbox-runtime", () => ({
  resolveChatSandboxRuntime: state.resolveChatSandboxRuntime,
}));

vi.mock("@/app/workflows/chat-post-finish", () => ({
  claimActiveStream: async (
    _chatId: string,
    _workflowRunId: string,
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
  clearActiveStream: state.clearActiveStream,
  closeStream: state.closeStream,
  hasAutoCommitChangesStep: state.hasAutoCommitChangesStep,
  persistAssistantMessage: async (_chatId: string, message: Record<string, unknown>) => {
    state.persistedAssistantMessages.push(message);
  },
  persistAssistantMessageWithToolResults: state.persistAssistantMessageWithToolResults,
  persistSandboxState: state.persistSandboxState,
  persistUserMessage: state.persistUserMessage,
  recordWorkflowUsage: state.recordWorkflowUsage,
  refreshDiffCache: state.refreshDiffCache,
  refreshLifecycleActivity: state.refreshLifecycleActivity,
  runAutoCommitStep: state.runAutoCommitStep,
  runAutoCreatePrStep: state.runAutoCreatePrStep,
  sendFinish: async (writable: WritableStream<UIMessageChunk>) => {
    state.sendFinish(writable);
    const writer = writable.getWriter();
    try {
      await writer.write({ type: "finish", finishReason: "stop" });
    } finally {
      writer.releaseLock();
    }
  },
}));

const pageSessionsRoutePromise = import("@/app/api/page-sessions/route");
const previewRoutePromise = import("@/app/api/page-sessions/[sessionId]/preview/route");
const workflowPromise = import("@/app/workflows/chat");
const readPageClientPromise = import("@/components/pages/read-page-client");
const previewContextPromise = import("@/components/assistant/page-preview-context");

function resetPageContext() {
  state.pageContext = {
    page: {
      id: "page-1",
      userId: "author-1",
      authorSlug: "alice",
      uid: "guide",
      title: "Guide",
      visibility: "public",
      moderationStatus: "approved",
      html: "<main>Guide</main>",
    },
    author: { id: "author-1", userSlug: "alice" },
  };
  state.previewPageRecord = {
    id: "page-1",
    userId: "author-1",
    authorSlug: "alice",
    uid: "guide",
    title: "Guide",
    visibility: "public",
    moderationStatus: "approved",
    html: "<main>Guide</main>",
  };
}

function pageSessionRequest(userSlug = "alice", pageSlug = "guide") {
  return new Request("http://localhost/api/page-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_slug: userSlug, page_slug: pageSlug }),
  });
}

async function createPageSession() {
  const { POST } = await pageSessionsRoutePromise;
  const response = await POST(pageSessionRequest());
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    session: Session;
    chat: Chat;
    page: { can_edit: boolean };
  }>;
}

function workflowOptions(session: Session, chat: Chat) {
  return {
    messages: [
      {
        id: "user-message-1",
        role: "user" as const,
        parts: [{ type: "text", text: "Summarize this page" }],
      },
    ],
    chatId: chat.id,
    sessionId: session.id,
    userId: session.userId,
    requestUrl: "http://localhost/api/chat",
    authSession: state.currentSession,
    selectedModelId: "openai/gpt-5.4",
    modelId: "openai/gpt-5.4",
    agentOptions: {},
    maxSteps: 1,
  };
}

const baseReadPageProps = {
  userSlug: "alice",
  pageId: "guide",
  pageHtml: "<main>Guide</main>",
  pageTitle: "Guide",
  pageDescription: "A guide",
  pageUid: "guide",
  pageViewCount: 10,
  pageBookmarkCount: 2,
  pageLikeCount: 3,
  pageCommentCount: 4,
  pageShareCount: 1,
  pagePublishedAt: "2026-08-12T00:00:00.000Z",
  pageTags: ["docs"],
  authorDisplayName: "Alice",
  authorAvatarUrl: null,
  authorFollowersCount: 5,
  isAuthenticated: true,
  sessionUserId: "author-1",
  communityEntityId: "entity-1",
  pageDbId: "page-1",
  recommendationEntries: [],
  viewerHasReacted: false,
  viewerHasBookmarked: false,
  initialComments: [],
  initialCommentsNextCursor: null,
};

describe("Page Chat Agent integration", () => {
  beforeEach(() => {
    state.currentSession = state.readerSession;
    resetPageContext();
    state.activePageSession = undefined;
    state.latestChat = undefined;
    state.testSessionRecord = null;
    state.testChatRecord = null;
    state.previewSessionRecord = null;
    state.canRead = true;
    state.editablePage = null;
    state.pageAgentMode = "reader";
    state.pageAgentInputs.length = 0;
    state.mcpCalls.length = 0;
    state.transportInputs.length = 0;
    state.writtenChunks.length = 0;
    state.persistedAssistantMessages.length = 0;
    state.createPageSessionCalls.length = 0;
    state.refreshSpy.mockClear();
    state.readDrawerSpy.mockClear();
    state.clientConnect.mockClear();
    state.clientClose.mockClear();
    state.resolveChatSandboxRuntime.mockReset();
    state.resolveChatSandboxRuntime.mockResolvedValue({
      sandboxState: {
        type: "vercel",
        sandboxName: "session_session-work",
        expiresAt: Date.now() + 60_000,
      },
      workingDirectory: "/vercel/sandbox",
      currentBranch: "main",
      environmentDetails: "test sandbox",
      skills: [],
      didSetupWorkspace: false,
      sessionTitle: "Work session",
      repoOwner: "acme",
      repoName: "repo",
    });
    state.persistSandboxState.mockClear();
    state.refreshDiffCache.mockClear();
    state.refreshLifecycleActivity.mockClear();
    state.runAutoCommitStep.mockClear();
    state.runAutoCreatePrStep.mockClear();
    state.hasAutoCommitChangesStep.mockResolvedValue(false);
    state.hasAutoCommitChangesStep.mockClear();
    state.persistUserMessage.mockClear();
    state.persistAssistantMessageWithToolResults.mockClear();
    state.clearActiveStream.mockClear();
    state.closeStream.mockClear();
    state.sendFinish.mockClear();
    state.recordWorkflowUsage.mockClear();
    state.sanitizeUserPreferencesForSession.mockClear();
  });

  test("reader creates one page chat, summarizes through scoped get_page, and resumes it", async () => {
    const first = await createPageSession();
    const second = await createPageSession();

    expect(second.session.id).toBe(first.session.id);
    expect(second.chat.id).toBe(first.chat.id);

    const { runAgentWorkflow } = await workflowPromise;
    await runAgentWorkflow(workflowOptions(first.session, first.chat));

    expect(state.mcpCalls).toContainEqual({
      name: "get_page",
      arguments: { author_slug: "alice", page_uid: "guide" },
    });
    expect(state.persistedAssistantMessages).toHaveLength(1);
    expect(state.resolveChatSandboxRuntime).not.toHaveBeenCalled();
    expect(state.persistSandboxState).not.toHaveBeenCalled();
    expect(state.refreshDiffCache).not.toHaveBeenCalled();
    expect(state.runAutoCommitStep).not.toHaveBeenCalled();
  });

  test("author update goes through update_page and refreshes both page surfaces", async () => {
    state.currentSession = state.authorSession;
    state.editablePage = state.pageContext?.page ?? null;
    state.pageAgentMode = "author";
    const pageChat = await createPageSession();
    expect(pageChat.page.can_edit).toBe(true);

    const { runAgentWorkflow } = await workflowPromise;
    await runAgentWorkflow(workflowOptions(pageChat.session, pageChat.chat));

    expect(state.mcpCalls).toContainEqual({
      name: "update_page",
      arguments: { uid: "guide", title: "Better guide" },
    });

    const { ReadPageClient } = await readPageClientPromise;
    const { PagePreviewProvider, usePagePreview } = await previewContextPromise;

    function OpenPreviewProbe() {
      const { setOpen, revision } = usePagePreview();
      useEffect(() => {
        setOpen(true);
      }, [setOpen]);
      return createElement("div", { "data-testid": "preview-revision" }, revision);
    }

    render(
      createElement(
        "div",
        null,
        createElement(ReadPageClient, baseReadPageProps),
        createElement(
          PagePreviewProvider,
          { publishedPageId: "page-1" },
          createElement(OpenPreviewProbe),
        ),
      ),
    );

    await waitFor(() =>
      expect(screen.getByTestId("preview-revision")).toHaveTextContent("0"),
    );

    expect(state.refreshSpy).not.toHaveBeenCalled();

    act(() => {
      emitPageContentChanged({
        publishedPageId: "page-1",
        chatId: pageChat.chat.id,
      });
    });

    await waitFor(() => expect(state.refreshSpy).toHaveBeenCalledOnce());
    expect(screen.getByTestId("preview-revision")).toHaveTextContent("1");
  });

  test("deleted or revoked pages preserve history but block agent and preview", async () => {
    const pageChat = await createPageSession();
    state.canRead = false;
    state.pageAgentMode = "reader";
    state.previewSessionRecord = pageChat.session;

    const { runAgentWorkflow } = await workflowPromise;
    await expect(
      runAgentWorkflow(workflowOptions(pageChat.session, pageChat.chat)),
    ).rejects.toThrow("Page unavailable");

    const { GET } = await previewRoutePromise;
    const preview = await GET(
      new Request("http://localhost/api/page-sessions/page-session-1/preview"),
      { params: Promise.resolve({ sessionId: pageChat.session.id }) },
    );

    expect(preview.status).toBe(404);
    expect(state.mcpCalls).toHaveLength(0);
    expect(state.persistedAssistantMessages).toHaveLength(1);
  });

  test("work chats and repo sessions retain provisioning and work runtime", async () => {
    state.pageAgentMode = "none";
    state.testSessionRecord = {
      id: "session-work",
      userId: "reader-1",
      title: "Work session",
      status: "running",
      agentType: "work",
      repoOwner: "acme",
      repoName: "repo",
      autoCommitPushOverride: false,
      autoCreatePrOverride: false,
    };
    state.testChatRecord = {
      id: "chat-work",
      sessionId: "session-work",
      modelId: "openai/gpt-5.4",
      activeStreamId: null,
    };

    const { runAgentWorkflow } = await workflowPromise;
    await runAgentWorkflow(
      workflowOptions(state.testSessionRecord as Session, state.testChatRecord as Chat),
    );

    expect(state.resolveChatSandboxRuntime).toHaveBeenCalledTimes(1);
    expect(state.persistSandboxState).toHaveBeenCalledTimes(1);
    expect(state.refreshLifecycleActivity).toHaveBeenCalledTimes(1);
    expect(state.refreshDiffCache).toHaveBeenCalledTimes(1);
  });
});
