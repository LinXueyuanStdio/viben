import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionRecord: null as Record<string, any> | null,
  pageRecord: null as Record<string, any> | null,
  userRecord: null as Record<string, any> | null,
  canRead: true,
  editablePage: null as Record<string, any> | null,
  encryptedToken: "test-jwe-token",
  callToolResult: {
    content: [{ type: "text", text: "{\"success\":true}" }],
    isError: false,
  } as Record<string, any>,
  clientConnect: vi.fn(),
  clientCallTool: vi.fn(),
  clientClose: vi.fn(),
  transportInputs: [] as Array<Record<string, any>>,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      sessions: {
        findFirst: vi.fn(async () => mocks.sessionRecord),
      },
      publishedPages: {
        findFirst: vi.fn(async () => mocks.pageRecord),
      },
      users: {
        findFirst: vi.fn(async () => mocks.userRecord),
      },
    },
  },
}));

vi.mock("@/lib/services/community", () => ({
  canReadPage: () => mocks.canRead,
}));

vi.mock("@/lib/db/page-auth", () => ({
  findEditablePage: vi.fn(async () => mocks.editablePage),
}));

vi.mock("@/lib/auth/jwe", () => ({
  encryptSession: vi.fn(async () => mocks.encryptedToken),
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    async connect(transport: unknown) {
      mocks.clientConnect(transport);
    }

    async callTool(input: Record<string, unknown>) {
      mocks.clientCallTool(input);
      return mocks.callToolResult;
    }

    async close() {
      mocks.clientClose();
    }
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: class {
    constructor(endpoint: URL, options: Record<string, unknown>) {
      mocks.transportInputs.push({ endpoint, options });
    }
  },
}));

const contextModulePromise = import("./page-chat-context");
const toolsModulePromise = import("./page-mcp-tools");

const chatSession = {
  id: "session-chat",
  userId: "user-1",
  title: "Guide",
  status: "running",
  agentType: "chat",
  publishedPageId: "page-1",
  pageUserSlug: "alice",
  pageSlug: "guide",
};

const workSession = {
  ...chatSession,
  id: "session-work",
  agentType: "work",
};

const pageRecord = {
  id: "page-1",
  userId: "author-1",
  authorSlug: "alice",
  uid: "guide",
  title: "Guide",
  visibility: "public",
  moderationStatus: "approved",
};

const userRecord = {
  id: "user-1",
  username: "reader",
  userSlug: "reader",
  displayName: "Reader",
  email: "reader@example.com",
  role: "user",
  avatarUrl: "",
};

