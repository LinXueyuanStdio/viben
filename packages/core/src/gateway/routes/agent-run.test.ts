/**
 * Agent Run Routes Tests
 *
 * Tests for agent execution SSE endpoints:
 * - POST /api/agent/run - Start agent with SSE streaming
 * - POST /api/agent/stop/:sessionId - Stop a running session
 * - POST /api/agent/approve/:planId - Approve a plan
 * - POST /api/agent/reject/:planId - Reject a plan
 * - GET /api/agent/tasks/subscribe - Subscribe to background tasks (SSE)
 * - POST /api/agent/tasks/:taskId/stop - Stop a background task
 * - GET /api/agent/session/:sessionId - Get session info
 * - GET /api/agent/plan/:planId - Get plan info
 * - POST /api/agent/answer/:questionId - Answer a question
 *
 * Uses real Fastify instance with mocked LLM backend (SdkChatProxy)
 * for non-SSE routes. SSE routes require mock raw response handling
 * because Fastify's inject() doesn't support streaming responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAgentRunRoutes } from "./agent-run";

// Create mock functions using vi.hoisted to ensure they're available during mock hoisting
const { MockSdkChatProxy, mockExecuteStreaming } = vi.hoisted(() => {
  const mockExecuteStreaming = vi.fn();

  // Use a class for proper constructor behavior with `new`
  class MockSdkChatProxy {
    executeStreaming = mockExecuteStreaming;
  }

  return { MockSdkChatProxy, mockExecuteStreaming };
});

/**
 * Default mock implementation for executeStreaming
 */
function defaultExecuteStreaming() {
  return (async function* () {
    yield { type: "text", content: "Hello from mock agent" };
    yield { type: "result", subtype: "success" };
  })();
}

// Mock the SDK proxy
vi.mock("../../executors/chat/sdk-proxy", () => ({
  SdkChatProxy: MockSdkChatProxy,
}));

// Mock agent service (simplified - only abort control + plans)
vi.mock("../../services/agent", () => ({
  agentService: {
    registerSession: vi.fn(() => new AbortController()),
    getAbortSignal: vi.fn(() => new AbortController().signal),
    stopSession: vi.fn(() => true),
    unregisterSession: vi.fn(),
    isSessionAborted: vi.fn(() => false),
    getPlan: vi.fn(() => ({
      id: "test-plan-123",
      sessionId: "test-session-123",
      goal: "Test goal",
      steps: [{ id: "1", description: "Step 1", status: "pending" }],
      status: "pending",
      createdAt: new Date(),
    })),
    approvePlan: vi.fn(() => true),
    rejectPlan: vi.fn(() => true),
    storeQuestion: vi.fn(),
    getQuestion: vi.fn(),
    answerQuestion: vi.fn(() => true),
  },
}));

// Mock background task manager
vi.mock("../../services/background-tasks", () => ({
  backgroundTaskManager: {
    addTask: vi.fn(),
    updateTask: vi.fn(),
    updateStatus: vi.fn(),
    removeTask: vi.fn(),
    getAllTasks: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
    stopTask: vi.fn(),
  },
}));

// Mock session store service
vi.mock("../../services/session-store", () => ({
  sessionStoreService: {
    appendUIMessage: vi.fn(),
    appendMessage: vi.fn(),
    appendAgentMessage: vi.fn(),
  },
}));

// Mock telemetry with inline logger factory
vi.mock("../../telemetry", () => {
  // Define logger factory inside the mock to avoid hoisting issues
  const createMockLogger = (): Record<string, unknown> => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  });

  return {
    trace: {
      getTracer: () => ({
        startSpan: () => ({
          setAttribute: vi.fn(),
          setAttributes: vi.fn(),
          setStatus: vi.fn(),
          addEvent: vi.fn(),
          recordException: vi.fn(),
          end: vi.fn(),
          spanContext: () => ({ traceId: "mock-trace-id" }),
        }),
      }),
      getActiveSpan: () => ({
        spanContext: () => ({ traceId: "mock-trace-id" }),
      }),
      setSpan: () => ({}),
    },
    context: {
      active: () => ({}),
    },
    SpanStatusCode: {
      OK: 1,
      ERROR: 2,
    },
    recordAgentRequest: vi.fn(),
    recordAgentToolCall: vi.fn(),
    logger: createMockLogger(),
  };
});

