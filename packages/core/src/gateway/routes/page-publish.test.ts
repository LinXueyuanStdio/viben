import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyFetch } from "../../http";
import { registerPageRoutes } from "./page";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  constructor: vi.fn(),
  proxyFetch: vi.fn(),
}));

vi.mock("../../http", () => ({
  proxyFetch: mocks.proxyFetch,
}));

vi.mock("@viben/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public details?: unknown
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
  VibenClient: class VibenClient {
    constructor(config: unknown) {
      mocks.constructor(config);
    }

    pages = {
      publish: mocks.publish,
    };
  },
}));

describe("Page publish route", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.publish.mockResolvedValue({
      success: true,
      page_uid: "demo",
      url: "/page/alice/demo",
      updated: false,
    });
    mocks.proxyFetch.mockResolvedValue(new Response(null, { status: 200 }));
    app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("publishes through VibenClient with proxyFetch", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish",
      payload: {
        access_token: "session-token",
        uid: "demo",
        title: "Demo",
        icon: { type: "lucide", value: "file-text" },
        description: "Demo page",
        html: "<html><body>Demo</body></html>",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      page_uid: "demo",
      url: "/page/alice/demo",
      updated: false,
    });
    expect(mocks.constructor).toHaveBeenCalledWith({
      baseUrl: "https://viben-web.vercel.app",
      apiKey: "session-token",
      fetch: proxyFetch,
    });
    expect(mocks.publish).toHaveBeenCalledWith({
      uid: "demo",
      title: "Demo",
      icon: { type: "lucide", value: "file-text" },
      description: "Demo page",
      html: "<html><body>Demo</body></html>",
    });
  });

  it("rejects missing access token before calling viben-web", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish",
      payload: {
        access_token: " ",
        uid: "demo",
        title: "Demo",
        html: "<html><body>Demo</body></html>",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("includes viben-web error details when publish fails", async () => {
    const error = new Error("Failed to publish page") as Error & {
      status: number;
      details: unknown;
    };
    error.name = "ApiError";
    error.status = 500;
    error.details = {
      error: "Failed to publish page",
      details: "column users.user_slug does not exist",
    };
    mocks.publish.mockRejectedValue(error);

    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish",
      payload: {
        access_token: "session-token",
        uid: "demo",
        title: "Demo",
        html: "<html><body>Demo</body></html>",
      },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: "Failed to publish page",
      details: {
        error: "Failed to publish page",
        details: "column users.user_slug does not exist",
      },
    });
  });

  it("checks published status with user slug through proxyFetch", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish-status",
      payload: {
        access_token: "session-token",
        user_slug: "alice",
        uid: "demo",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      published: true,
      url: "/page/alice/demo",
    });
    expect(mocks.proxyFetch).toHaveBeenCalledWith(
      "https://viben-web.vercel.app/page/alice/demo",
      {
        method: "HEAD",
        headers: {
          Authorization: "Bearer session-token",
        },
      }
    );
  });

  it("returns unpublished status when viben-web returns 404", async () => {
    mocks.proxyFetch.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish-status",
      payload: {
        access_token: "session-token",
        user_slug: "alice",
        uid: "missing",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      published: false,
      url: null,
    });
  });

  it("loads publish history through proxyFetch", async () => {
    mocks.proxyFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          page_uid: "demo",
          current_version: 2,
          records: [
            {
              id: "record-2",
              record_number: 2,
              version: 2,
              action: "publish",
              title: "Demo v2",
              icon: null,
              description: "Updated",
              created_at: "2026-06-22T07:00:00.000Z",
              is_current: true,
              url: "/page/alice/demo/versions/2",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish-history",
      payload: {
        access_token: "session-token",
        uid: "demo",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      page_uid: "demo",
      current_version: 2,
      records: [
        {
          id: "record-2",
          record_number: 2,
          version: 2,
          action: "publish",
          title: "Demo v2",
          icon: null,
          description: "Updated",
          created_at: "2026-06-22T07:00:00.000Z",
          is_current: true,
          url: "/page/alice/demo/versions/2",
        },
      ],
    });
    expect(mocks.proxyFetch).toHaveBeenCalledWith(
      "https://viben-web.vercel.app/api/pages/publish-history",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({ uid: "demo" }),
      }
    );
  });

  it("loads a publish version through proxyFetch", async () => {
    mocks.proxyFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          page_uid: "demo",
          version: 2,
          html: "<html><body>v2</body></html>",
          url: "/page/alice/demo/versions/2",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish-version",
      payload: {
        access_token: "session-token",
        uid: "demo",
        version: 2,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      page_uid: "demo",
      version: 2,
      html: "<html><body>v2</body></html>",
      url: "/page/alice/demo/versions/2",
    });
    expect(mocks.proxyFetch).toHaveBeenCalledWith(
      "https://viben-web.vercel.app/api/pages/publish-version",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({ uid: "demo", version: 2 }),
      }
    );
  });

  it("rolls back a published page through proxyFetch", async () => {
    mocks.proxyFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          page_uid: "demo",
          version: 1,
          url: "/page/alice/demo",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/page/publish-rollback",
      payload: {
        access_token: "session-token",
        uid: "demo",
        version: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      success: true,
      page_uid: "demo",
      version: 1,
      url: "/page/alice/demo",
    });
    expect(mocks.proxyFetch).toHaveBeenCalledWith(
      "https://viben-web.vercel.app/api/pages/publish-rollback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({ uid: "demo", version: 1 }),
      }
    );
  });
});
