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
 *
 * Covers:
 * - SSE message streaming format
 * - Session lifecycle management
 * - Plan approval/rejection flow
 * - Background task management
 * - Error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerAgentRunRoutes } from "./agent-run";
import { agentService } from "../../services/agent";
import { backgroundTaskManager } from "../../services/background-tasks";

// Mock the SDK proxy
vi.mock("../../executors/chat/sdk-proxy", () => ({
  SdkChatProxy: vi.fn().mockImplementation(() => ({
    executeStreaming: vi.fn(async function* () {
      yield { type: "text", content: "Hello from mock agent" };
      yield { type: "result", subtype: "success" };
    }),
  })),
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

/**
 * Mock raw response for SSE testing
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
  let fastify: ReturnType<typeof createMockFastify>;

  beforeEach(() => {
    fastify = createMockFastify();
    registerAgentRunRoutes(fastify as never);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Route Registration Tests
  // ============================================================================

  describe("Route Registration", () => {
    it("should register POST /api/agent/run route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "POST" && r.url === "/api/agent/run"
      );
      expect(route).toBeDefined();
    });

    it("should register POST /api/agent/stop/:sessionId route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "POST" && r.url === "/api/agent/stop/:sessionId"
      );
      expect(route).toBeDefined();
    });

    it("should register POST /api/agent/approve/:planId route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "POST" && r.url === "/api/agent/approve/:planId"
      );
      expect(route).toBeDefined();
    });

    it("should register POST /api/agent/reject/:planId route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "POST" && r.url === "/api/agent/reject/:planId"
      );
      expect(route).toBeDefined();
    });

    it("should register GET /api/agent/tasks/subscribe route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "GET" && r.url === "/api/agent/tasks/subscribe"
      );
      expect(route).toBeDefined();
    });

    it("should register POST /api/agent/tasks/:taskId/stop route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "POST" && r.url === "/api/agent/tasks/:taskId/stop"
      );
      expect(route).toBeDefined();
    });

    it("should register GET /api/agent/session/:sessionId route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "GET" && r.url === "/api/agent/session/:sessionId"
      );
      expect(route).toBeDefined();
    });

    it("should register GET /api/agent/plan/:planId route", () => {
      const route = fastify.routes.find(
        (r) => r.method === "GET" && r.url === "/api/agent/plan/:planId"
      );
      expect(route).toBeDefined();
    });
  });

  // ============================================================================
  // POST /api/agent/run Tests
  // ============================================================================

  describe("POST /api/agent/run", () => {
    it("should register session and stream SSE messages", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Hello",
          cwd: "/tmp",
        },
      });

      expect(response.statusCode).toBe(200);

      // Check SSE headers were set
      expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream"
      );
      expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-cache, no-transform"
      );

      // Check CORS headers
      expect(response.rawResponse?.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "http://localhost:1420"
      );

      // Check session was registered for abort control
      expect(agentService.registerSession).toHaveBeenCalled();

      // Parse SSE messages
      const messages = parseSSEMessages(response.sseMessages);

      // Should have session, text, result, and done messages
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // First message should be session with generated ID
      expect(messages[0].type).toBe("session");
      expect(messages[0].sessionId).toBeDefined();
      expect(typeof messages[0].sessionId).toBe("string");

      // Should have text message from mock
      const textMsg = messages.find((m) => m.type === "text");
      expect(textMsg).toBeDefined();
      expect(textMsg?.content).toBe("Hello from mock agent");

      // Should have result message
      const resultMsg = messages.find((m) => m.type === "result");
      expect(resultMsg).toBeDefined();
      expect(resultMsg?.subtype).toBe("success");

      // Should have done message
      const doneMsg = messages.find((m) => m.type === "done");
      expect(doneMsg).toBeDefined();

      // Stream should be ended
      expect(response.rawResponse?.end).toHaveBeenCalled();

      // Session should be unregistered in finally block
      expect(agentService.unregisterSession).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // POST /api/agent/stop/:sessionId Tests
  // ============================================================================

  describe("POST /api/agent/stop/:sessionId", () => {
    it("should stop a running session", async () => {
      const response = await fastify.inject({
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

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/stop/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Session not found");
    });
  });

  // ============================================================================
  // POST /api/agent/approve/:planId Tests
  // ============================================================================

  describe("POST /api/agent/approve/:planId", () => {
    it("should approve a pending plan", async () => {
      const response = await fastify.inject({
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

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/approve/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Plan not found");
    });
  });

  // ============================================================================
  // POST /api/agent/reject/:planId Tests
  // ============================================================================

  describe("POST /api/agent/reject/:planId", () => {
    it("should reject a pending plan", async () => {
      const response = await fastify.inject({
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

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/reject/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Plan not found");
    });
  });

  // ============================================================================
  // POST /api/agent/tasks/:taskId/stop Tests
  // ============================================================================

  describe("POST /api/agent/tasks/:taskId/stop", () => {
    it("should stop a background task", async () => {
      const response = await fastify.inject({
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

  // ============================================================================
  // GET /api/agent/session/:sessionId Tests
  // ============================================================================

  describe("GET /api/agent/session/:sessionId", () => {
    it("should return session runtime status", async () => {
      const response = await fastify.inject({
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

      const response = await fastify.inject({
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

      const response = await fastify.inject({
        method: "GET",
        url: "/api/agent/session/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Session not found");
    });
  });

  // ============================================================================
  // GET /api/agent/plan/:planId Tests
  // ============================================================================

  describe("GET /api/agent/plan/:planId", () => {
    it("should return plan info", async () => {
      const response = await fastify.inject({
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

      const response = await fastify.inject({
        method: "GET",
        url: "/api/agent/plan/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Plan not found");
    });
  });

  // ============================================================================
  // SSE Message Format Tests
  // ============================================================================

  describe("SSE Message Format", () => {
    it("should format SSE messages correctly", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      // Each message should start with "data: " and end with "\n\n"
      for (const msg of response.sseMessages) {
        expect(msg.startsWith("data: ")).toBe(true);
        expect(msg.endsWith("\n\n")).toBe(true);
      }
    });

    it("should include session message first", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      const messages = parseSSEMessages(response.sseMessages);
      expect(messages[0].type).toBe("session");
      expect(messages[0].sessionId).toBeDefined();
    });

    it("should include done message last", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      const messages = parseSSEMessages(response.sseMessages);
      expect(messages[messages.length - 1].type).toBe("done");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle SDK proxy errors gracefully", async () => {
      // Mock SDK proxy to throw error
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          throw new Error("SDK execution failed");
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      const messages = parseSSEMessages(response.sseMessages);

      // Should have session message
      expect(messages[0].type).toBe("session");

      // Should have error message
      const errorMsg = messages.find((m) => m.type === "error");
      expect(errorMsg).toBeDefined();
      expect(errorMsg?.message).toContain("SDK execution failed");

      // Should have done message
      const doneMsg = messages.find((m) => m.type === "done");
      expect(doneMsg).toBeDefined();

      // Session should still be unregistered
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
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          yield { type: "text", content: "Message 1" };
          yield { type: "text", content: "Message 2" };
          yield { type: "text", content: "Message 3" };
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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
  // Different SSE Message Types Tests
  // ============================================================================

  describe("SSE Message Types", () => {
    it("should stream tool_use messages", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          yield {
            type: "tool_use",
            id: "tool-123",
            name: "read_file",
            input: { path: "/test.txt" },
          };
          yield { type: "result", subtype: "success" };
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          yield {
            type: "tool_result",
            toolUseId: "tool-123",
            output: "File contents here",
            isError: false,
          };
          yield { type: "result", subtype: "success" };
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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

    it("should stream plan messages", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          yield {
            type: "plan",
            plan: {
              id: "plan-123",
              goal: "Implement feature",
              steps: [
                { id: "1", description: "Step 1", status: "pending" },
                { id: "2", description: "Step 2", status: "pending" },
              ],
              notes: "Additional notes",
            },
          };
          yield { type: "result", subtype: "success" };
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Create plan",
        },
      });

      const messages = parseSSEMessages(response.sseMessages);
      const planMsg = messages.find((m) => m.type === "plan");

      expect(planMsg).toBeDefined();
      expect(planMsg?.plan).toBeDefined();
      expect((planMsg?.plan as { id: string }).id).toBe("plan-123");
      expect((planMsg?.plan as { goal: string }).goal).toBe("Implement feature");
      expect((planMsg?.plan as { steps: unknown[] }).steps).toHaveLength(2);
    });

    it("should stream question messages", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
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
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Ask question",
        },
      });

      const messages = parseSSEMessages(response.sseMessages);
      const questionMsg = messages.find((m) => m.type === "question");

      expect(questionMsg).toBeDefined();
      expect(questionMsg?.id).toBe("question-123");
      expect(questionMsg?.questions).toBeDefined();
      expect((questionMsg?.questions as unknown[]).length).toBe(1);
    });

    it("should stream error messages from SDK", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          yield { type: "error", message: "Rate limit exceeded" };
        }),
      }) as never);

      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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
  // CORS Headers Tests
  // ============================================================================

  describe("CORS Headers", () => {
    it("should set CORS headers on SSE response", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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
      // Create a fresh fastify instance without origin header
      const noOriginFastify = createMockFastify();
      registerAgentRunRoutes(noOriginFastify as never);

      // Manually inject without origin
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
        body: { agentId: "CLAUDE_CODE", prompt: "Test" },
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
  // Request Parameters Tests
  // ============================================================================

  describe("Request Parameters", () => {
    it("should pass cwd parameter to SDK proxy", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      const mockExecuteStreaming = vi.fn(async function* () {
        yield { type: "text", content: "Done" };
        yield { type: "result", subtype: "success" };
      });
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: mockExecuteStreaming,
      }) as never);

      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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

    it("should pass model parameter to SDK proxy via agentConfig", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      const mockExecuteStreaming = vi.fn(async function* () {
        yield { type: "text", content: "Done" };
        yield { type: "result", subtype: "success" };
      });
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: mockExecuteStreaming,
      }) as never);

      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
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

    it("should pass generated sessionId to SDK proxy", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      const mockExecuteStreaming = vi.fn(async function* () {
        yield { type: "text", content: "Done" };
        yield { type: "result", subtype: "success" };
      });
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: mockExecuteStreaming,
      }) as never);

      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      expect(mockExecuteStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          // sessionId is now UUID format
          sessionId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        })
      );
    });

    it("should set dangerouslySkipPermissions to true", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      const mockExecuteStreaming = vi.fn(async function* () {
        yield { type: "text", content: "Done" };
        yield { type: "result", subtype: "success" };
      });
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: mockExecuteStreaming,
      }) as never);

      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      expect(mockExecuteStreaming).toHaveBeenCalledWith(
        expect.objectContaining({
          dangerouslySkipPermissions: true,
        })
      );
    });
  });

  // ============================================================================
  // GET /api/agent/tasks/subscribe Tests
  // ============================================================================

  describe("GET /api/agent/tasks/subscribe", () => {
    it("should set SSE headers and send initial tasks", async () => {
      // This route uses long-polling, so we test it by directly calling the handler
      // and simulating client disconnect
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

  // ============================================================================
  // Session Lifecycle Tests
  // ============================================================================

  describe("Session Lifecycle", () => {
    it("should register session at start", async () => {
      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "GEMINI",
          prompt: "Hello Gemini",
        },
      });

      expect(agentService.registerSession).toHaveBeenCalled();
    });

    it("should unregister session in finally block", async () => {
      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      expect(agentService.unregisterSession).toHaveBeenCalled();
    });

    it("should unregister session even on error", async () => {
      const { SdkChatProxy } = await import("../../executors/chat/sdk-proxy");
      vi.mocked(SdkChatProxy).mockImplementationOnce(() => ({
        executeStreaming: vi.fn(async function* () {
          throw new Error("Fatal error");
        }),
      }) as never);

      await fastify.inject({
        method: "POST",
        url: "/api/agent/run",
        payload: {
          agentId: "CLAUDE_CODE",
          prompt: "Test",
        },
      });

      expect(agentService.unregisterSession).toHaveBeenCalled();
    });
  });
});
