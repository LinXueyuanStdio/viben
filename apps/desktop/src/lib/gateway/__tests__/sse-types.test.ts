/**
 * SSE Types Integration Test
 * SSE 类型集成测试
 *
 * Tests that the SSE types match the backend's flat message format.
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
  SSEQuestionEvent,
  SSEResultEvent,
  SSEErrorEvent,
  SSEDoneEvent,
} from "../types/sse";
import { sseEventToAgentMessage } from "../utils";

describe("SSE Types", () => {
  describe("Type structure matches backend format", () => {
    it("should handle session event (flat structure)", () => {
      const event: SSESessionEvent = {
        type: "session",
        sessionId: "test-session-123",
        traceId: "trace-456",
      };

      // Verify it matches the expected flat structure
      expect(event.type).toBe("session");
      expect(event.sessionId).toBe("test-session-123");
      expect(event.traceId).toBe("trace-456");
    });

    it("should handle sdk_session event", () => {
      const event: SSESdkSessionEvent = {
        type: "sdk_session",
        sdkSessionId: "sdk-session-789",
      };

      expect(event.type).toBe("sdk_session");
      expect(event.sdkSessionId).toBe("sdk-session-789");
    });

    it("should handle text event (flat - no data wrapper)", () => {
      const event: SSETextEvent = {
        type: "text",
        content: "Hello, world!",
      };

      // Backend sends content directly, not nested in data
      expect(event.type).toBe("text");
      expect(event.content).toBe("Hello, world!");
    });

    it("should handle tool_use event (flat)", () => {
      const event: SSEToolUseEvent = {
        type: "tool_use",
        id: "tool-123",
        name: "read_file",
        input: { path: "/test/file.txt" },
      };

      expect(event.type).toBe("tool_use");
      expect(event.id).toBe("tool-123");
      expect(event.name).toBe("read_file");
      expect(event.input).toEqual({ path: "/test/file.txt" });
    });

    it("should handle tool_result event (camelCase)", () => {
      const event: SSEToolResultEvent = {
        type: "tool_result",
        toolUseId: "tool-123", // camelCase, not snake_case
        output: "File contents here",
        isError: false,
      };

      expect(event.type).toBe("tool_result");
      expect(event.toolUseId).toBe("tool-123");
      expect(event.output).toBe("File contents here");
      expect(event.isError).toBe(false);
    });

    it("should handle plan event (nested plan object)", () => {
      const event: SSEPlanEvent = {
        type: "plan",
        plan: {
          id: "plan-123",
          goal: "Fix the bug",
          steps: [
            { id: "step-1", description: "Read file", status: "completed" },
            { id: "step-2", description: "Analyze code", status: "in_progress" },
            { id: "step-3", description: "Apply fix", status: "pending" },
          ],
          notes: "Additional notes",
        },
      };

      expect(event.type).toBe("plan");
      expect(event.plan.id).toBe("plan-123");
      expect(event.plan.goal).toBe("Fix the bug");
      expect(event.plan.steps).toHaveLength(3);
      expect(event.plan.notes).toBe("Additional notes");
    });

    it("should handle question event (flat)", () => {
      const event: SSEQuestionEvent = {
        type: "question",
        id: "question-123",
        questions: [
          {
            header: "Auth Method",
            question: "Which auth method should we use?",
            options: [
              { label: "JWT", description: "JSON Web Tokens" },
              { label: "OAuth", description: "OAuth 2.0" },
            ],
            multiSelect: false,
          },
        ],
      };

      expect(event.type).toBe("question");
      expect(event.id).toBe("question-123");
      expect(event.questions).toHaveLength(1);
      expect(event.questions[0].header).toBe("Auth Method");
    });

    it("should handle result event (cost/duration/subtype)", () => {
      const event: SSEResultEvent = {
        type: "result",
        cost: 0.0125,
        duration: 5432,
        subtype: "success",
      };

      // Backend sends cost/duration/subtype, not content
      expect(event.type).toBe("result");
      expect(event.cost).toBe(0.0125);
      expect(event.duration).toBe(5432);
      expect(event.subtype).toBe("success");
    });

    it("should handle error event (flat)", () => {
      const event: SSEErrorEvent = {
        type: "error",
        message: "Something went wrong",
      };

      expect(event.type).toBe("error");
      expect(event.message).toBe("Something went wrong");
    });

    it("should handle done event (no data)", () => {
      const event: SSEDoneEvent = {
        type: "done",
      };

      expect(event.type).toBe("done");
    });
  });

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
