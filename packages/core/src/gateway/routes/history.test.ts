/**
 * History Routes Tests
 *
 * Comprehensive tests for the history REST API routes:
 * - GET /api/history - List all history entries with pagination and filtering
 * - GET /api/history/:id - Get specific history entry
 * - POST /api/history - Create new history entry
 * - DELETE /api/history/:id - Delete specific history entry
 * - DELETE /api/history - Clear all history (with optional agentId filter)
 *
 * Uses mock Fastify instance to test route handlers without real HTTP server.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerHistoryRoutes, HistoryEntry } from "./history";

/**
 * Mock Fastify instance for testing route handlers
 */
interface MockReply {
  code: ReturnType<typeof vi.fn>;
}

interface MockRouteHandler {
  method: string;
  url: string;
  handler: (request: unknown, reply: MockReply) => Promise<unknown>;
}

function createMockFastify() {
  const routes: MockRouteHandler[] = [];

  const fastify = {
    get: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "GET", url, handler });
    }),
    post: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "POST", url, handler });
    }),
    delete: vi.fn((url: string, handler: (req: unknown, rep: MockReply) => Promise<unknown>) => {
      routes.push({ method: "DELETE", url, handler });
    }),
    routes,
    // Helper to find and execute a route handler
    async inject(options: { method: string; url: string; payload?: unknown }) {
      const { method, url, payload } = options;
      const parsedUrl = new URL(url, "http://localhost");
      const pathname = parsedUrl.pathname;
      const searchParams = Object.fromEntries(parsedUrl.searchParams.entries());

      // Convert string params to numbers where applicable
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(searchParams)) {
        if (key === "limit" || key === "offset") {
          query[key] = parseInt(value, 10);
        } else {
          query[key] = value;
        }
      }

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

        // Check for parameterized match (e.g., /api/history/:id)
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
        };
      }

      // Create mock request and reply
      const request = {
        query,
        params,
        body: payload,
      };

      let statusCode = 200;
      const reply: MockReply = {
        code: vi.fn((code: number) => {
          statusCode = code;
          return reply;
        }),
      };

      const result = await matchingRoute.handler(request, reply);

      return {
        statusCode,
        body: JSON.stringify(result),
      };
    },
  };

  return fastify;
}

