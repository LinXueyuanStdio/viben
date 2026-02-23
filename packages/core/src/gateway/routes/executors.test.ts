/**
 * Executors Routes Tests
 *
 * Tests for executor session management endpoints:
 * - GET /api/executors - List available executors
 * - GET /api/executors/:type/discover-sessions - Discover sessions for executor type
 * - GET /api/executors/:type/sessions/:sessionId/messages - Read session messages
 *
 * Covers:
 * - Claude Code session discovery from ~/.claude/projects/<encoded-path>/*.jsonl
 * - Session metadata: id, executorType, workspacePath, createdAt, updatedAt, name, messageCount
 * - Message types: user, thinking, text, tool_use, tool_result
 * - Path encoding: /Users/foo/bar -> -Users-foo-bar
 * - Error handling: missing workspacePath, unknown executor type, missing session files
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerExecutorRoutes } from "./executors";

// Mock fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    promises: {
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
    },
    createReadStream: vi.fn(),
  };
});

// Mock os module
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/Users/test"),
}));

// Mock readline module
vi.mock("node:readline", () => ({
  createInterface: vi.fn(),
}));

import * as fs from "node:fs";
import * as os from "node:os";
import * as readline from "node:readline";

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
    get: vi.fn(
      (
        url: string,
        handler: (req: unknown, rep: MockReply) => Promise<unknown>
      ) => {
        routes.push({ method: "GET", url, handler });
      }
    ),
    post: vi.fn(
      (
        url: string,
        handler: (req: unknown, rep: MockReply) => Promise<unknown>
      ) => {
        routes.push({ method: "POST", url, handler });
      }
    ),
    delete: vi.fn(
      (
        url: string,
        handler: (req: unknown, rep: MockReply) => Promise<unknown>
      ) => {
        routes.push({ method: "DELETE", url, handler });
      }
    ),
    routes,
    // Helper to find and execute a route handler
    async inject(options: { method: string; url: string; payload?: unknown }) {
      const { method, url, payload } = options;
      const parsedUrl = new URL(url, "http://localhost");
      const pathname = parsedUrl.pathname;
      const searchParams = Object.fromEntries(parsedUrl.searchParams.entries());

      // Convert string params to appropriate types
      const query: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(searchParams)) {
        if (key === "limit" || key === "offset") {
          query[key] = parseInt(value, 10);
        } else if (value === "true") {
          query[key] = true;
        } else if (value === "false") {
          query[key] = false;
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

        // Check for parameterized match (e.g., /api/executors/:type/discover-sessions)
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

      try {
        const result = await matchingRoute.handler(request, reply);
        return {
          statusCode,
          body: JSON.stringify(result),
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        };
      }
    },
  };

  return fastify;
}

describe("Executors Routes", () => {
  let fastify: ReturnType<typeof createMockFastify>;

  beforeEach(() => {
    fastify = createMockFastify();
    registerExecutorRoutes(fastify as never);

    // Reset all mocks
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.promises.readdir).mockReset();
    vi.mocked(fs.promises.stat).mockReset();
    vi.mocked(fs.promises.readFile).mockReset();
    vi.mocked(fs.createReadStream).mockReset();
    vi.mocked(readline.createInterface).mockReset();
    vi.mocked(os.homedir).mockReturnValue("/Users/test");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // GET /api/executors - List Executors
  // ============================================================================

  describe("GET /api/executors", () => {
    it("should list available executors", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.executors).toBeDefined();
      expect(Array.isArray(body.executors)).toBe(true);
      expect(body.executors.length).toBeGreaterThan(0);
    });

    it("should return Claude Code as available executor", async () => {
      // Mock fs.existsSync to simulate Claude Code config exists
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        // Simulate ~/.claude directory exists
        return pathStr.includes(".claude");
      });

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      const claudeCode = body.executors.find(
        (e: { type: string }) => e.type === "CLAUDE_CODE"
      );

      expect(claudeCode).toBeDefined();
      expect(claudeCode.name).toBe("Claude Code");
      expect(claudeCode.available).toBe(true);
    });

    it("should use home directory as default workspace path", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe("/Users/test");
    });

    it("should accept custom workspace path via query parameter", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors?workspace_path=/Users/custom/project",
      });

      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe("/Users/custom/project");
    });

    it("should include include_global flag in response", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors?include_global=true",
      });

      const body = JSON.parse(response.body);
      expect(body.include_global).toBe(true);
    });

    it("should default include_global to true when not specified", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      expect(body.include_global).toBe(true);
    });
  });

  // ============================================================================
  // GET /api/executors/:type/discover-sessions - Discover Sessions
  // ============================================================================

  describe("GET /api/executors/:type/discover-sessions", () => {
    it("should return 400 when workspacePath is missing", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("workspace_path");
    });

    it("should return 404 for unknown executor type", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/unknown-executor/discover-sessions?workspace_path=/Users/test/project",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unknown executor type");
    });

    it("should return empty sessions when project directory does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("should discover Claude Code sessions from correct directory", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: "session-123.jsonl", isFile: () => true },
        { name: "session-456.jsonl", isFile: () => true },
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        birthtime: new Date("2024-01-15T10:00:00Z"),
        mtime: new Date("2024-01-15T12:00:00Z"),
        size: 2048,
      } as fs.Stats);

      // Mock readline for first user message extraction
      const mockRl = {
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({ type: "user", message: { content: "Hello" } });
        },
      };
      vi.mocked(fs.createReadStream).mockReturnValue({} as fs.ReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(
        mockRl as unknown as readline.Interface
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should encode workspace path correctly for Claude projects directory", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);

      await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/foo/bar",
      });

      // Verify existsSync was called with encoded path
      expect(fs.existsSync).toHaveBeenCalledWith(
        "/Users/test/.claude/projects/-Users-foo-bar"
      );
    });

    it("should return session metadata with correct fields", async () => {
      const birthtime = new Date("2024-01-15T10:00:00Z");
      const mtime = new Date("2024-01-15T14:00:00Z");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: "abc-def-123.jsonl", isFile: () => true },
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        birthtime,
        mtime,
        size: 5120,
      } as fs.Stats);

      // Mock readline for first user message
      const mockRl = {
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({
            type: "user",
            message: { content: "Create a new React component" },
          });
        },
      };
      vi.mocked(fs.createReadStream).mockReturnValue({} as fs.ReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(
        mockRl as unknown as readline.Interface
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      const body = JSON.parse(response.body);
      const session = body.sessions[0];

      expect(session.id).toBe("abc-def-123");
      expect(session.executor_type).toBe("CLAUDE_CODE");
      expect(session.workspace_path).toBe("/Users/test/project");
      expect(session.created_at).toBe(birthtime.toISOString());
      expect(session.updated_at).toBe(mtime.toISOString());
      expect(session.name).toBe("Create a new React component");
      expect(session.message_count).toBeDefined();
    });

    it("should sort sessions by updated_at descending (newest first)", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: "old-session.jsonl", isFile: () => true },
        { name: "new-session.jsonl", isFile: () => true },
      ] as unknown as fs.Dirent[]);

      let callCount = 0;
      vi.mocked(fs.promises.stat).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            birthtime: new Date("2024-01-10T10:00:00Z"),
            mtime: new Date("2024-01-10T12:00:00Z"),
            size: 1024,
          } as fs.Stats;
        }
        return {
          birthtime: new Date("2024-01-15T10:00:00Z"),
          mtime: new Date("2024-01-15T14:00:00Z"),
          size: 2048,
        } as fs.Stats;
      });

      // Mock readline
      const mockRl = {
        [Symbol.asyncIterator]: async function* () {
          yield "";
        },
      };
      vi.mocked(fs.createReadStream).mockReturnValue({} as fs.ReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(
        mockRl as unknown as readline.Interface
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      const body = JSON.parse(response.body);
      const sessions = body.sessions;

      // Newer session should be first
      expect(new Date(sessions[0].updated_at).getTime()).toBeGreaterThan(
        new Date(sessions[1].updated_at).getTime()
      );
    });

    it("should use CLAUDE_CODE as the standard executor type format", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Standard uppercase format should work
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });
      expect(response.statusCode).toBe(200);
    });

    it("should return empty sessions for CODEX executor (not yet implemented)", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CODEX/discover-sessions?workspace_path=/Users/test/project",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toEqual([]);
    });

    it("should truncate long session names to 100 characters", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: "session.jsonl", isFile: () => true },
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        birthtime: new Date(),
        mtime: new Date(),
        size: 1024,
      } as fs.Stats);

      const longMessage = "A".repeat(150);
      const mockRl = {
        [Symbol.asyncIterator]: async function* () {
          yield JSON.stringify({
            type: "user",
            message: { content: longMessage },
          });
        },
      };
      vi.mocked(fs.createReadStream).mockReturnValue({} as fs.ReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(
        mockRl as unknown as readline.Interface
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      const body = JSON.parse(response.body);
      const session = body.sessions[0];

      expect(session.name.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(session.name).toContain("...");
    });

    it("should skip non-jsonl files in session directory", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue([
        { name: "session.jsonl", isFile: () => true },
        { name: "notes.txt", isFile: () => true },
        { name: "backup", isFile: () => false },
      ] as unknown as fs.Dirent[]);
      vi.mocked(fs.promises.stat).mockResolvedValue({
        birthtime: new Date(),
        mtime: new Date(),
        size: 1024,
      } as fs.Stats);

      const mockRl = {
        [Symbol.asyncIterator]: async function* () {
          yield "";
        },
      };
      vi.mocked(fs.createReadStream).mockReturnValue({} as fs.ReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(
        mockRl as unknown as readline.Interface
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
      expect(body.sessions[0].id).toBe("session");
    });
  });

  // ============================================================================
  // GET /api/executors/:type/sessions/:sessionId/messages - Get Session Messages
  // ============================================================================

  describe("GET /api/executors/:type/sessions/:sessionId/messages", () => {
    it("should return 400 when workspacePath is missing", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("workspace_path");
    });

    it("should return 404 for unknown executor type", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/unknown/sessions/session-123/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unknown executor type");
    });

    it("should return messages from Claude Code session file", async () => {
      const sessionContent = [
        JSON.stringify({
          uuid: "msg-1",
          timestamp: "2024-01-15T10:00:00Z",
          type: "user",
          message: { content: "Hello" },
        }),
        JSON.stringify({
          uuid: "msg-2",
          timestamp: "2024-01-15T10:00:01Z",
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Hi there!" }],
          },
        }),
      ].join("\n");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test/project",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should convert user message type correctly", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: { content: "Create a test file" },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.id).toBe("msg-1");
      expect(message.timestamp).toBe("2024-01-15T10:00:00Z");
      expect(message.type).toBe("user");
      expect(message.content).toBe("Create a test file");
    });

    it("should convert thinking message type correctly", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [{ type: "thinking", thinking: "Let me analyze this..." }],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("thinking");
      expect(message.content).toBe("Let me analyze this...");
    });

    it("should convert text message type correctly", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Here is the solution" }],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("text");
      expect(message.content).toBe("Here is the solution");
    });

    it("should convert tool_use message type correctly", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool-123",
              name: "Read",
              input: { file_path: "/path/to/file.ts" },
            },
          ],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("tool_use");
      expect(message.tool_use_id).toBe("tool-123");
      expect(message.tool_name).toBe("Read");
      expect(message.tool_input).toEqual({ file_path: "/path/to/file.ts" });
    });

    it("should convert tool_result message type correctly", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-123",
              content: "File content here",
              is_error: false,
            },
          ],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("tool_result");
      expect(message.tool_use_id).toBe("tool-123");
      expect(message.content).toBe("File content here");
      expect(message.is_error).toBe(false);
    });

    it("should handle tool_result with error flag", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-456",
              content: "Permission denied",
              is_error: true,
            },
          ],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.is_error).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const lines = [];
      for (let i = 0; i < 10; i++) {
        lines.push(
          JSON.stringify({
            uuid: `msg-${i}`,
            timestamp: "2024-01-15T10:00:00Z",
            type: "user",
            message: { content: `Message ${i}` },
          })
        );
      }

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(lines.join("\n"));

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test&limit=3",
      });

      const body = JSON.parse(response.body);
      expect(body.messages.length).toBeLessThanOrEqual(3);
    });

    it("should map subagent_id from progress messages for Task tool", async () => {
      const sessionContent = [
        JSON.stringify({
          uuid: "msg-1",
          timestamp: "2024-01-15T10:00:00Z",
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                id: "task-tool-123",
                name: "Task",
                input: { description: "Do something" },
              },
            ],
          },
        }),
        JSON.stringify({
          type: "progress",
          parentToolUseID: "task-tool-123",
          data: {
            type: "agent_progress",
            agentId: "subagent-abc",
          },
        }),
      ].join("\n");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const taskMessage = body.messages.find(
        (m: { tool_name?: string }) => m.tool_name === "Task"
      );

      expect(taskMessage).toBeDefined();
      expect(taskMessage.subagent_id).toBe("subagent-abc");
    });

    it("should skip invalid JSON lines gracefully", async () => {
      const sessionContent = [
        JSON.stringify({
          uuid: "msg-1",
          timestamp: "2024-01-15T10:00:00Z",
          type: "user",
          message: { content: "Valid message" },
        }),
        "{ invalid json }",
        JSON.stringify({
          uuid: "msg-2",
          timestamp: "2024-01-15T10:00:01Z",
          type: "user",
          message: { content: "Another valid message" },
        }),
      ].join("\n");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
    });

    it("should skip empty lines", async () => {
      const sessionContent = [
        JSON.stringify({
          uuid: "msg-1",
          timestamp: "2024-01-15T10:00:00Z",
          type: "user",
          message: { content: "Message 1" },
        }),
        "",
        "   ",
        JSON.stringify({
          uuid: "msg-2",
          timestamp: "2024-01-15T10:00:01Z",
          type: "user",
          message: { content: "Message 2" },
        }),
      ].join("\n");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
    });

    it("should convert result message type correctly", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "result",
        result: "Task completed successfully",
        subtype: "success",
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("text");
      expect(message.content).toBe("Task completed successfully");
    });

    it("should skip progress, init, and other non-display message types", async () => {
      const sessionContent = [
        JSON.stringify({
          type: "init",
          timestamp: "2024-01-15T10:00:00Z",
        }),
        JSON.stringify({
          type: "progress",
          timestamp: "2024-01-15T10:00:01Z",
          data: { type: "some_progress" },
        }),
        JSON.stringify({
          uuid: "msg-1",
          timestamp: "2024-01-15T10:00:02Z",
          type: "user",
          message: { content: "Actual message" },
        }),
        JSON.stringify({
          type: "file-history-snapshot",
          timestamp: "2024-01-15T10:00:03Z",
        }),
      ].join("\n");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].content).toBe("Actual message");
    });

    it("should return empty messages for CODEX executor (not implemented)", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CODEX/sessions/session-123/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toEqual([]);
    });

    it("should handle multiple content blocks in assistant message", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "Analyzing..." },
            { type: "text", text: "Here is my response" },
            {
              type: "tool_use",
              id: "tool-1",
              name: "Bash",
              input: { command: "ls" },
            },
          ],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[0].type).toBe("thinking");
      expect(body.messages[1].type).toBe("text");
      expect(body.messages[2].type).toBe("tool_use");
    });

    it("should skip text blocks with empty text", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "" },
            { type: "text", text: "Valid text" },
          ],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].content).toBe("Valid text");
    });
  });

  // ============================================================================
  // Path Encoding Tests
  // ============================================================================

  describe("Path Encoding", () => {
    it("should encode /Users/foo/bar to -Users-foo-bar", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/foo/bar",
      });

      expect(fs.existsSync).toHaveBeenCalledWith(
        "/Users/test/.claude/projects/-Users-foo-bar"
      );
    });

    it("should encode root path / to -", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/",
      });

      expect(fs.existsSync).toHaveBeenCalledWith(
        "/Users/test/.claude/projects/-"
      );
    });

    it("should encode deep nested path correctly", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/home/user/projects/my-app/src",
      });

      expect(fs.existsSync).toHaveBeenCalledWith(
        "/Users/test/.claude/projects/-home-user-projects-my-app-src"
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle file system errors gracefully for session discovery", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockRejectedValue(
        new Error("Permission denied")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/Users/test/project",
      });

      expect(response.statusCode).toBe(500);
    });

    it("should handle missing session file when reading messages", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/nonexistent/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(500);
    });

    it("should handle file read errors for messages", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        new Error("File corrupted")
      );

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(500);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle user message with array content (tool_result)", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-1",
              content: "Result data",
            },
            {
              type: "tool_result",
              tool_use_id: "tool-2",
              content: "Another result",
            },
          ],
        },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].tool_use_id).toBe("tool-1");
      expect(body.messages[1].tool_use_id).toBe("tool-2");
    });

    it("should handle assistant message without content", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {},
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(0);
    });

    it("should handle user message without message field", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(0);
    });

    it("should generate UUID for messages without uuid field", async () => {
      const sessionContent = JSON.stringify({
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: { content: "No UUID message" },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages[0].id).toBeDefined();
      expect(typeof body.messages[0].id).toBe("string");
    });

    it("should use current timestamp when timestamp is missing", async () => {
      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        type: "user",
        message: { content: "No timestamp" },
      });

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(sessionContent);

      const response = await fastify.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=/Users/test",
      });

      const body = JSON.parse(response.body);
      expect(body.messages[0].timestamp).toBeDefined();
    });
  });

  // ============================================================================
  // Route Registration
  // ============================================================================

  describe("Route Registration", () => {
    it("should register GET /api/executors route", () => {
      expect(fastify.get).toHaveBeenCalled();
      const getCalls = fastify.get.mock.calls;
      const listRoute = getCalls.find((call) => call[0] === "/api/executors");
      expect(listRoute).toBeDefined();
    });

    it("should register GET /api/executors/:type/discover-sessions route", () => {
      const getCalls = fastify.get.mock.calls;
      const discoverRoute = getCalls.find(
        (call) => call[0] === "/api/executors/:type/discover-sessions"
      );
      expect(discoverRoute).toBeDefined();
    });

    it("should register GET /api/executors/:type/sessions/:sessionId/messages route", () => {
      const getCalls = fastify.get.mock.calls;
      const messagesRoute = getCalls.find(
        (call) => call[0] === "/api/executors/:type/sessions/:sessionId/messages"
      );
      expect(messagesRoute).toBeDefined();
    });
  });
});
