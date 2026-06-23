import { describe, expect, it } from "vitest";
import {
  createGateway,
  resetCleanupStaleAcpSessionsForTests,
  setCleanupStaleAcpSessionsForTests,
} from "./index";
import { acpSessionManager } from "../acp";

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

  it("runs stale ACP session cleanup during gateway creation", async () => {
    const calls: unknown[] = [];
    setCleanupStaleAcpSessionsForTests(async (storage) => {
      calls.push(storage);
    });

    const app = await createGateway({
      host: "127.0.0.1",
      port: 0,
      cors: false,
      telemetry: false,
      runtime: false,
    });

    try {
      expect(calls).toEqual([acpSessionManager.storage]);
    } finally {
      resetCleanupStaleAcpSessionsForTests();
      await app.close();
    }
  });

  it("does not block gateway creation when stale ACP session cleanup fails", async () => {
    setCleanupStaleAcpSessionsForTests(async () => {
      throw new Error("cleanup failed");
    });

    const app = await createGateway({
      host: "127.0.0.1",
      port: 0,
      cors: false,
      telemetry: false,
      runtime: false,
    });

    try {
      await app.ready();
      expect(app.server.listening).toBe(false);
    } finally {
      resetCleanupStaleAcpSessionsForTests();
      await app.close();
    }
  });
});
