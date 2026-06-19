import { describe, expect, it } from "vitest";
import { createGateway } from "./index";

describe("Gateway OpenAPI export", () => {
  it("excludes bundled MCP server routes from the OpenAPI document", async () => {
    const app = await createGateway({
      host: "127.0.0.1",
      port: 0,
      cors: false,
      telemetry: false,
      runtime: false,
    });

    try {
      await app.ready();

      const document = app.swagger();
      expect(Object.keys(document.paths ?? {}).some((path) => path.startsWith("/api/mcp-server/"))).toBe(false);
      expect(Object.keys(document.paths ?? {}).some((path) => path.startsWith("/api/python-mcp/"))).toBe(false);
      expect(document.paths?.["/health"]).toBeDefined();
    } finally {
      await app.close();
    }
  });
});