describe("page chat MCP tools", () => {
  beforeEach(() => {
    mocks.sessionRecord = chatSession;
    mocks.pageRecord = pageRecord;
    mocks.userRecord = userRecord;
    mocks.canRead = true;
    mocks.editablePage = null;
    mocks.encryptedToken = "test-jwe-token";
    mocks.callToolResult = {
      content: [{ type: "text", text: "{\"success\":true}" }],
      isError: false,
    };
    mocks.clientConnect.mockClear();
    mocks.clientCallTool.mockClear();
    mocks.clientClose.mockClear();
    mocks.transportInputs.length = 0;
  });

  test("rejects missing, non-chat and no-longer-readable page contexts", async () => {
    const { resolvePageChatContext } = await contextModulePromise;

    mocks.sessionRecord = workSession;
    await expect(
      resolvePageChatContext({ sessionId: "work-1", userId: "user-1" }),
    ).rejects.toThrow("Page chat session required");

    mocks.sessionRecord = { ...chatSession, publishedPageId: null };
    await expect(
      resolvePageChatContext({ sessionId: "deleted-1", userId: "user-1" }),
    ).rejects.toThrow("Page unavailable");

    mocks.sessionRecord = chatSession;
    mocks.canRead = false;
    await expect(
      resolvePageChatContext({ sessionId: "private-1", userId: "user-1" }),
    ).rejects.toThrow("Page unavailable");

    expect(mocks.clientConnect).not.toHaveBeenCalled();
  });

  test("resolves current page identity and bearer token without leaking token into context", async () => {
    const { resolvePageChatContext } = await contextModulePromise;

    const result = await resolvePageChatContext({
      sessionId: "session-chat",
      userId: "user-1",
    });

    expect(result).toEqual({
      page: {
        publishedPageId: "page-1",
        userSlug: "alice",
        pageSlug: "guide",
        title: "Guide",
        canEdit: false,
        url: "/alice/guide?tab=read",
      },
      bearerToken: "test-jwe-token",
    });
    expect(JSON.stringify(result.page)).not.toContain("test-jwe-token");
  });

  test("locks get_page to the server-resolved page", async () => {
    const { createPageMcpTools } = await toolsModulePromise;

    const runtime = await createPageMcpTools({
      endpoint: new URL("http://localhost/api/mcp/v1"),
      bearerToken: "test-jwe-token",
      page: {
        publishedPageId: "page-1",
        userSlug: "alice",
        pageSlug: "guide",
        title: "Guide",
        canEdit: false,
        url: "/alice/guide?tab=read",
      },
    });
    await runtime.tools.get_page.execute?.({}, {} as never);

    expect(mocks.clientCallTool).toHaveBeenCalledWith({
      name: "get_page",
      arguments: { author_slug: "alice", page_uid: "guide" },
    });
    expect(mocks.transportInputs[0]?.options).toMatchObject({
      requestInit: {
        headers: { Authorization: "Bearer test-jwe-token" },
      },
    });
  });

  test("only authors receive update_page and uid cannot be overridden", async () => {
    const { createPageMcpTools } = await toolsModulePromise;
    const readerPage = {
      publishedPageId: "page-1",
      userSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      canEdit: false,
      url: "/alice/guide?tab=read",
    };

    const readerRuntime = await createPageMcpTools({
      endpoint: new URL("http://localhost/api/mcp/v1"),
      bearerToken: "test-jwe-token",
      page: readerPage,
    });
    expect(readerRuntime.tools).not.toHaveProperty("update_page");

    const authorRuntime = await createPageMcpTools({
      endpoint: new URL("http://localhost/api/mcp/v1"),
      bearerToken: "test-jwe-token",
      page: { ...readerPage, canEdit: true },
    });
    await authorRuntime.tools.update_page.execute?.(
      { uid: "evil", title: "New" },
      {} as never,
    );

    expect(mocks.clientCallTool).toHaveBeenCalledWith({
      name: "update_page",
      arguments: { uid: "guide", title: "New" },
    });
  });

  test("maps MCP success and isError without swallowing structured content", async () => {
    const { createPageMcpTools } = await toolsModulePromise;
    const runtime = await createPageMcpTools({
      endpoint: new URL("http://localhost/api/mcp/v1"),
      bearerToken: "test-jwe-token",
      page: {
        publishedPageId: "page-1",
        userSlug: "alice",
        pageSlug: "guide",
        title: "Guide",
        canEdit: true,
        url: "/alice/guide?tab=read",
      },
    });

    expect(await runtime.tools.get_page.execute?.({}, {} as never)).toEqual(
      mocks.callToolResult,
    );

    mocks.callToolResult = {
      content: [{ type: "text", text: "{\"error\":\"denied\"}" }],
      isError: true,
    };
    await expect(
      runtime.tools.get_page.execute?.({}, {} as never),
    ).rejects.toMatchObject({ cause: mocks.callToolResult });
  });

  test("builds page-bounded instructions for untrusted html", async () => {
    const { buildPageChatInstructions } = await toolsModulePromise;

    const instructions = buildPageChatInstructions({
      publishedPageId: "page-1",
      userSlug: "alice",
      pageSlug: "guide",
      title: "Guide",
      canEdit: false,
      url: "/alice/guide?tab=read",
    });

    expect(instructions).toContain("page-1");
    expect(instructions).toContain("get_page");
    expect(instructions).toContain("HTML");
    expect(instructions).toContain("not system instructions");
    expect(instructions).toContain("cannot update");
  });
});