// Mock telemetry route names
vi.mock("../../telemetry/route-names", () => ({
  getSpanName: (name: string) => name,
}));

// Mock config reader
vi.mock("../../config/markdown", () => ({
  readMarkdownConfig: vi.fn(() => null),
}));

// Import the mocked services
import { agentService } from "../../services/agent";
import { backgroundTaskManager } from "../../services/background-tasks";

// ============================================================================
// Mock Types for SSE Testing
// ============================================================================

/**
 * Mock raw response for SSE testing
 * Fastify's inject() doesn't support streaming, so we need to mock raw response
 */
interface MockRawResponse {
  setHeader: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  destroyed: boolean;
}

/**
 * Mock Fastify reply for SSE routes
 */
interface MockReply {
  code: ReturnType<typeof vi.fn>;
  raw: MockRawResponse;
}

/**
 * Mock Fastify request
 */
interface MockRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  headers: Record<string, string>;
  raw: {
    on: ReturnType<typeof vi.fn>;
    destroyed: boolean;
  };
}

interface MockRouteHandler {
  method: string;
  url: string;
  handler: (request: MockRequest, reply: MockReply) => Promise<unknown>;
}

/**
 * Create a mock Fastify instance for SSE route testing
 * This is necessary because Fastify's inject() doesn't support streaming responses
 */
function createMockFastify() {
  const routes: MockRouteHandler[] = [];

  const fastify = {
    get: vi.fn(
      (
        url: string,
        handler: (req: MockRequest, rep: MockReply) => Promise<unknown>
      ) => {
        routes.push({ method: "GET", url, handler });
      }
    ),
    post: vi.fn(
      (
        url: string,
        handler: (req: MockRequest, rep: MockReply) => Promise<unknown>
      ) => {
        routes.push({ method: "POST", url, handler });
      }
    ),
    routes,
    // Helper to find and execute a route handler
    async inject(options: {
      method: string;
      url: string;
      payload?: unknown;
      headers?: Record<string, string>;
    }) {
      const { method, url, payload, headers = {} } = options;
      const parsedUrl = new URL(url, "http://localhost");
      const pathname = parsedUrl.pathname;

      // Find matching route
      let matchingRoute: MockRouteHandler | undefined;
      let params: Record<string, string> = {};

      for (const route of routes) {
        if (route.method !== method) continue;

        // Check for exact match
        if (route.url === pathname) {
          matchingRoute = route;
          break;
        }

        // Check for parameterized match
        const routeParts = route.url.split("/");
        const urlParts = pathname.split("/");

        if (routeParts.length === urlParts.length) {
          let isMatch = true;
          const extractedParams: Record<string, string> = {};

          for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(":")) {
              extractedParams[routeParts[i].slice(1)] = urlParts[i];
            } else if (routeParts[i] !== urlParts[i]) {
              isMatch = false;
              break;
            }
          }

          if (isMatch) {
            matchingRoute = route;
            params = extractedParams;
            break;
          }
        }
      }

      if (!matchingRoute) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Route not found" }),
          sseMessages: [],
        };
      }

      // Create mock request and reply for SSE
      const sseMessages: string[] = [];
      const rawResponse: MockRawResponse = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          sseMessages.push(data);
        }),
        end: vi.fn(),
        destroyed: false,
      };

      const request: MockRequest = {
        body: payload,
        params,
        headers: { origin: "http://localhost:1420", ...headers },
        raw: {
          on: vi.fn(),
          destroyed: false,
        },
      };

      let statusCode = 200;
      const reply: MockReply = {
        code: vi.fn((code: number) => {
          statusCode = code;
          return reply;
        }),
        raw: rawResponse,
      };

      try {
        const result = await matchingRoute.handler(request, reply);
        return {
          statusCode,
          body: result ? JSON.stringify(result) : "",
          sseMessages,
          rawResponse,
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          sseMessages,
          rawResponse,
        };
      }
    },
  };

  return fastify;
}

