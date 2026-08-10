import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentSession: {
    authProvider: "github" as const,
    user: {
      id: "user-1",
      username: "reader",
      name: "Reader",
      email: "reader@example.com",
      avatar: "",
    },
  } as {
    authProvider: "github" | "vercel";
    user: {
      id: string;
      username: string;
      name?: string;
      email?: string;
      avatar: string;
    };
  } | null,
  pageContext: null as Record<string, any> | null,
  canRead: true,
  activePageSession: undefined as Record<string, any> | undefined,
  activePageSessionAfterConflict: undefined as Record<string, any> | undefined,
  latestChat: undefined as Record<string, any> | undefined,
  existingSessionCount: 0,
  managedTrial: false,
  editablePage: null as Record<string, any> | null,
  createPageSessionError: null as Error | null,
  createPageSessionCalls: [] as Array<Record<string, unknown>>,
  syncCalls: [] as Array<Record<string, unknown>>,
  botVerification: { isBot: false },
  rateLimitResponse: null as Response | null,
  kickSandboxProvisioningWorkflow: vi.fn(),
  sanitizeUserPreferencesForSession: vi.fn((preferences: unknown) => preferences),
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => mocks.currentSession,
}));

vi.mock("@/lib/botid", () => ({
  checkBotProtection: async () => mocks.botVerification,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => mocks.rateLimitResponse,
  rateLimitKey: (parts: unknown[]) => parts.join(":"),
}));

