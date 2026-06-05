import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerPageRoutes } from "./page";

describe("Page SDK asset routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves the page SDK JavaScript", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/page/_sdk/v1/viben-page-sdk.js",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/javascript");
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.body).toContain("window.VibenPage");
  });

  it("serves the page token CSS", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/page/_sdk/v1/viben-page-tokens.css",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/css");
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.body).toContain("Viben Page Design Tokens");
    expect(response.body).toContain("--background");
  });
});
