/**
 * Client Tool Completion Registry Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ClientToolCompletionRegistry,
  ClientToolCancelledError,
  ClientToolTimeoutError,
  GLOBAL_MAX_TIMEOUT_MS,
  defaultTimeoutResult,
} from "./client-tool-completion";

describe("ClientToolCompletionRegistry", () => {
  let registry: ClientToolCompletionRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new ClientToolCompletionRegistry();
  });

  afterEach(() => {
    registry.destroy();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // registerToolOptions / isClientSideTool
  // ---------------------------------------------------------------------------

  describe("registerToolOptions", () => {
    it("should register a tool with default options", () => {
      registry.registerToolOptions("screenshot");
      expect(registry.isClientSideTool("screenshot")).toBe(true);
    });

    it("should register a tool with custom timeout", () => {
      registry.registerToolOptions("screenshot", { timeoutMs: 30000 });
      expect(registry.isClientSideTool("screenshot")).toBe(true);
    });
  });

  describe("isClientSideTool", () => {
    beforeEach(() => {
      registry.registerToolOptions("screenshot");
      registry.registerToolOptions("user_confirm");
    });

    it("should return true for directly registered tools", () => {
      expect(registry.isClientSideTool("screenshot")).toBe(true);
      expect(registry.isClientSideTool("user_confirm")).toBe(true);
    });

    it("should return false for unregistered tools", () => {
      expect(registry.isClientSideTool("read_file")).toBe(false);
      expect(registry.isClientSideTool("write_file")).toBe(false);
    });

    it("should trust only known built-in MCP server prefixes", () => {
      registry.registerToolOptions("GUI_execute");

      expect(registry.isClientSideTool("mcp__client_side__GUI_execute")).toBe(true);
      expect(registry.isClientSideTool("mcp__gui_action__GUI_execute")).toBe(false);
      expect(registry.isClientSideTool("mcp__myserver__screenshot")).toBe(false);
    });

    it("should trust the built-in ClientSideBash MCP server prefix", () => {
      registry.registerToolOptions("ClientSideBash");

      expect(registry.isClientSideTool("mcp__client_side__ClientSideBash")).toBe(true);
      expect(registry.isClientSideTool("mcp__client_side_bash__ClientSideBash")).toBe(false);
      expect(registry.isClientSideTool("mcp__other__ClientSideBash")).toBe(false);
    });

    it("should return false for mcp__ prefixed tools with unregistered suffix", () => {
      expect(registry.isClientSideTool("mcp__client_side__read_file")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // enqueue / waitForClient / complete
  // ---------------------------------------------------------------------------

  describe("enqueue", () => {
    it("should add a tool use to the session queue", () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      expect(registry.getQueueLength("session-1")).toBe(1);
      expect(registry.isPending("tool-use-1")).toBe(true);
    });

    it("should support multiple enqueues for the same session (FIFO)", () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-1", "tool-use-2", "screenshot");

      expect(registry.getQueueLength("session-1")).toBe(2);
      expect(registry.pendingCount).toBe(2);
    });
  });

  describe("waitForClient", () => {
    it("should wait for the next queued item when session has no queued items", async () => {
      const promise = registry.waitForClient("session-1");
      expect(registry.getWaiterCount("session-1")).toBe(1);

      const callToolResult: CallToolResult = {
        content: [{ type: "text", text: "done" }],
      };
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.complete("tool-use-1", "session-1", callToolResult);

      await expect(promise).resolves.toEqual(callToolResult);
      expect(registry.getWaiterCount("session-1")).toBe(0);
    });

    it("should wait for the next queued item after an existing queue is consumed", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      // Consume the one item
      const promise = registry.waitForClient("session-1");
      const callToolResult: CallToolResult = {
        content: [{ type: "text", text: "done" }],
      };
      registry.complete("tool-use-1", "session-1", callToolResult);
      await promise;

      const secondPromise = registry.waitForClient("session-1");
      expect(registry.getWaiterCount("session-1")).toBe(1);

      const secondResult: CallToolResult = {
        content: [{ type: "text", text: "done-2" }],
      };
      registry.enqueue("session-1", "tool-use-2", "screenshot");
      registry.complete("tool-use-2", "session-1", secondResult);

      await expect(secondPromise).resolves.toEqual(secondResult);
      expect(registry.getWaiterCount("session-1")).toBe(0);
    });

    it("should dequeue items in FIFO order", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-1", "tool-use-2", "screenshot");

      // First wait gets tool-use-1
      const p1 = registry.waitForClient("session-1");
      expect(registry.getQueueLength("session-1")).toBe(1);

      const result1: CallToolResult = { content: [{ type: "text", text: "result-1" }] };
      registry.complete("tool-use-1", "session-1", result1);
      expect(await p1).toEqual(result1);

      // Second wait gets tool-use-2
      const p2 = registry.waitForClient("session-1");
      expect(registry.getQueueLength("session-1")).toBe(0);

      const result2: CallToolResult = { content: [{ type: "text", text: "result-2" }] };
      registry.complete("tool-use-2", "session-1", result2);
      expect(await p2).toEqual(result2);
    });

    it("should dequeue the next matching tool when a toolName is provided", async () => {
      registry.registerToolOptions("GUI_execute");
      registry.registerToolOptions("ClientSideBash");
      registry.enqueue("session-1", "tool-use-gui", "GUI_execute");
      registry.enqueue("session-1", "tool-use-bash", "ClientSideBash");

      const bashPromise = registry.waitForClient("session-1", undefined, "ClientSideBash");
      expect(registry.getQueueLength("session-1")).toBe(1);

      const bashResult: CallToolResult = { content: [{ type: "text", text: "bash" }] };
      registry.complete("tool-use-bash", "session-1", bashResult);

      await expect(bashPromise).resolves.toEqual(bashResult);

      const guiPromise = registry.waitForClient("session-1", undefined, "GUI_execute");
      const guiResult: CallToolResult = { content: [{ type: "text", text: "gui" }] };
      registry.complete("tool-use-gui", "session-1", guiResult);

      await expect(guiPromise).resolves.toEqual(guiResult);
    });

    it("should match a prefixed queued GUI tool with an unprefixed waiter", async () => {
      registry.registerToolOptions("GUI_execute");
      registry.enqueue("session-1", "tool-use-gui", "mcp__client_side__GUI_execute");

      const promise = registry.waitForClient("session-1", undefined, "GUI_execute");
      const result: CallToolResult = { content: [{ type: "text", text: "gui" }] };
      registry.complete("tool-use-gui", "session-1", result);

      await expect(promise).resolves.toEqual(result);
      expect(registry.pendingCount).toBe(0);
    });

    it("should match an unprefixed waiter when the prefixed GUI tool is enqueued later", async () => {
      registry.registerToolOptions("GUI_execute");
      const promise = registry.waitForClient("session-1", undefined, "GUI_execute");
      expect(registry.getWaiterCount("session-1")).toBe(1);

      registry.enqueue("session-1", "tool-use-gui", "mcp__client_side__GUI_execute");
      const result: CallToolResult = { content: [{ type: "text", text: "gui-late" }] };
      registry.complete("tool-use-gui", "session-1", result);

      await expect(promise).resolves.toEqual(result);
      expect(registry.getWaiterCount("session-1")).toBe(0);
    });

    it("should match a prefixed queued ClientSideBash tool with an unprefixed waiter", async () => {
      registry.registerToolOptions("ClientSideBash");
      registry.enqueue("session-1", "tool-use-bash", "mcp__client_side__ClientSideBash");

      const promise = registry.waitForClient("session-1", undefined, "ClientSideBash");
      const result: CallToolResult = { content: [{ type: "text", text: "bash" }] };
      registry.complete("tool-use-bash", "session-1", result);

      await expect(promise).resolves.toEqual(result);
      expect(registry.pendingCount).toBe(0);
    });

    it("should resolve when complete is called", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      const callToolResult: CallToolResult = {
        content: [{ type: "text", text: "screenshot captured" }],
      };

      registry.complete("tool-use-1", "session-1", callToolResult);

      const result = await promise;
      expect(result).toEqual(callToolResult);
      expect(registry.pendingCount).toBe(0);
    });

    it("should resolve with fallback CallToolResult on timeout with GLOBAL_MAX_TIMEOUT_MS", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      // Advance time past the global timeout
      vi.advanceTimersByTime(GLOBAL_MAX_TIMEOUT_MS + 1);

      const result = await promise;
      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: "text",
        text: `Client-side tool "screenshot" timed out after ${Math.round(GLOBAL_MAX_TIMEOUT_MS / 1000)}s. The client may be unresponsive. You may retry or skip this step.`,
      });
      expect(registry.pendingCount).toBe(0);
    });

    it("should resolve with fallback CallToolResult on tool-specific timeout", async () => {
      registry.registerToolOptions("screenshot", { timeoutMs: 5000 });
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      vi.advanceTimersByTime(5001);

      const result = await promise;
      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: "text",
        text: `Client-side tool "screenshot" timed out after 5s. The client may be unresponsive. You may retry or skip this step.`,
      });
    });

    it("should use GLOBAL_MAX_TIMEOUT_MS when timeoutMs is 0", async () => {
      registry.registerToolOptions("screenshot", { timeoutMs: 0 });
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      // Should NOT timeout before global max
      vi.advanceTimersByTime(GLOBAL_MAX_TIMEOUT_MS - 1);
      // Promise should still be pending (we can't easily check this, but it shouldn't resolve with error)

      // Now advance past
      vi.advanceTimersByTime(2);

      const result = await promise;
      expect(result.isError).toBe(true);
      expect(result.content[0]).toHaveProperty("type", "text");
    });

    it("should cap tool timeout at GLOBAL_MAX_TIMEOUT_MS", async () => {
      // Tool requests 20 minutes but global max is 10 minutes
      registry.registerToolOptions("long_tool", { timeoutMs: 20 * 60 * 1000 });
      registry.enqueue("session-1", "tool-use-1", "long_tool");

      const promise = registry.waitForClient("session-1");

      // Advance to just past GLOBAL_MAX_TIMEOUT_MS
      vi.advanceTimersByTime(GLOBAL_MAX_TIMEOUT_MS + 1);

      const result = await promise;
      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: "text",
        text: `Client-side tool "long_tool" timed out after ${Math.round(GLOBAL_MAX_TIMEOUT_MS / 1000)}s. The client may be unresponsive. You may retry or skip this step.`,
      });
    });

    it("should resolve with mcp__client_side__ prefixed tool name using registered base tool timeout", async () => {
      registry.registerToolOptions("GUI_execute", { timeoutMs: 3000 });
      registry.enqueue("session-1", "tool-use-1", "mcp__client_side__GUI_execute");

      const promise = registry.waitForClient("session-1");

      vi.advanceTimersByTime(3001);

      const result = await promise;
      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: "text",
        text: `Client-side tool "GUI_execute" timed out after 3s. The client may be unresponsive. You may retry or skip this step.`,
      });
    });

    it("should use custom onTimeout callback when provided", async () => {
      const customTimeout = vi.fn((ctx: { toolName: string; toolUseId: string; elapsedMs: number }) => ({
        content: [{ type: "text" as const, text: `Custom timeout for ${ctx.toolName}` }],
        isError: true,
      }));

      registry.registerToolOptions("screenshot", { timeoutMs: 2000, onTimeout: customTimeout });
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      vi.advanceTimersByTime(2001);

      const result = await promise;
      expect(customTimeout).toHaveBeenCalledWith({
        toolName: "screenshot",
        toolUseId: "tool-use-1",
        elapsedMs: 2000,
      });
      expect(result).toEqual({
        content: [{ type: "text", text: "Custom timeout for screenshot" }],
        isError: true,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // complete
  // ---------------------------------------------------------------------------

  describe("complete", () => {
    it("should return false if toolUseId is not found", () => {
      const result: CallToolResult = { content: [{ type: "text", text: "done" }] };
      expect(registry.complete("nonexistent", "session-1", result)).toBe(false);
    });

    it("should return false if sessionId does not match", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      // Start waiting (arms the promise)
      const promise = registry.waitForClient("session-1");

      const result: CallToolResult = { content: [{ type: "text", text: "done" }] };

      // Try to complete with wrong sessionId
      expect(registry.complete("tool-use-1", "session-WRONG", result)).toBe(false);

      // Entry should still be pending
      expect(registry.isPending("tool-use-1")).toBe(true);

      // Clean up: complete correctly to avoid dangling promise
      registry.complete("tool-use-1", "session-1", result);
      await promise;
    });

    it("should return true on successful completion", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      const result: CallToolResult = { content: [{ type: "text", text: "done" }] };
      expect(registry.complete("tool-use-1", "session-1", result)).toBe(true);

      await promise;
    });

    it("should clear the timeout on successful completion", async () => {
      registry.registerToolOptions("screenshot", { timeoutMs: 5000 });
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      const result: CallToolResult = { content: [{ type: "text", text: "done" }] };
      registry.complete("tool-use-1", "session-1", result);

      // Advance past the timeout - should NOT throw since we already resolved
      vi.advanceTimersByTime(6000);

      // Promise should have resolved successfully
      expect(await promise).toEqual(result);
    });

    it("should handle isError results", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      const result: CallToolResult = {
        content: [{ type: "text", text: "Permission denied" }],
        isError: true,
      };
      registry.complete("tool-use-1", "session-1", result);

      // Error results are still resolved (not rejected) — the tool handler
      // decides how to surface errors
      expect(await promise).toEqual(result);
    });
  });

  // ---------------------------------------------------------------------------
  // cancelSession
  // ---------------------------------------------------------------------------

  describe("cancelSession", () => {
    it("should reject all pending promises for a session", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-1", "tool-use-2", "screenshot");

      const p1 = registry.waitForClient("session-1");
      const p2 = registry.waitForClient("session-1");

      registry.cancelSession("session-1");

      await expect(p1).rejects.toThrow(ClientToolCancelledError);
      await expect(p2).rejects.toThrow(ClientToolCancelledError);
      expect(registry.pendingCount).toBe(0);
    });

    it("should clear the session queue", () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-1", "tool-use-2", "screenshot");

      // Only dequeue one — the other is still in the queue
      registry.cancelSession("session-1");

      expect(registry.getQueueLength("session-1")).toBe(0);
    });

    it("should not affect other sessions", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-2", "tool-use-2", "screenshot");

      const p1 = registry.waitForClient("session-1");
      const p2 = registry.waitForClient("session-2");

      registry.cancelSession("session-1");

      await expect(p1).rejects.toThrow(ClientToolCancelledError);

      // session-2 should still be pending
      expect(registry.isPending("tool-use-2")).toBe(true);

      // Complete session-2 normally
      const result: CallToolResult = { content: [{ type: "text", text: "ok" }] };
      registry.complete("tool-use-2", "session-2", result);
      expect(await p2).toEqual(result);
    });

    it("should be a no-op for nonexistent session", () => {
      // Should not throw
      registry.cancelSession("nonexistent");
      expect(registry.pendingCount).toBe(0);
    });

    it("should cancel entries that were enqueued but not yet waited on", () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      // Cancel before waitForClient is called
      registry.cancelSession("session-1");

      expect(registry.pendingCount).toBe(0);
      expect(registry.getQueueLength("session-1")).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // gc
  // ---------------------------------------------------------------------------

  describe("gc", () => {
    it("should clean up entries older than maxAgeMs", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      // Advance time by 5 minutes (less than global timeout so the built-in timer
      // doesn't fire)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Run GC with 4 minute max age — should clean up the entry
      const cleaned = registry.gc(4 * 60 * 1000);
      expect(cleaned).toBe(1);
      expect(registry.pendingCount).toBe(0);

      // GC still rejects with ClientToolTimeoutError (used for internal cleanup)
      await expect(promise).rejects.toThrow(ClientToolTimeoutError);
    });

    it("should not clean up entries younger than maxAgeMs", () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.waitForClient("session-1");

      // Advance just 1 second
      vi.advanceTimersByTime(1000);

      const cleaned = registry.gc(5 * 60 * 1000);
      expect(cleaned).toBe(0);
      expect(registry.pendingCount).toBe(1);
    });

    it("should return 0 when there are no pending entries", () => {
      const cleaned = registry.gc();
      expect(cleaned).toBe(0);
    });

    it("should use GLOBAL_MAX_TIMEOUT_MS as default maxAge", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      const promise = registry.waitForClient("session-1");

      // Not yet old enough for default gc
      vi.advanceTimersByTime(GLOBAL_MAX_TIMEOUT_MS - 1000);
      expect(registry.gc()).toBe(0);
      expect(registry.pendingCount).toBe(1);

      // Now advance past GLOBAL_MAX_TIMEOUT_MS — the built-in timeout resolves with fallback
      vi.advanceTimersByTime(1001);

      // The built-in timeout already cleaned it up
      expect(registry.pendingCount).toBe(0);

      // The built-in timeout resolves with a fallback CallToolResult
      const result = await promise;
      expect(result.isError).toBe(true);
    });

    it("should clean multiple old entries across sessions", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-2", "tool-use-2", "screenshot");

      const p1 = registry.waitForClient("session-1");
      const p2 = registry.waitForClient("session-2");

      vi.advanceTimersByTime(5 * 60 * 1000);

      const cleaned = registry.gc(4 * 60 * 1000);
      expect(cleaned).toBe(2);
      expect(registry.pendingCount).toBe(0);

      // GC still rejects with ClientToolTimeoutError (used for internal cleanup)
      await expect(p1).rejects.toThrow(ClientToolTimeoutError);
      await expect(p2).rejects.toThrow(ClientToolTimeoutError);
    });
  });

  // ---------------------------------------------------------------------------
  // Singleton export
  // ---------------------------------------------------------------------------

  describe("singleton", () => {
    it("should export a singleton instance", async () => {
      // Use real timers for this test since we just check the import
      vi.useRealTimers();

      const { clientToolCompletionRegistry } = await import("./client-tool-completion");
      expect(clientToolCompletionRegistry).toBeInstanceOf(ClientToolCompletionRegistry);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("should handle completing a tool before waitForClient is called", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      // Complete before waiting — the registry should retain the resolved value
      // until the MCP handler consumes this queued tool.
      const result: CallToolResult = { content: [{ type: "text", text: "early" }] };
      const accepted = registry.complete("tool-use-1", "session-1", result);
      expect(accepted).toBe(true);

      const waitResult = await registry.waitForClient("session-1");
      expect(waitResult).toEqual(result);
      expect(registry.pendingCount).toBe(0);
    });

    it("should handle concurrent waits on different sessions", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");
      registry.enqueue("session-2", "tool-use-2", "screenshot");

      const p1 = registry.waitForClient("session-1");
      const p2 = registry.waitForClient("session-2");

      const r1: CallToolResult = { content: [{ type: "text", text: "r1" }] };
      const r2: CallToolResult = { content: [{ type: "text", text: "r2" }] };

      // Complete in reverse order
      registry.complete("tool-use-2", "session-2", r2);
      registry.complete("tool-use-1", "session-1", r1);

      expect(await p1).toEqual(r1);
      expect(await p2).toEqual(r2);
    });

    it("should handle result with multiple content items", async () => {
      registry.registerToolOptions("screenshot");
      registry.enqueue("session-1", "tool-use-1", "screenshot");

      const promise = registry.waitForClient("session-1");

      const result: CallToolResult = {
        content: [
          { type: "text", text: "Screenshot taken" },
          { type: "image", data: "base64data", mimeType: "image/png" },
        ],
      };

      registry.complete("tool-use-1", "session-1", result);
      expect(await promise).toEqual(result);
    });
  });
});