vi.mock("@/lib/managed-template-trial", () => ({
  isManagedTemplateTrialUser: () => mocks.managedTrial,
  MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT: 1,
  MANAGED_TEMPLATE_TRIAL_SESSION_LIMIT_ERROR: "trial limit",
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences: async () => ({
    defaultModelId: "openai/gpt-5",
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
  sanitizeUserPreferencesForSession: mocks.sanitizeUserPreferencesForSession,
}));

vi.mock("@/lib/db/page-auth", () => ({
  findEditablePage: async () => mocks.editablePage,
}));

vi.mock("@/lib/services/community", () => ({
  getPublishedPageContext: async () => mocks.pageContext,
  canReadPage: () => mocks.canRead,
}));

vi.mock("@/lib/db/sessions", () => ({
  countSessionsByUserId: async () => mocks.existingSessionCount,
  getActivePageSession: vi.fn(async () => {
    if (
      mocks.createPageSessionError &&
      mocks.createPageSessionCalls.length > 0 &&
      mocks.activePageSessionAfterConflict
    ) {
      return mocks.activePageSessionAfterConflict;
    }
    return mocks.activePageSession;
  }),
  createPageSessionWithInitialChat: async (input: Record<string, unknown>) => {
    mocks.createPageSessionCalls.push(input);
    if (mocks.createPageSessionError) {
      throw mocks.createPageSessionError;
    }
    return {
      session: {
        id: "session-new",
        userId: "user-1",
        title: "Guide",
        status: "running",
        agentType: "chat",
        publishedPageId: "page-1",
        pageUserSlug: "alice",
        pageSlug: "guide",
      },
      chat: {
        id: String(input.chatId),
        sessionId: "session-new",
        title: "New chat",
        modelId: String(input.modelId),
      },
    };
  },
  getLatestChatBySessionId: async () => mocks.latestChat,
  syncPageSessionSnapshot: async (
    sessionId: string,
    snapshot: Record<string, unknown>,
  ) => {
    mocks.syncCalls.push({ sessionId, ...snapshot });
    return {
      ...(mocks.activePageSession ?? mocks.activePageSessionAfterConflict),
      ...snapshot,
    };
  },
}));

vi.mock("@/lib/sandbox/provisioning-kick", () => ({
  kickSandboxProvisioningWorkflow: mocks.kickSandboxProvisioningWorkflow,
}));

const routeModulePromise = import("./route");

const existingSession = {
  id: "session-existing",
  userId: "user-1",
  title: "Old title",
  status: "running",
  agentType: "chat",
  publishedPageId: "page-1",
  pageUserSlug: "old",
  pageSlug: "old-guide",
};
const winnerSession = { ...existingSession, id: "session-winner" };
const newerChat = {
  id: "chat-newer",
  sessionId: existingSession.id,
  title: "Latest chat",
  modelId: "openai/gpt-5",
};

function pageSessionRequest(userSlug: string, pageSlug: string): Request {
  return new Request("http://localhost/api/page-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_slug: userSlug, page_slug: pageSlug }),
  });
}

async function json(responsePromise: Promise<Response>) {
  return responsePromise.then((response) => response.json());
}

describe("POST /api/page-sessions", () => {
  beforeEach(() => {
    mocks.currentSession = {
      authProvider: "github",
      user: {
        id: "user-1",
        username: "reader",
        name: "Reader",
        email: "reader@example.com",
        avatar: "",
      },
    };
    mocks.pageContext = {
      page: {
        id: "page-1",
        userId: "author-1",
        authorSlug: "alice",
        uid: "guide",
        title: "Guide",
      },
      author: { id: "author-1", userSlug: "alice" },
    };
    mocks.canRead = true;
    mocks.activePageSession = undefined;
    mocks.activePageSessionAfterConflict = undefined;
    mocks.latestChat = newerChat;
    mocks.existingSessionCount = 0;
    mocks.managedTrial = false;
    mocks.editablePage = null;
    mocks.createPageSessionError = null;
    mocks.createPageSessionCalls.length = 0;
    mocks.syncCalls.length = 0;
    mocks.botVerification.isBot = false;
    mocks.rateLimitResponse = null;
    mocks.kickSandboxProvisioningWorkflow.mockClear();
    mocks.sanitizeUserPreferencesForSession.mockClear();
  });

  test("returns 401 without a login", async () => {
    mocks.currentSession = null;
    const { POST } = await routeModulePromise;

    const response = await POST(pageSessionRequest("alice", "guide"));

    expect(response.status).toBe(401);
    expect(mocks.createPageSessionCalls).toHaveLength(0);
  });

  test("returns 400 for invalid snake_case input", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      new Request("http://localhost/api/page-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userSlug: "alice", pageSlug: "guide" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createPageSessionCalls).toHaveLength(0);
  });

  test("returns 404 without revealing a missing page", async () => {
    mocks.pageContext = null;
    const { POST } = await routeModulePromise;

    const response = await POST(pageSessionRequest("alice", "missing"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Page not found" });
    expect(mocks.createPageSessionCalls).toHaveLength(0);
  });

  test("returns 404 and does not create when canReadPage rejects", async () => {
    mocks.canRead = false;
    const { POST } = await routeModulePromise;

    const response = await POST(pageSessionRequest("alice", "private"));

    expect(response.status).toBe(404);
    expect(mocks.createPageSessionCalls).toHaveLength(0);
  });

  test("restores the latest chat and syncs renamed page snapshots", async () => {
    mocks.activePageSession = existingSession;
    mocks.latestChat = newerChat;
    const { POST } = await routeModulePromise;

    const body = await json(POST(pageSessionRequest("old", "old-guide")));

    expect(mocks.syncCalls[0]).toEqual({
      sessionId: existingSession.id,
      title: mocks.pageContext?.page.title,
      pageUserSlug: mocks.pageContext?.page.authorSlug,
      pageSlug: mocks.pageContext?.page.uid,
    });
    expect(body.chat.id).toBe(newerChat.id);
  });

  test("creates chat session with default model and never kicks sandbox", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(pageSessionRequest("alice", "guide"));

    expect(response.status).toBe(200);
    expect(mocks.createPageSessionCalls[0]).toMatchObject({
      publishedPageId: "page-1",
      pageUserSlug: "alice",
      pageSlug: "guide",
      modelId: "openai/gpt-5",
    });
    expect(mocks.kickSandboxProvisioningWorkflow).not.toHaveBeenCalled();
    expect(mocks.sanitizeUserPreferencesForSession).toHaveBeenCalledWith(
      expect.objectContaining({ defaultModelId: "openai/gpt-5" }),
      mocks.currentSession,
      "http://localhost/api/page-sessions",
    );
  });

  test("reports can_edit for a team page manager using the shared permission helper", async () => {
    mocks.editablePage = { ...mocks.pageContext?.page };
    const { POST } = await routeModulePromise;

    const body = await json(POST(pageSessionRequest("alice", "guide")));

    expect(body.page.can_edit).toBe(true);
  });

  test("does not grant can_edit when the permission helper resolves a different page", async () => {
    mocks.editablePage = { ...mocks.pageContext?.page, id: "page-other" };
    const { POST } = await routeModulePromise;

    const body = await json(POST(pageSessionRequest("alice", "guide")));

    expect(body.page.can_edit).toBe(false);
  });

  test("re-reads the winning active session after a 23505 race", async () => {
    mocks.createPageSessionError = Object.assign(new Error("duplicate"), {
      code: "23505",
    });
    mocks.activePageSessionAfterConflict = winnerSession;
    mocks.latestChat = { ...newerChat, sessionId: winnerSession.id };
    const { POST } = await routeModulePromise;

    const body = await json(POST(pageSessionRequest("alice", "guide")));

    expect(body.session.id).toBe(winnerSession.id);
  });

  test("creates a new active session after the previous page session was archived", async () => {
    const archivedPageSession = { ...existingSession, status: "archived" };
    mocks.activePageSession = undefined;
    const { POST } = await routeModulePromise;

    const body = await json(POST(pageSessionRequest("alice", "guide")));

    expect(body.session.id).not.toBe(archivedPageSession.id);
    expect(mocks.createPageSessionCalls).toHaveLength(1);
  });

  test("applies the existing bot and per-user session creation limits", async () => {
    const { POST } = await routeModulePromise;
    mocks.botVerification.isBot = true;
    expect((await POST(pageSessionRequest("alice", "guide"))).status).toBe(403);

    mocks.botVerification.isBot = false;
    mocks.rateLimitResponse = new Response("limited", { status: 429 });
    expect((await POST(pageSessionRequest("alice", "guide"))).status).toBe(429);
    expect(mocks.createPageSessionCalls).toHaveLength(0);
  });

  test("applies the managed trial limit only when a new session is needed", async () => {
    const { POST } = await routeModulePromise;
    mocks.managedTrial = true;
    mocks.existingSessionCount = 1;
    mocks.activePageSession = existingSession;

    const restored = await POST(pageSessionRequest("alice", "guide"));
    expect(restored.status).toBe(200);

    mocks.activePageSession = undefined;
    const rejected = await POST(pageSessionRequest("alice", "guide"));
    expect(rejected.status).toBe(403);
    expect(mocks.createPageSessionCalls).toHaveLength(0);
  });
});
