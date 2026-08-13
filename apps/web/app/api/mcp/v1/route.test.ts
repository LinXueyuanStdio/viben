import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tools = new Map<string, (args: Record<string, unknown>, extra?: Record<string, unknown>) => unknown>();
  const requestHandlers = new Map<string, (request: Record<string, unknown>, extra?: Record<string, unknown>) => unknown>();
  return {
    tools,
    requestHandlers,
    authUserId: "user-1" as string | null,
    canReadPage: true,
    isPublicPage: true,
    sentNotifications: [] as Record<string, unknown>[],
    sendNotification: vi.fn(async (notification: Record<string, unknown>) => {
      mocks.sentNotifications.push(notification);
    }),
    revalidateTag: vi.fn(),
    recordPageUpdateAndNotify: vi.fn(async () => undefined),
    ensurePublishedPagesTable: vi.fn(async () => undefined),
    user: {
      id: "user-1",
      username: "alice",
      userSlug: "alice",
      email: "alice@example.com",
      role: "user",
    },
    existingPage: {
      id: "page-1",
      uid: "guide",
      userId: "user-1",
      title: "Guide",
      html: "<main>old</main>",
      description: "Old",
      tags: ["docs"],
      visibility: "public",
      coverUrl: null,
    },
    latestVersion: { version: 1 },
    latestRecord: { recordNumber: 1 },
    updatedPage: null as Record<string, unknown> | null,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("mcp-handler", () => ({
  createMcpHandler: (register: (server: unknown) => void) => {
    register({
      tool: (
        name: string,
        _description: string,
        _schema: unknown,
        execute: (args: Record<string, unknown>, extra?: Record<string, unknown>) => unknown,
      ) => {
        mocks.tools.set(name, execute);
      },
      server: {
        setRequestHandler: (
          schema: { shape?: { method?: { value?: string } } },
          handler: (request: Record<string, unknown>) => unknown,
        ) => {
          const method = schema.shape?.method?.value;
          if (typeof method === "string") {
            mocks.requestHandlers.set(method, handler);
          }
        },
        sendResourceUpdated: vi.fn(async (params: Record<string, unknown>) => {
          await mocks.sendNotification({
            method: "notifications/resources/updated",
            params,
          });
        }),
      },
    });

    return async (request: Request) => {
      const body = await request.json();
      const execute = mocks.tools.get(body.tool);
      if (!execute) {
        return Response.json({ error: "unknown tool" }, { status: 404 });
      }
      return Response.json(
        await execute(body.args ?? {}, { sendNotification: mocks.sendNotification }),
      );
    };
  },
  metadataCorsOptionsRequestHandler: () => () => new Response(null),
  protectedResourceHandler: () => () => new Response(null),
  withMcpAuth:
    (handler: (request: Request) => Promise<Response>) => async (
      request: Request,
    ) => {
      if (mocks.authUserId) {
        Object.assign(request, { auth: { userId: mocks.authUserId } });
      }
      return handler(request);
    },
}));

vi.mock("@/lib/db/published-pages", () => ({
  ensurePublishedPagesTable: mocks.ensurePublishedPagesTable,
}));

vi.mock("@/lib/auth/api-key", () => ({
  validateApiKey: vi.fn(),
}));

vi.mock("@/lib/auth/jwe", () => ({
  decryptSession: vi.fn(),
}));

vi.mock("@/lib/auth/oauth", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("@/lib/services/community", () => ({
  recordPageUpdateAndNotify: mocks.recordPageUpdateAndNotify,
  canReadPage: () => mocks.canReadPage,
  isPublicPage: () => mocks.isPublicPage,
}));

function insertBuilder() {
  return {
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(async () => undefined),
    })),
  };
}

