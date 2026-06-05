/**
 * Client-Tools Routes Integration Tests
 *
 * Tests the full chain: enqueue → waitForClient → HTTP POST complete → promise resolves
 * All in the same process so the registry singleton is shared.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { registerClientToolRoutes } from "./client-tools";
import {
  clientToolCompletionRegistry,
  ClientToolCancelledError,
} from "../../services/client-tool-completion";

describe("Client-Tools Routes", () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    registerClientToolRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    clientToolCompletionRegistry.destroy();
  });

  describe("POST /api/client-tools/complete", () => {
    it("should return 400 for missing fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/client-tools/complete",
        payload: { tool_use_id: "x" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Missing required fields");
    });

    it("should return 404 for unregistered tool_use_id", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/client-tools/complete",
        payload: {
          tool_use_id: "nonexist",
          session_id: "s1",
          result: { content: [{ type: "text", text: "hi" }], isError: false },
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it("should return 404 for session mismatch", async () => {
      const sessionId = "session-" + Date.now();
      const toolUseId = "tool-" + Date.now();
      clientToolCompletionRegistry.enqueue(sessionId, toolUseId, "GUI_execute");

      const res = await app.inject({
        method: "POST",
        url: "/api/client-tools/complete",
        payload: {
          tool_use_id: toolUseId,
          session_id: "wrong-session",
          result: { content: [{ type: "text", text: "x" }], isError: false },
        },
      });
      expect(res.statusCode).toBe(404);

      // Cleanup
      clientToolCompletionRegistry.cancelSession(sessionId);
    });

    it("should resolve waitForClient when POST completes (normal flow)", async () => {
      const sessionId = "session-normal-" + Date.now();
      const toolUseId = "tool-normal-" + Date.now();

      // 1. Enqueue (simulates stream loop)
      clientToolCompletionRegistry.enqueue(sessionId, toolUseId, "GUI_execute");

      // 2. waitForClient (simulates MCP handler)
      const waitPromise = clientToolCompletionRegistry.waitForClient(sessionId);

      // 3. POST complete (simulates frontend)
      const res = await app.inject({
        method: "POST",
        url: "/api/client-tools/complete",
        payload: {
          tool_use_id: toolUseId,
          session_id: sessionId,
          result: {
            content: [{ type: "text", text: "Drew 3 arrows" }],
            isError: false,
          },
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // 4. waitForClient should resolve with the result
      const result = await waitPromise;
      expect(result.content[0]).toEqual({ type: "text", text: "Drew 3 arrows" });
      expect(result.isError).toBe(false);
    });

    it("should work when waitForClient is called BEFORE enqueue (reverse order)", async () => {
      const sessionId = "session-rev-" + Date.now();
      const toolUseId = "tool-rev-" + Date.now();

      // 1. waitForClient FIRST (before enqueue)
      const waitPromise = clientToolCompletionRegistry.waitForClient(
        sessionId,
        toolUseId,
        "GUI_execute"
      );

      // 2. Enqueue AFTER (simulates stream loop arriving late)
      clientToolCompletionRegistry.enqueue(sessionId, toolUseId, "GUI_execute");

      // 3. POST complete
      const res = await app.inject({
        method: "POST",
        url: "/api/client-tools/complete",
        payload: {
          tool_use_id: toolUseId,
          session_id: sessionId,
          result: {
            content: [{ type: "text", text: "Highlighted region" }],
            isError: false,
          },
        },
      });
      expect(res.statusCode).toBe(200);

      // 4. Should resolve correctly
      const result = await waitPromise;
      expect(result.content[0]).toEqual({ type: "text", text: "Highlighted region" });
    });

    it("should reject waitForClient when session is cancelled", async () => {
      const sessionId = "session-cancel-" + Date.now();
      const toolUseId = "tool-cancel-" + Date.now();

      clientToolCompletionRegistry.enqueue(sessionId, toolUseId, "GUI_execute");
      const waitPromise = clientToolCompletionRegistry.waitForClient(sessionId);

      // Cancel session (simulates user stopping agent)
      clientToolCompletionRegistry.cancelSession(sessionId);

      await expect(waitPromise).rejects.toThrow(ClientToolCancelledError);
    });

    it("should handle isError result from frontend", async () => {
      const sessionId = "session-err-" + Date.now();
      const toolUseId = "tool-err-" + Date.now();

      clientToolCompletionRegistry.enqueue(sessionId, toolUseId, "GUI_execute");
      const waitPromise = clientToolCompletionRegistry.waitForClient(sessionId);

      const res = await app.inject({
        method: "POST",
        url: "/api/client-tools/complete",
        payload: {
          tool_use_id: toolUseId,
          session_id: sessionId,
          result: {
            content: [{ type: "text", text: "User cancelled GUI action" }],
            isError: true,
          },
        },
      });
      expect(res.statusCode).toBe(200);

      const result = await waitPromise;
      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({ type: "text", text: "User cancelled GUI action" });
    });
  });
});
