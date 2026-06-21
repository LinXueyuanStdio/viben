import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyFetch } from "../../http";
import { registerPageRoutes } from "./page";

const mocks = vi.hoisted(() => ({
  publish: vi.fn(),
  constructor: vi.fn(),
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
      url: "/page/user-1/demo",
      updated: false,
    });
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
      url: "/page/user-1/demo",
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
});