/**
 * Parse SSE messages from raw write calls
 */
function parseSSEMessages(sseMessages: string[]): Array<{ type: string; [key: string]: unknown }> {
  return sseMessages
    .filter((msg) => msg.startsWith("data: "))
    .map((msg) => {
      const jsonStr = msg.slice(6).trim();
      // Remove trailing newlines
      const cleanJson = jsonStr.replace(/\n+$/, "");
      return JSON.parse(cleanJson);
    });
}

describe("Agent Run Routes", () => {
  // ============================================================================
  // Non-SSE Routes (use real Fastify)
  // ============================================================================

  describe("Non-SSE Routes", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      vi.clearAllMocks();
      app = Fastify();
      registerAgentRunRoutes(app);
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
    });

    describe("POST /api/agent/stop/:sessionId", () => {
      it("should stop a running session", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/agent/stop/test-session-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.sessionId).toBe("test-session-123");
        expect(agentService.stopSession).toHaveBeenCalledWith("test-session-123");
      });

      it("should return 404 for non-existent session", async () => {
        vi.mocked(agentService.stopSession).mockReturnValueOnce(false);

        const response = await app.inject({
          method: "POST",
          url: "/api/agent/stop/non-existent",
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Session not found");
      });
    });

    describe("POST /api/agent/approve/:planId", () => {
      it("should approve a pending plan", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/agent/approve/test-plan-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.planId).toBe("test-plan-123");
        expect(agentService.approvePlan).toHaveBeenCalledWith("test-plan-123");
      });

      it("should return 404 for non-existent plan", async () => {
        vi.mocked(agentService.approvePlan).mockReturnValueOnce(false);

        const response = await app.inject({
          method: "POST",
          url: "/api/agent/approve/non-existent",
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Plan not found");
      });
    });

    describe("POST /api/agent/reject/:planId", () => {
      it("should reject a pending plan", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/agent/reject/test-plan-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.planId).toBe("test-plan-123");
        expect(agentService.rejectPlan).toHaveBeenCalledWith("test-plan-123");
      });

      it("should return 404 for non-existent plan", async () => {
        vi.mocked(agentService.rejectPlan).mockReturnValueOnce(false);

        const response = await app.inject({
          method: "POST",
          url: "/api/agent/reject/non-existent",
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Plan not found");
      });
    });

    describe("POST /api/agent/answer/:questionId", () => {
      it("should answer a question", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/agent/answer/question-123",
          payload: {
            answers: { choice: "yes" },
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.questionId).toBe("question-123");
        expect(agentService.answerQuestion).toHaveBeenCalledWith("question-123", { choice: "yes" });
      });

      it("should return 400 for missing answers", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/agent/answer/question-123",
          payload: {},
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Answers");
      });

      it("should return 404 for non-existent question", async () => {
        vi.mocked(agentService.answerQuestion).mockReturnValueOnce(false);

        const response = await app.inject({
          method: "POST",
          url: "/api/agent/answer/non-existent",
          payload: {
            answers: { choice: "no" },
          },
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Question not found");
      });
    });

    describe("POST /api/agent/tasks/:taskId/stop", () => {
      it("should stop a background task", async () => {
        const response = await app.inject({
          method: "POST",
          url: "/api/agent/tasks/task-123/stop",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(true);
        expect(body.taskId).toBe("task-123");
        expect(backgroundTaskManager.stopTask).toHaveBeenCalledWith("task-123");
      });
    });

    describe("GET /api/agent/session/:sessionId", () => {
      it("should return session runtime status", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/api/agent/session/test-session-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.sessionId).toBe("test-session-123");
        expect(body.status).toBe("active");
      });

      it("should return cancelled status when session is aborted", async () => {
        vi.mocked(agentService.isSessionAborted).mockReturnValueOnce(true);

        const response = await app.inject({
          method: "GET",
          url: "/api/agent/session/test-session-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.sessionId).toBe("test-session-123");
        expect(body.status).toBe("cancelled");
      });

      it("should return 404 for non-existent session", async () => {
        vi.mocked(agentService.getAbortSignal).mockReturnValueOnce(undefined);

        const response = await app.inject({
          method: "GET",
          url: "/api/agent/session/non-existent",
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Session not found");
      });
    });

    describe("GET /api/agent/plan/:planId", () => {
      it("should return plan info", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/api/agent/plan/test-plan-123",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe("test-plan-123");
        expect(body.goal).toBe("Test goal");
        expect(body.steps).toHaveLength(1);
        expect(body.status).toBe("pending");
      });

      it("should return 404 for non-existent plan", async () => {
        vi.mocked(agentService.getPlan).mockReturnValueOnce(undefined);

        const response = await app.inject({
          method: "GET",
          url: "/api/agent/plan/non-existent",
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Plan not found");
      });
    });
  });

  // ============================================================================
  // SSE Routes (use mock Fastify for raw response handling)
  // Fastify's inject() doesn't support streaming responses, so we need to mock
  // ============================================================================

  describe("SSE Routes", () => {
    let fastify: ReturnType<typeof createMockFastify>;

    beforeEach(() => {
      vi.clearAllMocks();
      mockExecuteStreaming.mockImplementation(defaultExecuteStreaming);
      fastify = createMockFastify();
      registerAgentRunRoutes(fastify as never);
    });

    // ============================================================================
    // POST /api/agent/run Tests
    // ============================================================================

    describe("POST /api/agent/run", () => {
      it("should set SSE headers", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
          "Content-Type",
          "text/event-stream"
        );
        expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
          "Cache-Control",
          "no-cache, no-transform"
        );
      });

      it("should include session_id in first SSE event", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        expect(messages.length).toBeGreaterThan(0);

        // First message should be session with UUID format
        expect(messages[0].type).toBe("session");
        expect(messages[0].sessionId).toBeDefined();
        expect(typeof messages[0].sessionId).toBe("string");
        expect(messages[0].sessionId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
      });

      it("should stream text messages from SDK proxy", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const textMsg = messages.find((m) => m.type === "text");

        expect(textMsg).toBeDefined();
        expect(textMsg?.content).toBe("Hello from mock agent");
      });

      it("should include result message", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const resultMsg = messages.find((m) => m.type === "result");

        expect(resultMsg).toBeDefined();
        expect(resultMsg?.subtype).toBe("success");
      });

      it("should include done message at the end", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const doneMsg = messages.find((m) => m.type === "done");
        expect(doneMsg).toBeDefined();

        // Stream should be ended
        expect(response.rawResponse?.end).toHaveBeenCalled();
      });

      it("should validate required prompt field", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {},
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("Prompt");
      });

      it("should reject empty prompt", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "   ",
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain("empty");
      });

      it("should register session and call SDK proxy", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        expect(agentService.registerSession).toHaveBeenCalled();
        expect(agentService.unregisterSession).toHaveBeenCalled();
        expect(mockExecuteStreaming).toHaveBeenCalled();
      });
    });

    // ============================================================================
    // Request Parameters Tests
    // ============================================================================

    describe("Request Parameters", () => {
      it("should pass cwd parameter to SDK proxy", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
            cwd: "/custom/path",
          },
        });

        expect(mockExecuteStreaming).toHaveBeenCalledWith(
          expect.objectContaining({
            cwd: "/custom/path",
          })
        );
      });

      it("should pass model from agentConfig to SDK proxy", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
            agentConfig: {
              model: "claude-3-opus",
            },
          },
        });

        expect(mockExecuteStreaming).toHaveBeenCalledWith(
          expect.objectContaining({
            model: "claude-3-opus",
          })
        );
      });

      it("should set dangerouslySkipPermissions to true", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(mockExecuteStreaming).toHaveBeenCalledWith(
          expect.objectContaining({
            dangerouslySkipPermissions: true,
          })
        );
      });

      it("should support snake_case parameters", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
            agent_config: {
              model: "gpt-4",
            },
            session_id: "test-session",
            task_id: "test-task",
          },
        });

        expect(mockExecuteStreaming).toHaveBeenCalledWith(
          expect.objectContaining({
            model: "gpt-4",
          })
        );
      });

      it("should pass resume parameter for multi-turn conversations", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Continue",
            resume: "previous-session-id",
          },
        });

        expect(mockExecuteStreaming).toHaveBeenCalledWith(
          expect.objectContaining({
            resume: "previous-session-id",
          })
        );
      });

      it("should pass sessionId (UUID) to SDK proxy", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(mockExecuteStreaming).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
            ),
          })
        );
      });
    });

    // ============================================================================
    // Error Handling Tests
    // ============================================================================

    describe("Error Handling", () => {
      it("should handle SDK proxy errors gracefully", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          throw new Error("LLM connection failed");
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);

        // Should have session message first
        expect(messages[0].type).toBe("session");

        // Should have error message
        const errorMsg = messages.find((m) => m.type === "error");
        expect(errorMsg).toBeDefined();
        expect(errorMsg?.message).toContain("LLM connection failed");

        // Should have done message
        const doneMsg = messages.find((m) => m.type === "done");
        expect(doneMsg).toBeDefined();
      });

      it("should handle authentication errors with user-friendly message", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          throw new Error("API key invalid: 401 Unauthorized");
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const errorMsg = messages.find((m) => m.type === "error");

        expect(errorMsg).toBeDefined();
        expect(errorMsg?.message).toContain("Authentication failed");
      });

      it("should handle rate limit errors with user-friendly message", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          throw new Error("rate limit exceeded - 429");
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const errorMsg = messages.find((m) => m.type === "error");

        expect(errorMsg?.message).toContain("Rate limit");
      });

      it("should unregister session even on error", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          throw new Error("Fatal error");
        });

        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(agentService.unregisterSession).toHaveBeenCalled();
      });

      it("should stop streaming when session is aborted", async () => {
        // Mock isSessionAborted to return true after first check
        let callCount = 0;
        vi.mocked(agentService.isSessionAborted).mockImplementation(() => {
          callCount++;
          return callCount > 1;
        });

        // Mock SDK to yield multiple messages
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          yield { type: "text", content: "Message 1" };
          yield { type: "text", content: "Message 2" };
          yield { type: "text", content: "Message 3" };
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);

        // Should have error message about session cancelled
        const errorMsg = messages.find((m) => m.type === "error");
        expect(errorMsg).toBeDefined();
        expect(errorMsg?.message).toContain("cancelled by user");
      });
    });

    // ============================================================================
    // SSE Message Types Tests
    // ============================================================================

    describe("SSE Message Types", () => {
      it("should stream tool_use messages", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          yield {
            type: "tool_use",
            id: "tool-123",
            name: "read_file",
            input: { path: "/test.txt" },
          };
          yield { type: "result", subtype: "success" };
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Read file",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const toolUseMsg = messages.find((m) => m.type === "tool_use");

        expect(toolUseMsg).toBeDefined();
        expect(toolUseMsg?.id).toBe("tool-123");
        expect(toolUseMsg?.name).toBe("read_file");
        expect(toolUseMsg?.input).toEqual({ path: "/test.txt" });
      });

      it("should stream tool_result messages", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          yield {
            type: "tool_result",
            toolUseId: "tool-123",
            output: "File contents here",
            isError: false,
          };
          yield { type: "result", subtype: "success" };
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Read file",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const toolResultMsg = messages.find((m) => m.type === "tool_result");

        expect(toolResultMsg).toBeDefined();
        expect(toolResultMsg?.toolUseId).toBe("tool-123");
        expect(toolResultMsg?.output).toBe("File contents here");
        expect(toolResultMsg?.isError).toBe(false);
      });

      it("should stream question messages and store in agentService", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          yield {
            type: "question",
            id: "question-123",
            questions: [
              {
                header: "Confirm",
                question: "Do you want to proceed?",
                options: [
                  { label: "Yes", description: "Continue" },
                  { label: "No", description: "Cancel" },
                ],
                multiSelect: false,
              },
            ],
          };
          yield { type: "result", subtype: "success" };
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Ask question",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const questionMsg = messages.find((m) => m.type === "question");

        expect(questionMsg).toBeDefined();
        expect(questionMsg?.id).toBe("question-123");
        expect(questionMsg?.questions).toBeDefined();
        expect((questionMsg?.questions as unknown[]).length).toBe(1);

        // Question should be stored in agentService
        expect(agentService.storeQuestion).toHaveBeenCalled();
      });

      it("should stream sdk_session messages", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          yield {
            type: "sdk_session",
            sdkSessionId: "sdk-session-uuid",
          };
          yield { type: "text", content: "Hello" };
          yield { type: "result", subtype: "success" };
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const sdkSessionMsg = messages.find((m) => m.type === "sdk_session");

        expect(sdkSessionMsg).toBeDefined();
        expect(sdkSessionMsg?.sdkSessionId).toBe("sdk-session-uuid");
      });

      it("should stream error messages from SDK", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          yield { type: "error", message: "Rate limit exceeded" };
        });

        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        const errorMsg = messages.find((m) => m.type === "error");

        expect(errorMsg).toBeDefined();
        expect(errorMsg?.message).toBe("Rate limit exceeded");
      });
    });

    // ============================================================================
    // SSE Format Tests
    // ============================================================================

    describe("SSE Message Format", () => {
      it("should format SSE messages with 'data: ' prefix and double newline", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        // Each message should start with "data: " and end with "\n\n"
        for (const msg of response.sseMessages) {
          expect(msg.startsWith("data: ")).toBe(true);
          expect(msg.endsWith("\n\n")).toBe(true);
        }
      });

      it("should include session message first in SSE stream", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        expect(messages[0].type).toBe("session");
        expect(messages[0].sessionId).toBeDefined();
      });

      it("should include done message last in SSE stream", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        const messages = parseSSEMessages(response.sseMessages);
        expect(messages[messages.length - 1].type).toBe("done");
      });
    });

    // ============================================================================
    // CORS Headers Tests
    // ============================================================================

    describe("CORS Headers", () => {
      it("should set CORS headers on SSE response", async () => {
        const response = await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
          headers: {
            origin: "http://localhost:3000",
          },
        });

        expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
          "Access-Control-Allow-Origin",
          "http://localhost:3000"
        );
        expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
          "Access-Control-Allow-Credentials",
          "true"
        );
      });

      it("should use wildcard when no origin header", async () => {
        // Create a fresh mock without origin header
        const noOriginFastify = createMockFastify();
        registerAgentRunRoutes(noOriginFastify as never);

        const route = noOriginFastify.routes.find(
          (r) => r.method === "POST" && r.url === "/api/agent/run"
        );

        const rawResponse: MockRawResponse = {
          setHeader: vi.fn(),
          write: vi.fn(),
          end: vi.fn(),
          destroyed: false,
        };

        const request: MockRequest = {
          body: { prompt: "Test" },
          params: {},
          headers: {}, // No origin
          raw: { on: vi.fn(), destroyed: false },
        };

        const reply: MockReply = {
          code: vi.fn().mockReturnThis(),
          raw: rawResponse,
        };

        await route?.handler(request, reply);

        expect(rawResponse.setHeader).toHaveBeenCalledWith(
          "Access-Control-Allow-Origin",
          "*"
        );
      });
    });

    // ============================================================================
    // Session Lifecycle Tests
    // ============================================================================

    describe("Session Lifecycle", () => {
      it("should register session at start", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Hello",
          },
        });

        expect(agentService.registerSession).toHaveBeenCalled();
      });

      it("should unregister session in finally block", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(agentService.unregisterSession).toHaveBeenCalled();
      });

      it("should unregister session even on error", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          throw new Error("Fatal error");
        });

        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(agentService.unregisterSession).toHaveBeenCalled();
      });

      it("should add task to background task manager", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test task",
            cwd: "/workspace",
          },
        });

        expect(backgroundTaskManager.addTask).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: expect.stringContaining("Test task"),
            workspacePath: "/workspace",
          })
        );
      });

      it("should update task status on completion", async () => {
        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(backgroundTaskManager.updateStatus).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            status: "completed",
          })
        );
      });

      it("should update task status to error on failure", async () => {
        mockExecuteStreaming.mockImplementationOnce(async function* () {
          throw new Error("Fatal error");
        });

        await fastify.inject({
          method: "POST",
          url: "/api/agent/run",
          payload: {
            prompt: "Test",
          },
        });

        expect(backgroundTaskManager.updateStatus).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            status: "error",
          })
        );
      });
    });

    // ============================================================================
    // GET /api/agent/tasks/subscribe Tests (Long-polling SSE)
    // ============================================================================

    describe("GET /api/agent/tasks/subscribe", () => {
      it("should set SSE headers and send initial tasks", async () => {
        const route = fastify.routes.find(
          (r) => r.method === "GET" && r.url === "/api/agent/tasks/subscribe"
        );
        expect(route).toBeDefined();

        vi.mocked(backgroundTaskManager.getAllTasks).mockReturnValueOnce([
          {
            id: "task-1",
            name: "Test Task",
            status: "running",
            progress: 50,
            startedAt: new Date(),
          },
        ] as never);

        const sseMessages: string[] = [];
        const rawResponse: MockRawResponse = {
          setHeader: vi.fn(),
          write: vi.fn((data: string) => {
            sseMessages.push(data);
          }),
          end: vi.fn(),
          destroyed: false,
        };

        // Track close handlers
        const closeHandlers: Array<() => void> = [];
        const request: MockRequest = {
          headers: { origin: "http://localhost:1420" },
          raw: {
            on: vi.fn((event: string, handler: () => void) => {
              if (event === "close") {
                closeHandlers.push(handler);
              }
            }),
            destroyed: false,
          },
        };

        const reply: MockReply = {
          code: vi.fn().mockReturnThis(),
          raw: rawResponse,
        };

        // Start the handler but don't await it (it's long-running)
        const handlerPromise = route!.handler(request, reply);

        // Give it a tick to set headers and send initial data
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Check SSE headers were set
        expect(rawResponse.setHeader).toHaveBeenCalledWith(
          "Content-Type",
          "text/event-stream"
        );
        expect(rawResponse.setHeader).toHaveBeenCalledWith(
          "Cache-Control",
          "no-cache, no-transform"
        );
        expect(rawResponse.setHeader).toHaveBeenCalledWith(
          "Access-Control-Allow-Origin",
          "http://localhost:1420"
        );

        // Check initial tasks were sent
        expect(backgroundTaskManager.getAllTasks).toHaveBeenCalled();
        expect(sseMessages.length).toBeGreaterThan(0);
        expect(sseMessages[0]).toContain("tasks");
        expect(sseMessages[0]).toContain("task-1");

        // Check subscribe was called
        expect(backgroundTaskManager.subscribe).toHaveBeenCalled();

        // Simulate client disconnect to end the handler
        closeHandlers.forEach((handler) => handler());
        await handlerPromise;
      });

      it("should unsubscribe on client disconnect", async () => {
        const route = fastify.routes.find(
          (r) => r.method === "GET" && r.url === "/api/agent/tasks/subscribe"
        );

        const mockUnsubscribe = vi.fn();
        vi.mocked(backgroundTaskManager.subscribe).mockReturnValueOnce(mockUnsubscribe);

        const closeHandlers: Array<() => void> = [];
        const request: MockRequest = {
          headers: { origin: "http://localhost:1420" },
          raw: {
            on: vi.fn((event: string, handler: () => void) => {
              if (event === "close") {
                closeHandlers.push(handler);
              }
            }),
            destroyed: false,
          },
        };

        const reply: MockReply = {
          code: vi.fn().mockReturnThis(),
          raw: {
            setHeader: vi.fn(),
            write: vi.fn(),
            end: vi.fn(),
            destroyed: false,
          },
        };

        const handlerPromise = route!.handler(request, reply);

        // Give it a tick to subscribe
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Simulate disconnect
        closeHandlers.forEach((handler) => handler());
        await handlerPromise;

        // Unsubscribe should have been called
        expect(mockUnsubscribe).toHaveBeenCalled();
      });
    });
  });
});
