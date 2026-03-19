/**
 * Executors Routes Tests
 *
 * Tests for executor session management endpoints:
 * - GET /api/executors - List available executors
 * - GET /api/executors/:type/discover-sessions - Discover sessions for executor type
 * - GET /api/executors/:type/sessions/:sessionId/messages - Read session messages
 *
 * Uses real Fastify.inject() for HTTP route testing with mocked file system
 * for external executor session files (e.g., ~/.claude/projects/).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerExecutorRoutes } from "./executors";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import * as path from "node:path";

// Mock os.homedir() to return our temp directory
let mockHomeDir = "/Users/test";
vi.mock("node:os", async () => {
  const actual = await vi.importActual("node:os");
  return {
    ...actual,
    homedir: vi.fn(() => mockHomeDir),
  };
});

describe("Executors Routes", () => {
  let app: FastifyInstance;
  let tempDir: TempDirContext;

  beforeEach(async () => {
    // Create temp directory for test fixtures
    tempDir = await createTempDir("executors-test-");
    mockHomeDir = tempDir.root;

    // Create Fastify app and register routes
    app = Fastify({ logger: false });
    registerExecutorRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await tempDir.cleanup();
  });

  // ============================================================================
  // GET /api/executors - List Executors
  // ============================================================================

  describe("GET /api/executors", () => {
    it("should list available executors", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.executors).toBeDefined();
      expect(Array.isArray(body.executors)).toBe(true);
      expect(body.executors.length).toBeGreaterThan(0);
      expect(body.total).toBe(body.executors.length);
    });

    it("should return Claude Code as an available executor type", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      const claudeCode = body.executors.find(
        (e: { type: string }) => e.type === "CLAUDE_CODE"
      );

      expect(claudeCode).toBeDefined();
      expect(claudeCode.name).toBe("Claude Code");
      expect(claudeCode.capabilities).toContain("chat");
      expect(claudeCode.supports_mcp).toBe(true);
    });

    it("should detect Claude Code installation when .claude directory exists", async () => {
      // Create .claude directory
      await tempDir.mkdir(".claude");

      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      const claudeCode = body.executors.find(
        (e: { type: string }) => e.type === "CLAUDE_CODE"
      );

      expect(claudeCode.availability.type).toBe("INSTALLATION_FOUND");
    });

    it("should detect Claude Code login when credentials exist", async () => {
      // Create .claude directory with credentials
      await tempDir.mkdir(".claude");
      await tempDir.writeFile(".claude/.credentials.json", JSON.stringify({ token: "test" }));

      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      const claudeCode = body.executors.find(
        (e: { type: string }) => e.type === "CLAUDE_CODE"
      );

      expect(claudeCode.availability.type).toBe("LOGIN_DETECTED");
      expect(claudeCode.availability.last_auth_timestamp).toBeDefined();
    });

    it("should return NOT_FOUND availability when no config exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      const claudeCode = body.executors.find(
        (e: { type: string }) => e.type === "CLAUDE_CODE"
      );

      expect(claudeCode.availability.type).toBe("NOT_FOUND");
    });

    it("should use home directory as default workspace path", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe(tempDir.root);
    });

    it("should accept custom workspace path via query parameter", async () => {
      const customPath = "/custom/workspace/path";

      const response = await app.inject({
        method: "GET",
        url: `/api/executors?workspace_path=${encodeURIComponent(customPath)}`,
      });

      const body = JSON.parse(response.body);
      expect(body.workspace_path).toBe(customPath);
    });

    it("should include include_global flag in response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors?include_global=true",
      });

      const body = JSON.parse(response.body);
      expect(body.include_global).toBe(true);
    });

    it("should default include_global to true when not specified", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors",
      });

      const body = JSON.parse(response.body);
      expect(body.include_global).toBe(true);
    });

    it("should set include_global to false when explicitly specified", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors?include_global=false",
      });

      const body = JSON.parse(response.body);
      expect(body.include_global).toBe(false);
    });
  });

  // ============================================================================
  // GET /api/executors/:type/discover-sessions - Discover Sessions
  // ============================================================================

  describe("GET /api/executors/:type/discover-sessions", () => {
    it("should return 400 when workspace_path is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("workspace_path");
    });

    it("should return 404 for unknown executor type", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/UNKNOWN_EXECUTOR/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unknown executor type");
    });

    it("should return empty sessions when project directory does not exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("should discover Claude Code sessions from encoded project directory", async () => {
      // Create session files in the encoded project directory
      // Path encoding: /path/to/project -> -path-to-project
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(
        `${sessionDir}/session-123.jsonl`,
        JSON.stringify({ type: "user", message: { content: "Hello" } })
      );
      await tempDir.writeFile(
        `${sessionDir}/session-456.jsonl`,
        JSON.stringify({ type: "user", message: { content: "World" } })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should return session metadata with correct fields", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(
        `${sessionDir}/abc-def-123.jsonl`,
        JSON.stringify({
          type: "user",
          message: { content: "Create a new React component" },
        })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const session = body.sessions[0];

      expect(session.id).toBe("abc-def-123");
      expect(session.executor_type).toBe("CLAUDE_CODE");
      expect(session.workspace_path).toBe(tempDir.root);
      expect(session.created_at).toBeDefined();
      expect(session.updated_at).toBeDefined();
      expect(session.name).toBe("Create a new React component");
    });

    it("should sort sessions by updated_at descending (newest first)", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      await tempDir.mkdir(sessionDir);

      // Create old session first
      await tempDir.writeFile(
        `${sessionDir}/old-session.jsonl`,
        JSON.stringify({ type: "user", message: { content: "Old" } })
      );

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create new session
      await tempDir.writeFile(
        `${sessionDir}/new-session.jsonl`,
        JSON.stringify({ type: "user", message: { content: "New" } })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const sessions = body.sessions;

      expect(sessions.length).toBe(2);
      // Newer session should be first
      expect(new Date(sessions[0].updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(sessions[1].updated_at).getTime()
      );
    });

    it("should truncate long session names to 100 characters", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      await tempDir.mkdir(sessionDir);

      const longMessage = "A".repeat(150);
      await tempDir.writeFile(
        `${sessionDir}/session.jsonl`,
        JSON.stringify({
          type: "user",
          message: { content: longMessage },
        })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const session = body.sessions[0];

      expect(session.name.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(session.name).toContain("...");
    });

    it("should skip non-jsonl files in session directory", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(
        `${sessionDir}/session.jsonl`,
        JSON.stringify({ type: "user", message: { content: "Valid" } })
      );
      await tempDir.writeFile(`${sessionDir}/notes.txt`, "Not a session");
      await tempDir.mkdir(`${sessionDir}/backup`);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
      expect(body.sessions[0].id).toBe("session");
    });

    it("should return empty sessions for CODEX executor when no sessions exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CODEX/discover-sessions?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toEqual([]);
    });
  });

  // ============================================================================
  // GET /api/executors/:type/sessions/:sessionId/messages - Get Session Messages
  // ============================================================================

  describe("GET /api/executors/:type/sessions/:sessionId/messages", () => {
    it("should return 400 when workspace_path is missing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/sessions/session-123/messages",
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("workspace_path");
    });

    it("should return 404 for unknown executor type", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/UNKNOWN/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain("Unknown executor type");
    });

    it("should return messages from Claude Code session file", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it("should convert user message type correctly", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: { content: "Create a test file" },
      });

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.id).toBe("msg-1");
      expect(message.timestamp).toBe("2024-01-15T10:00:00Z");
      expect(message.type).toBe("user");
      expect(message.content).toBe("Create a test file");
    });

    it("should convert thinking message type correctly", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [{ type: "thinking", thinking: "Let me analyze this..." }],
        },
      });

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("thinking");
      expect(message.content).toBe("Let me analyze this...");
    });

    it("should convert text message type correctly", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Here is the solution" }],
        },
      });

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("text");
      expect(message.content).toBe("Here is the solution");
    });

    it("should convert tool_use message type correctly", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("tool_use");
      expect(message.tool_use_id).toBe("tool-123");
      expect(message.tool_name).toBe("Read");
      expect(message.tool_input).toEqual({ file_path: "/path/to/file.ts" });
    });

    it("should convert tool_result message type correctly", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("tool_result");
      expect(message.tool_use_id).toBe("tool-123");
      expect(message.content).toBe("File content here");
      expect(message.is_error).toBe(false);
    });

    it("should handle tool_result with error flag", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.is_error).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, lines.join("\n"));

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}&limit=3`,
      });

      const body = JSON.parse(response.body);
      expect(body.messages.length).toBeLessThanOrEqual(3);
    });

    it("should map subagent_id from progress messages for Task tool", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const taskMessage = body.messages.find(
        (m: { tool_name?: string }) => m.tool_name === "Task"
      );

      expect(taskMessage).toBeDefined();
      expect(taskMessage.subagent_id).toBe("subagent-abc");
    });

    it("should skip invalid JSON lines gracefully", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
    });

    it("should skip empty lines", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
    });

    it("should convert result message type correctly", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "result",
        result: "Task completed successfully",
        subtype: "success",
      });

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      const message = body.messages[0];

      expect(message.type).toBe("text");
      expect(message.content).toBe("Task completed successfully");
    });

    it("should skip progress, init, and other non-display message types", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].content).toBe("Actual message");
    });

    it("should return empty messages for CODEX executor when session does not exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CODEX/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toEqual([]);
    });

    it("should handle multiple content blocks in assistant message", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[0].type).toBe("thinking");
      expect(body.messages[1].type).toBe("text");
      expect(body.messages[2].type).toBe("tool_use");
    });

    it("should skip text blocks with empty text", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
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
    it("should encode workspace path correctly for Claude projects directory", async () => {
      // Create session in the correctly encoded path
      const testPath = "/Users/foo/bar";
      const encodedPath = testPath.replace(/\//g, "-"); // -Users-foo-bar

      await tempDir.mkdir(`.claude/projects/${encodedPath}`);
      await tempDir.writeFile(
        `.claude/projects/${encodedPath}/session.jsonl`,
        JSON.stringify({ type: "user", message: { content: "Test" } })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(testPath)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
    });

    it("should encode root path / to -", async () => {
      await tempDir.mkdir(".claude/projects/-");
      await tempDir.writeFile(
        ".claude/projects/-/session.jsonl",
        JSON.stringify({ type: "user", message: { content: "Root" } })
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=/",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
    });

    it("should encode deep nested path correctly", async () => {
      const deepPath = "/home/user/projects/my-app/src";
      const encodedPath = deepPath.replace(/\//g, "-");

      await tempDir.mkdir(`.claude/projects/${encodedPath}`);
      await tempDir.writeFile(
        `.claude/projects/${encodedPath}/session.jsonl`,
        JSON.stringify({ type: "user", message: { content: "Deep" } })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/discover-sessions?workspace_path=${encodeURIComponent(deepPath)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessions).toHaveLength(1);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle missing session file when reading messages", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/nonexistent/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(500);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle user message with array content (tool_result)", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

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

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].tool_use_id).toBe("tool-1");
      expect(body.messages[1].tool_use_id).toBe("tool-2");
    });

    it("should handle assistant message without content", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "assistant",
        message: {},
      });

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(0);
    });

    it("should handle user message without content", async () => {
      const encodedPath = tempDir.root.replace(/\//g, "-");
      const sessionDir = `.claude/projects/${encodedPath}`;

      const sessionContent = JSON.stringify({
        uuid: "msg-1",
        timestamp: "2024-01-15T10:00:00Z",
        type: "user",
        message: {},
      });

      await tempDir.mkdir(sessionDir);
      await tempDir.writeFile(`${sessionDir}/session-123.jsonl`, sessionContent);

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/sessions/session-123/messages?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages).toHaveLength(0);
    });
  });

  // ============================================================================
  // MCP Servers Tests
  // ============================================================================

  describe("GET /api/executors/:type/mcp-servers", () => {
    it("should return empty servers when no config exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/mcp-servers?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.servers).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("should read MCP servers from project .mcp.json", async () => {
      await tempDir.writeFile(
        ".mcp.json",
        JSON.stringify({
          mcpServers: {
            "test-server": {
              command: "node",
              args: ["server.js"],
            },
          },
        })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/mcp-servers?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.servers).toHaveLength(1);
      expect(body.servers[0].name).toBe("test-server");
      expect(body.servers[0].command).toBe("node");
    });

    it("should fallback to global .claude.json for MCP servers", async () => {
      await tempDir.writeFile(
        ".claude.json",
        JSON.stringify({
          mcpServers: {
            "global-server": {
              command: "global-mcp",
            },
          },
        })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/mcp-servers?workspace_path=/nonexistent/path`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.servers).toHaveLength(1);
      expect(body.servers[0].name).toBe("global-server");
    });
  });

  // ============================================================================
  // Skills Tests
  // ============================================================================

  describe("GET /api/executors/:type/skills", () => {
    it("should return empty skills when no config exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/skills?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.skills).toEqual([]);
      expect(body.total).toBe(0);
    });

    it("should read skills from skills.json", async () => {
      await tempDir.mkdir(".claude");
      await tempDir.writeFile(
        ".claude/skills.json",
        JSON.stringify({
          skills: [
            {
              id: "test-skill",
              name: "Test Skill",
              version: "1.0.0",
              source: "local",
            },
          ],
        })
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/skills?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.skills).toHaveLength(1);
      expect(body.skills[0].id).toBe("test-skill");
    });

    it("should scan skills folder for skill.md files", async () => {
      await tempDir.mkdir(".claude/skills/my-skill");
      await tempDir.writeFile(
        ".claude/skills/my-skill/skill.md",
        "---\nname: My Skill\ndescription: A test skill\n---\n\nSkill content"
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/skills?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.skills.length).toBeGreaterThanOrEqual(1);

      const mySkill = body.skills.find((s: { id: string }) => s.id === "my-skill");
      expect(mySkill).toBeDefined();
      expect(mySkill.name).toBe("My Skill");
    });
  });

  // ============================================================================
  // Subagents Tests (Agent Configs)
  // ============================================================================

  describe("GET /api/executors/:type/subagents", () => {
    it("should return empty configs when no directory exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/subagents?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configs).toEqual([]);
    });

    it("should read subagent configs from .claude/agents directory", async () => {
      await tempDir.mkdir(".claude/agents");
      await tempDir.writeFile(
        ".claude/agents/test-agent.md",
        "---\nname: Test Agent\ndescription: A test agent\n---\n\nYou are a helpful assistant."
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/subagents?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.configs).toHaveLength(1);
      expect(body.configs[0].id).toBe("test-agent");
      expect(body.configs[0].name).toBe("Test Agent");
    });
  });

  // ============================================================================
  // Commands Tests
  // ============================================================================

  describe("GET /api/executors/:type/commands", () => {
    it("should return empty commands when no directory exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/commands?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.commands).toEqual([]);
    });

    it("should read top-level commands from .claude/commands directory", async () => {
      await tempDir.mkdir(".claude/commands");
      await tempDir.writeFile(
        ".claude/commands/test-command.md",
        "# Test Command\n\nThis is a test command."
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/commands?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.commands).toHaveLength(1);
      expect(body.commands[0].id).toBe("test-command");
      expect(body.commands[0].namespace).toBe("");
    });

    it("should read namespaced commands from subdirectories", async () => {
      await tempDir.mkdir(".claude/commands/project");
      await tempDir.writeFile(
        ".claude/commands/project/build.md",
        "# Build Command\n\nBuild the project."
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/executors/CLAUDE_CODE/commands?workspace_path=${encodeURIComponent(tempDir.root)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.commands).toHaveLength(1);
      expect(body.commands[0].id).toBe("project/build");
      expect(body.commands[0].namespace).toBe("project");
      expect(body.commands[0].name).toBe("build");
    });
  });
});
