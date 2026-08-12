import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentSession: {
    user: {
      id: "user-1",
      username: "reader",
      name: "Reader",
      email: "reader@example.com",
      avatar: "",
    },
  } as {
    user: {
      id: string;
      username: string;
      name?: string;
      email?: string;
      avatar: string;
    };
  } | null,
  sessionRecord: null as Record<string, any> | null,
  pageRecord: null as Record<string, any> | null,
  canRead: true,
  canReadPage: vi.fn(() => true),
}));

vi.mock("@/lib/session/get-server-session", () => ({
  getServerSession: async () => mocks.currentSession,
}));

vi.mock("@/lib/services/community", () => ({
  canReadPage: mocks.canReadPage,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      sessions: {
        findFirst: async () => mocks.sessionRecord,
      },
      publishedPages: {
        findFirst: async () => mocks.pageRecord,
      },
    },
  },
}));

const routeModulePromise = import("./route");

function request() {
  return new Request("http://localhost/api/page-sessions/session-1/preview");
}

function context(sessionId = "session-1") {
  return {
    params: Promise.resolve({ sessionId }),
  };
}

async function responseJson(response: Response) {
  return response.json();
}

function makePageSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    title: "Snapshot title",
    agentType: "chat",
    publishedPageId: "page-1",
    pageUserSlug: "alice-old",
    pageSlug: "guide-old",
    ...overrides,
  };
}

function makePage(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    userId: "author-1",
    uid: "guide-new",
    authorSlug: "alice-new",
    title: "Latest guide",
    html: "<main>latest</main>",
    visibility: "public",
    moderationStatus: "approved",
    ...overrides,
  };
}

describe("GET /api/page-sessions/[sessionId]/preview", () => {
  beforeEach(() => {
    mocks.currentSession = {
      user: {
        id: "user-1",
        username: "reader",
        name: "Reader",
        email: "reader@example.com",
        avatar: "",
      },
    };
    mocks.sessionRecord = makePageSession();
    mocks.pageRecord = makePage();
    mocks.canRead = true;
    mocks.canReadPage.mockImplementation(() => mocks.canRead);
    mocks.canReadPage.mockClear();
  });

  test("requires login and owned chat session", async () => {
    const { GET } = await routeModulePromise;

    mocks.currentSession = null;
    expect((await GET(request(), context())).status).toBe(401);

    mocks.currentSession = {
      user: {
        id: "other-user",
        username: "other",
        avatar: "",
      },
    };
    mocks.sessionRecord = null;
    expect((await GET(request(), context())).status).toBe(404);
  });

  test("rejects work sessions", async () => {
    const { GET } = await routeModulePromise;
    mocks.sessionRecord = makePageSession({ agentType: "work" });

    const response = await GET(request(), context());

    expect(response.status).toBe(400);
    await expect(responseJson(response)).resolves.toEqual({
      error: "Page chat session required",
    });
  });

  test("re-checks current page permission by published_page_id", async () => {
    const { GET } = await routeModulePromise;
    mocks.canRead = false;

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    await expect(responseJson(response)).resolves.not.toHaveProperty("html");
    expect(mocks.canReadPage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "page-1" }),
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  test("returns current slugs and latest html instead of snapshots", async () => {
    const { GET } = await routeModulePromise;

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(responseJson(response)).resolves.toEqual(
      expect.objectContaining({
        published_page_id: "page-1",
        user_slug: "alice-new",
        page_slug: "guide-new",
        title: "Latest guide",
        html: "<main>latest</main>",
        url: "/alice-new/guide-new?tab=read",
      }),
    );
  });
});
