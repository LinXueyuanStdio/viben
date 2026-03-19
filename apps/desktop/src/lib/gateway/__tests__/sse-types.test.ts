/**
 * SSE Types Integration Test
 * SSE 类型集成测试
 *
 * Tests the sseEventToAgentMessage conversion function.
 *
 * Note: Type structure correctness is verified by TypeScript compilation.
 * If the SSE types don't match the backend format, TypeScript will fail to compile.
 * Therefore, we only test runtime behavior (conversion functions) here.
 */

import { describe, it, expect } from "vitest";
import type {
  SSEMessageEvent,
  SSESessionEvent,
  SSESdkSessionEvent,
  SSETextEvent,
  SSEToolUseEvent,
  SSEToolResultEvent,
  SSEPlanEvent,
  SSEResultEvent,
  SSEErrorEvent,
  SSEDoneEvent,
} from "../types/sse";
import { sseEventToAgentMessage } from "../utils";

describe("SSE Types", () => {
  describe("sseEventToAgentMessage conversion", () => {
    it("should convert sdk_session event", () => {
      const event: SSESdkSessionEvent = {
        type: "sdk_session",
        sdkSessionId: "sdk-123",
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("sdk_session");
      expect(message!.sdkSessionId).toBe("sdk-123");
    });

    it("should convert text event (flat access)", () => {
      const event: SSETextEvent = {
        type: "text",
        content: "Hello from agent",
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("text");
      expect(message!.content).toBe("Hello from agent");
    });

    it("should convert tool_use event (flat access)", () => {
      const event: SSEToolUseEvent = {
        type: "tool_use",
        id: "tool-456",
        name: "write_file",
        input: { path: "/output.txt", content: "data" },
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("tool_use");
      expect(message!.id).toBe("tool-456");
      expect(message!.name).toBe("write_file");
      expect(message!.input).toEqual({ path: "/output.txt", content: "data" });
    });

    it("should convert tool_result event (camelCase)", () => {
      const event: SSEToolResultEvent = {
        type: "tool_result",
        toolUseId: "tool-456",
        output: "File written successfully",
        isError: false,
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("tool_result");
      expect(message!.toolUseId).toBe("tool-456");
      expect(message!.output).toBe("File written successfully");
      expect(message!.isError).toBe(false);
    });

    it("should convert plan event", () => {
      const event: SSEPlanEvent = {
        type: "plan",
        plan: {
          id: "plan-789",
          goal: "Implement feature",
          steps: [
            { id: "s1", description: "Design", status: "completed" },
            { id: "s2", description: "Code", status: "pending" },
          ],
        },
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("plan");
      expect(message!.plan).toBeDefined();
      expect(message!.plan!.goal).toBe("Implement feature");
      expect(message!.plan!.steps).toHaveLength(2);
    });

    it("should convert result event with cost/duration", () => {
      const event: SSEResultEvent = {
        type: "result",
        cost: 0.05,
        duration: 10000,
        subtype: "success",
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("result");
      // Should generate human-readable content
      expect(message!.content).toContain("Status: success");
      expect(message!.content).toContain("Duration:");
      expect(message!.content).toContain("Cost:");
    });

    it("should convert error event", () => {
      const event: SSEErrorEvent = {
        type: "error",
        message: "API rate limit exceeded",
      };

      const message = sseEventToAgentMessage(event);
      expect(message).not.toBeNull();
      expect(message!.type).toBe("error");
      expect(message!.message).toBe("API rate limit exceeded");
      expect(message!.isError).toBe(true);
    });

    it("should return null for session event", () => {
      const event: SSESessionEvent = {
        type: "session",
        sessionId: "sess-123",
      };

      const message = sseEventToAgentMessage(event);
      expect(message).toBeNull();
    });

    it("should return null for done event", () => {
      const event: SSEDoneEvent = {
        type: "done",
      };

      const message = sseEventToAgentMessage(event);
      expect(message).toBeNull();
    });
  });

  describe("SSEMessageEvent union type", () => {
    // Note: This test verifies that the union type accepts all event types.
    // TypeScript compilation ensures type correctness; this test documents
    // the expected event types and verifies the array is properly formed.
    it("should accept all event types", () => {
      const events: SSEMessageEvent[] = [
        { type: "session", sessionId: "s1" },
        { type: "sdk_session", sdkSessionId: "sdk1" },
        { type: "text", content: "hello" },
        { type: "tool_use", id: "t1", name: "test", input: {} },
        { type: "tool_result", toolUseId: "t1", output: "ok" },
        { type: "plan", plan: { id: "p1", goal: "test", steps: [] } },
        { type: "question", id: "q1", questions: [] },
        { type: "result", subtype: "success" },
        { type: "error", message: "oops" },
        { type: "done" },
      ];

      expect(events).toHaveLength(10);
    });
  });
});