const dbMock = {
  query: {
    users: {
      findFirst: vi.fn(async () => mocks.user),
    },
    publishedPages: {
      findFirst: vi.fn(async () => mocks.updatedPage ?? mocks.existingPage),
    },
    publishedPageVersions: {
      findFirst: vi.fn(async () => mocks.latestVersion),
    },
    publishedPageRecords: {
      findFirst: vi.fn(async () => mocks.latestRecord),
    },
  },
  insert: vi.fn(() => insertBuilder()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  })),
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
  publishedPages: {
    id: "publishedPages.id",
    uid: "publishedPages.uid",
    userId: "publishedPages.userId",
    title: "publishedPages.title",
    html: "publishedPages.html",
    description: "publishedPages.description",
    tags: "publishedPages.tags",
    visibility: "publishedPages.visibility",
    moderationStatus: "publishedPages.moderationStatus",
    authorSlug: "publishedPages.authorSlug",
    coverUrl: "publishedPages.coverUrl",
    publishedAt: "publishedPages.publishedAt",
    lastPublishedAt: "publishedPages.lastPublishedAt",
    currentVersion: "publishedPages.currentVersion",
    versionCount: "publishedPages.versionCount",
    updatedAt: "publishedPages.updatedAt",
  },
  publishedPageVersions: {
    userId: "publishedPageVersions.userId",
    uid: "publishedPageVersions.uid",
    version: "publishedPageVersions.version",
  },
  publishedPageRecords: {
    userId: "publishedPageRecords.userId",
    uid: "publishedPageRecords.uid",
    recordNumber: "publishedPageRecords.recordNumber",
  },
  users: {
    id: "users.id",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
  desc: (value: unknown) => ({ type: "desc", value }),
  asc: (value: unknown) => ({ type: "asc", value }),
  sql: vi.fn(() => ({ type: "sql" })),
}));

const routeModulePromise = import("./route");

function toolRequest(tool: string, args: Record<string, unknown>) {
  return new Request("http://localhost/api/mcp/v1", {
    method: "POST",
    body: JSON.stringify({ tool, args }),
  });
}

describe("/api/mcp/v1 page cache invalidation", () => {
  beforeEach(() => {
    mocks.revalidateTag.mockClear();
    mocks.recordPageUpdateAndNotify.mockClear();
    mocks.ensurePublishedPagesTable.mockClear();
    mocks.sendNotification.mockClear();
    mocks.sentNotifications.length = 0;
    mocks.authUserId = "user-1";
    mocks.canReadPage = true;
    mocks.isPublicPage = true;
    mocks.updatedPage = null;
    dbMock.query.publishedPages.findFirst.mockClear();
    dbMock.insert.mockClear();
    dbMock.update.mockClear();
  });

  test("update_page invalidates all current page cache tags", async () => {
    const { POST } = await routeModulePromise;

    await POST(
      toolRequest("update_page", {
        uid: "guide",
        html: "<main>latest</main>",
      }),
    );

    expect(mocks.revalidateTag).toHaveBeenCalledWith("page-ctx-alice-guide");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("page-entity-page-1");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("profile-alice");
  });

  test("create_page invalidates all current page cache tags after upsert", async () => {
    const { POST } = await routeModulePromise;
    mocks.updatedPage = { ...mocks.existingPage, id: "page-2", uid: "new-guide" };

    await POST(
      toolRequest("create_page", {
        uid: "new-guide",
        title: "New guide",
        html: "<main>new</main>",
      }),
    );

    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      "page-ctx-alice-new-guide",
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith("page-entity-page-2");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("profile-alice");
  });

  test("anonymous get_page only reads public approved pages", async () => {
    const { POST } = await routeModulePromise;

    mocks.authUserId = null;
    mocks.isPublicPage = false;
    mocks.existingPage = {
      ...mocks.existingPage,
      visibility: "private",
      moderationStatus: "approved",
    };

    const denied = await POST(toolRequest("get_page", {
      author_slug: "alice",
      page_uid: "guide",
    }));
    await expect(denied.json()).resolves.toMatchObject({ isError: true });

    mocks.isPublicPage = true;
    mocks.existingPage = {
      ...mocks.existingPage,
      visibility: "public",
      moderationStatus: "approved",
    };

    const allowed = await POST(toolRequest("get_page", {
      author_slug: "alice",
      page_uid: "guide",
    }));
    const body = await allowed.json();
    expect(body.isError).not.toBe(true);
    expect(body.content[0].text).toContain("\"html\":\"<main>old</main>\"");
  });

  test("authenticated get_page uses canReadPage", async () => {
    const { POST } = await routeModulePromise;

    mocks.authUserId = "user-1";
    mocks.canReadPage = false;

    const denied = await POST(toolRequest("get_page", {
      author_slug: "alice",
      page_uid: "guide",
    }));
    await expect(denied.json()).resolves.toMatchObject({ isError: true });

    mocks.canReadPage = true;
    const allowed = await POST(toolRequest("get_page", {
      author_slug: "alice",
      page_uid: "guide",
    }));
    const body = await allowed.json();
    expect(body.isError).not.toBe(true);
  });

  test("update_page emits resource updated notification for page content URI", async () => {
    const { POST } = await routeModulePromise;

    await POST(toolRequest("update_page", {
      uid: "guide",
      html: "<main>latest</main>",
    }));

    expect(mocks.sendNotification).toHaveBeenCalledWith({
      method: "notifications/resources/updated",
      params: { uri: "viben://api/pages/page-1/content" },
    });
  });
});