describe("History Routes", () => {
  let fastify: ReturnType<typeof createMockFastify>;

  /**
   * Helper to clear all history entries
   */
  async function clearHistory() {
    await fastify.inject({
      method: "DELETE",
      url: "/api/history",
    });
  }

  beforeEach(async () => {
    fastify = createMockFastify();
    registerHistoryRoutes(fastify as never);
    // Clear any leftover entries from previous tests
    await clearHistory();
  });

  // ============================================================================
  // GET /api/history - List History
  // ============================================================================

  describe("GET /api/history - List History", () => {
    it("should return empty list when no history entries exist", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.limit).toBe(100);
      expect(body.offset).toBe(0);
    });

    it("should return all history entries", async () => {
      // Create some entries
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "echo 'hello'" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "ls -la" },
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should sort entries by timestamp descending (newest first)", async () => {
      // Create entries with small delays to ensure different timestamps
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "first command" },
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "second command" },
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2);
      // Newest first
      expect(body.entries[0].command).toBe("second command");
      expect(body.entries[1].command).toBe("first command");
    });

    it("should support pagination with limit parameter", async () => {
      // Create 5 entries
      for (let i = 1; i <= 5; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `command-${i}` },
        });
      }

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history?limit=2",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2);
      expect(body.total).toBe(5);
      expect(body.limit).toBe(2);
      expect(body.offset).toBe(0);
    });

    it("should support pagination with offset parameter", async () => {
      // Create 5 entries
      for (let i = 1; i <= 5; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `command-${i}` },
        });
      }

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history?offset=2&limit=2",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2);
      expect(body.total).toBe(5);
      expect(body.offset).toBe(2);
    });

    it("should support filtering by agentId", async () => {
      // Create entries for different agents
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "agent1-cmd", agentId: "agent-1" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "agent2-cmd", agentId: "agent-2" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "agent1-cmd-2", agentId: "agent-1" },
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history?agentId=agent-1",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2);
      expect(body.total).toBe(2);
      body.entries.forEach((entry: HistoryEntry) => {
        expect(entry.agentId).toBe("agent-1");
      });
    });

    it("should combine pagination and filtering", async () => {
      // Create 5 entries for agent-1
      for (let i = 1; i <= 5; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `agent1-cmd-${i}`, agentId: "agent-1" },
        });
      }
      // Create 3 entries for agent-2
      for (let i = 1; i <= 3; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `agent2-cmd-${i}`, agentId: "agent-2" },
        });
      }

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history?agentId=agent-1&limit=2&offset=1",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toHaveLength(2);
      expect(body.total).toBe(5);
      expect(body.limit).toBe(2);
      expect(body.offset).toBe(1);
    });

    it("should return empty array when filtering by non-existent agentId", async () => {
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "test", agentId: "agent-1" },
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history?agentId=non-existent",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("should use default limit of 100", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(100);
    });

    it("should use default offset of 0", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.offset).toBe(0);
    });
  });

  // ============================================================================
  // GET /api/history/:id - Get History Entry
  // ============================================================================

  describe("GET /api/history/:id - Get History Entry", () => {
    it("should return a specific history entry by id", async () => {
      // Create an entry
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: {
          command: "echo 'test'",
          agentId: "test-agent",
          workspacePath: "/path/to/workspace",
          exitCode: 0,
          duration: 100,
        },
      });

      const createdEntry = JSON.parse(createResponse.body);

      // Get the entry
      const response = await fastify.inject({
        method: "GET",
        url: `/api/history/${createdEntry.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(createdEntry.id);
      expect(body.command).toBe("echo 'test'");
      expect(body.agentId).toBe("test-agent");
      expect(body.workspacePath).toBe("/path/to/workspace");
      expect(body.exitCode).toBe(0);
      expect(body.duration).toBe(100);
    });

    it("should return 404 for non-existent entry", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/history/non-existent-id-12345",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("History entry not found");
      expect(body.error).toContain("non-existent-id-12345");
    });
  });

  // ============================================================================
  // POST /api/history - Create History Entry
  // ============================================================================

  describe("POST /api/history - Create History Entry", () => {
    it("should create a new history entry with auto-generated id", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "npm install" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(typeof body.id).toBe("string");
      // UUID format check
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should create a new history entry with auto-generated timestamp", async () => {
      const beforeCreate = new Date().toISOString();

      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "npm install" },
      });

      const afterCreate = new Date().toISOString();

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.timestamp).toBeDefined();
      // Timestamp should be within the time window
      expect(body.timestamp >= beforeCreate).toBe(true);
      expect(body.timestamp <= afterCreate).toBe(true);
    });

    it("should create entry with all fields", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: {
          command: "git status",
          agentId: "main-agent",
          workspacePath: "/home/user/project",
          exitCode: 0,
          duration: 50,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.command).toBe("git status");
      expect(body.agentId).toBe("main-agent");
      expect(body.workspacePath).toBe("/home/user/project");
      expect(body.exitCode).toBe(0);
      expect(body.duration).toBe(50);
    });

    it("should create entry with only required command field", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "whoami" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.command).toBe("whoami");
      expect(body.agentId).toBeUndefined();
      expect(body.workspacePath).toBeUndefined();
      expect(body.exitCode).toBeUndefined();
      expect(body.duration).toBeUndefined();
    });

    it("should return 400 for missing command", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { agentId: "test-agent" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Command is required");
    });

    it("should return 400 for empty command", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "" },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Command is required");
    });

    it("should return 400 for empty payload", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe("Command is required");
    });

    it("should handle commands with special characters", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "echo 'hello|world' && cat file.txt | grep 'test'" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.command).toBe("echo 'hello|world' && cat file.txt | grep 'test'");
    });

    it("should handle commands with newlines", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "echo 'line1\nline2\nline3'" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.command).toBe("echo 'line1\nline2\nline3'");
    });

    it("should handle commands with unicode characters", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "echo '你好世界'" },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.command).toBe("echo '你好世界'");
    });

    it("should accept negative exit codes", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "kill -9 process", exitCode: -9 },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.exitCode).toBe(-9);
    });

    it("should accept zero duration", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "true", duration: 0 },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.duration).toBe(0);
    });
  });

  // ============================================================================
  // DELETE /api/history/:id - Delete History Entry
  // ============================================================================

  describe("DELETE /api/history/:id - Delete History Entry", () => {
    it("should delete a specific history entry", async () => {
      // Create an entry
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "rm -rf /tmp/test" },
      });
      const createdEntry = JSON.parse(createResponse.body);

      // Delete the entry
      const deleteResponse = await fastify.inject({
        method: "DELETE",
        url: `/api/history/${createdEntry.id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);
      const body = JSON.parse(deleteResponse.body);
      expect(body.deleted).toBe(createdEntry.id);

      // Verify it's deleted
      const getResponse = await fastify.inject({
        method: "GET",
        url: `/api/history/${createdEntry.id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 404 when deleting non-existent entry", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/history/non-existent-id-67890",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("History entry not found");
      expect(body.error).toContain("non-existent-id-67890");
    });

    it("should not affect other entries when deleting one", async () => {
      // Create two entries
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "first" },
      });
      const secondResponse = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "second" },
      });
      const secondEntry = JSON.parse(secondResponse.body);

      // Delete the second entry
      await fastify.inject({
        method: "DELETE",
        url: `/api/history/${secondEntry.id}`,
      });

      // Verify first entry still exists
      const listResponse = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      const body = JSON.parse(listResponse.body);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].command).toBe("first");
    });
  });

  // ============================================================================
  // DELETE /api/history - Clear History
  // ============================================================================

  describe("DELETE /api/history - Clear History", () => {
    it("should clear all history entries", async () => {
      // Create some entries
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "cmd1" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "cmd2" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "cmd3" },
      });

      // Clear all
      const clearResponse = await fastify.inject({
        method: "DELETE",
        url: "/api/history",
      });

      expect(clearResponse.statusCode).toBe(200);
      const body = JSON.parse(clearResponse.body);
      expect(body.cleared).toBe(3);
      expect(body.agentId).toBeUndefined();

      // Verify all cleared
      const listResponse = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.entries).toEqual([]);
      expect(listBody.total).toBe(0);
    });

    it("should return cleared count of 0 when no entries exist", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.cleared).toBe(0);
    });

    it("should clear only entries for specified agentId", async () => {
      // Create entries for different agents
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "agent1-cmd1", agentId: "agent-1" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "agent1-cmd2", agentId: "agent-1" },
      });
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "agent2-cmd", agentId: "agent-2" },
      });

      // Clear only agent-1 entries
      const clearResponse = await fastify.inject({
        method: "DELETE",
        url: "/api/history?agentId=agent-1",
      });

      expect(clearResponse.statusCode).toBe(200);
      const body = JSON.parse(clearResponse.body);
      expect(body.cleared).toBe(2);
      expect(body.agentId).toBe("agent-1");

      // Verify agent-2 entries still exist
      const listResponse = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.entries).toHaveLength(1);
      expect(listBody.entries[0].agentId).toBe("agent-2");
    });

    it("should return cleared count of 0 when filtering by non-existent agentId", async () => {
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "test", agentId: "existing-agent" },
      });

      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/history?agentId=non-existent",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.cleared).toBe(0);
      expect(body.agentId).toBe("non-existent");
    });

    it("should include agentId in response when filtering", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/history?agentId=test-agent",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agentId).toBe("test-agent");
    });

    it("should not include agentId in response when not filtering", async () => {
      const response = await fastify.inject({
        method: "DELETE",
        url: "/api/history",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.agentId).toBeUndefined();
    });
  });

  // ============================================================================
  // History Entry Structure
  // ============================================================================

  describe("History Entry Structure", () => {
    it("should have correct structure with all fields", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: {
          command: "test command",
          agentId: "test-agent",
          workspacePath: "/workspace",
          exitCode: 0,
          duration: 100,
        },
      });

      const entry = JSON.parse(createResponse.body);

      // Check required fields
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("command");
      expect(entry).toHaveProperty("timestamp");

      // Check optional fields
      expect(entry).toHaveProperty("agentId");
      expect(entry).toHaveProperty("workspacePath");
      expect(entry).toHaveProperty("exitCode");
      expect(entry).toHaveProperty("duration");

      // Check types
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.command).toBe("string");
      expect(typeof entry.timestamp).toBe("string");
      expect(typeof entry.agentId).toBe("string");
      expect(typeof entry.workspacePath).toBe("string");
      expect(typeof entry.exitCode).toBe("number");
      expect(typeof entry.duration).toBe("number");
    });

    it("should have id in UUID format", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "test" },
      });

      const entry = JSON.parse(response.body);
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should have timestamp in ISO format", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "test" },
      });

      const entry = JSON.parse(response.body);
      // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      // Should be parseable as date
      expect(new Date(entry.timestamp).toString()).not.toBe("Invalid Date");
    });

    it("should allow optional fields to be undefined", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "minimal entry" },
      });

      const entry = JSON.parse(response.body);
      expect(entry.agentId).toBeUndefined();
      expect(entry.workspacePath).toBeUndefined();
      expect(entry.exitCode).toBeUndefined();
      expect(entry.duration).toBeUndefined();
    });

    it("should preserve entry structure through get operation", async () => {
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: {
          command: "preserved command",
          agentId: "preserved-agent",
          workspacePath: "/preserved/path",
          exitCode: 42,
          duration: 999,
        },
      });
      const created = JSON.parse(createResponse.body);

      const getResponse = await fastify.inject({
        method: "GET",
        url: `/api/history/${created.id}`,
      });
      const retrieved = JSON.parse(getResponse.body);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.command).toBe(created.command);
      expect(retrieved.timestamp).toBe(created.timestamp);
      expect(retrieved.agentId).toBe(created.agentId);
      expect(retrieved.workspacePath).toBe(created.workspacePath);
      expect(retrieved.exitCode).toBe(created.exitCode);
      expect(retrieved.duration).toBe(created.duration);
    });

    it("should preserve entry structure through list operation", async () => {
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: {
          command: "list test",
          agentId: "list-agent",
          exitCode: 1,
        },
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      const body = JSON.parse(response.body);

      expect(body.entries).toHaveLength(1);
      const entry = body.entries[0];
      expect(entry.command).toBe("list test");
      expect(entry.agentId).toBe("list-agent");
      expect(entry.exitCode).toBe(1);
    });
  });

  // ============================================================================
  // Integration Scenarios
  // ============================================================================

  describe("Integration Scenarios", () => {
    it("should handle complete CRUD lifecycle", async () => {
      // Create
      const createResponse = await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "lifecycle test", agentId: "crud-agent" },
      });
      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);

      // Read
      const readResponse = await fastify.inject({
        method: "GET",
        url: `/api/history/${created.id}`,
      });
      expect(readResponse.statusCode).toBe(200);
      const read = JSON.parse(readResponse.body);
      expect(read.id).toBe(created.id);

      // List
      const listResponse = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      expect(listResponse.statusCode).toBe(200);
      const list = JSON.parse(listResponse.body);
      expect(list.entries).toHaveLength(1);

      // Delete
      const deleteResponse = await fastify.inject({
        method: "DELETE",
        url: `/api/history/${created.id}`,
      });
      expect(deleteResponse.statusCode).toBe(200);

      // Verify deleted
      const verifyResponse = await fastify.inject({
        method: "GET",
        url: `/api/history/${created.id}`,
      });
      expect(verifyResponse.statusCode).toBe(404);
    });

    it("should handle multiple agents with separate histories", async () => {
      // Create entries for agent-1
      for (let i = 1; i <= 3; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `agent1-cmd-${i}`, agentId: "agent-1" },
        });
      }

      // Create entries for agent-2
      for (let i = 1; i <= 2; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `agent2-cmd-${i}`, agentId: "agent-2" },
        });
      }

      // Verify agent-1 history
      const agent1Response = await fastify.inject({
        method: "GET",
        url: "/api/history?agentId=agent-1",
      });
      const agent1 = JSON.parse(agent1Response.body);
      expect(agent1.total).toBe(3);

      // Verify agent-2 history
      const agent2Response = await fastify.inject({
        method: "GET",
        url: "/api/history?agentId=agent-2",
      });
      const agent2 = JSON.parse(agent2Response.body);
      expect(agent2.total).toBe(2);

      // Verify total
      const allResponse = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      const all = JSON.parse(allResponse.body);
      expect(all.total).toBe(5);
    });

    it("should handle pagination through large history", async () => {
      // Create 15 entries
      for (let i = 1; i <= 15; i++) {
        await fastify.inject({
          method: "POST",
          url: "/api/history",
          payload: { command: `cmd-${i}` },
        });
      }

      // Page 1
      const page1 = await fastify.inject({
        method: "GET",
        url: "/api/history?limit=5&offset=0",
      });
      const p1 = JSON.parse(page1.body);
      expect(p1.entries).toHaveLength(5);
      expect(p1.total).toBe(15);

      // Page 2
      const page2 = await fastify.inject({
        method: "GET",
        url: "/api/history?limit=5&offset=5",
      });
      const p2 = JSON.parse(page2.body);
      expect(p2.entries).toHaveLength(5);

      // Page 3
      const page3 = await fastify.inject({
        method: "GET",
        url: "/api/history?limit=5&offset=10",
      });
      const p3 = JSON.parse(page3.body);
      expect(p3.entries).toHaveLength(5);

      // Page 4 (past the end)
      const page4 = await fastify.inject({
        method: "GET",
        url: "/api/history?limit=5&offset=15",
      });
      const p4 = JSON.parse(page4.body);
      expect(p4.entries).toHaveLength(0);
    });

    it("should handle entries without agentId separately", async () => {
      // Create entries with agentId
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "with-agent", agentId: "my-agent" },
      });

      // Create entries without agentId
      await fastify.inject({
        method: "POST",
        url: "/api/history",
        payload: { command: "without-agent" },
      });

      // Filter by agentId should not include entries without agentId
      const filteredResponse = await fastify.inject({
        method: "GET",
        url: "/api/history?agentId=my-agent",
      });
      const filtered = JSON.parse(filteredResponse.body);
      expect(filtered.total).toBe(1);
      expect(filtered.entries[0].command).toBe("with-agent");

      // Total should include both
      const allResponse = await fastify.inject({
        method: "GET",
        url: "/api/history",
      });
      const all = JSON.parse(allResponse.body);
      expect(all.total).toBe(2);
    });
  });

  // ============================================================================
  // Route Registration
  // ============================================================================

  describe("Route Registration", () => {
    it("should register GET /api/history route", () => {
      expect(fastify.get).toHaveBeenCalled();
      const getCalls = fastify.get.mock.calls;
      const listRoute = getCalls.find((call) => call[0] === "/api/history");
      expect(listRoute).toBeDefined();
    });

    it("should register GET /api/history/:id route", () => {
      const getCalls = fastify.get.mock.calls;
      const getByIdRoute = getCalls.find((call) => call[0] === "/api/history/:id");
      expect(getByIdRoute).toBeDefined();
    });

    it("should register POST /api/history route", () => {
      expect(fastify.post).toHaveBeenCalled();
      const postCalls = fastify.post.mock.calls;
      const createRoute = postCalls.find((call) => call[0] === "/api/history");
      expect(createRoute).toBeDefined();
    });

    it("should register DELETE /api/history/:id route", () => {
      expect(fastify.delete).toHaveBeenCalled();
      const deleteCalls = fastify.delete.mock.calls;
      const deleteByIdRoute = deleteCalls.find((call) => call[0] === "/api/history/:id");
      expect(deleteByIdRoute).toBeDefined();
    });

    it("should register DELETE /api/history route", () => {
      const deleteCalls = fastify.delete.mock.calls;
      const clearRoute = deleteCalls.find((call) => call[0] === "/api/history");
      expect(clearRoute).toBeDefined();
    });
  });
});
