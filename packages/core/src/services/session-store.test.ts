/**
 * Session Store Service Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  SessionStoreService,
  createSessionConfig,
  createSessionConfigWithWorkspace,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  UIMessageHelpers,
} from "./session-store";

describe("SessionStoreService", () => {
  let service: SessionStoreService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-session-test-"));
    service = new SessionStoreService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createSession", () => {
    it("should create a new session", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "test-agent");
      await service.createSession(config);

      const loaded = await service.getSession("test-agent", sessionId);
      expect(loaded).not.toBeNull();
      expect(loaded?.agentId).toBe("test-agent");
    });

    it("should create session with workspace", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfigWithWorkspace(sessionId, "agent-1", "/workspace");
      await service.createSession(config);

      const loaded = await service.getSession("agent-1", sessionId);
      expect(loaded?.workspacePath).toBe("/workspace");
    });
  });

  describe("getSession", () => {
    it("should throw for non-existent session", async () => {
      await expect(
        service.getSession("agent", "non-existent")
      ).rejects.toThrow("Session not found");
    });

    it("should load existing session", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "my-agent");
      config.metadata = { key: "value" };
      await service.createSession(config);

      const loaded = await service.getSession("my-agent", sessionId);
      expect(loaded).toBeDefined();
      expect(loaded.metadata?.key).toBe("value");
    });
  });

  describe("listSessions", () => {
    it("should list all sessions for an agent", async () => {
      const config1 = createSessionConfig(randomUUID(), "agent-1");
      const config2 = createSessionConfig(randomUUID(), "agent-1");
      const config3 = createSessionConfig(randomUUID(), "agent-2");

      await service.createSession(config1);
      await service.createSession(config2);
      await service.createSession(config3);

      const sessions = await service.listSessions("agent-1");
      expect(sessions).toHaveLength(2);
    });

    it("should return empty array for agent with no sessions", async () => {
      const sessions = await service.listSessions("no-sessions");
      expect(sessions).toEqual([]);
    });
  });

  describe("deleteSession", () => {
    it("should delete a session", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "agent-1");
      await service.createSession(config);

      await service.deleteSession("agent-1", sessionId);

      // After deletion, getSession should throw
      await expect(
        service.getSession("agent-1", sessionId)
      ).rejects.toThrow("Session not found");
    });
  });

  describe("appendMessage", () => {
    it("should append rollout messages", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "agent-1");
      await service.createSession(config);

      await service.appendMessage("agent-1", sessionId, {
        role: "user",
        content: "Hello",
        timestamp: new Date().toISOString(),
      });

      await service.appendMessage("agent-1", sessionId, {
        role: "assistant",
        content: "Hi there!",
        timestamp: new Date().toISOString(),
      });

      const messages = await service.readMessages("agent-1", sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });
  });

  describe("appendUIMessage", () => {
    it("should append UI messages", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "agent-1");
      await service.createSession(config);

      await service.appendUIMessage(
        "agent-1",
        sessionId,
        UIMessageHelpers.text("msg-1", "Hello from user")
      );

      await service.appendUIMessage(
        "agent-1",
        sessionId,
        UIMessageHelpers.text("msg-2", "Response from agent")
      );

      const messages = await service.readUIMessages("agent-1", sessionId);
      expect(messages).toHaveLength(2);
    });

    it("should append tool use messages", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "agent-1");
      await service.createSession(config);

      await service.appendUIMessage(
        "agent-1",
        sessionId,
        UIMessageHelpers.toolUse("msg-1", "tool-1", "read_file", { path: "/test" })
      );

      const messages = await service.readUIMessages("agent-1", sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("tool_use");
    });

    it("should append tool result messages", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "agent-1");
      await service.createSession(config);

      await service.appendUIMessage(
        "agent-1",
        sessionId,
        UIMessageHelpers.toolResult("msg-1", "tool-1", "file content here", false)
      );

      const messages = await service.readUIMessages("agent-1", sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe("tool_result");
    });
  });

  describe("appendAgentMessage", () => {
    it("should append agent messages", async () => {
      const sessionId = randomUUID();
      const config = createSessionConfig(sessionId, "agent-1");
      await service.createSession(config);

      await service.appendAgentMessage("agent-1", sessionId, {
        timestamp: new Date().toISOString(),
        raw: { role: "assistant", content: "Agent response" },
        source: "claude_code",
      });

      const messages = await service.readAgentMessages("agent-1", sessionId);
      expect(messages).toHaveLength(1);
    });
  });
});

describe("Message Helpers", () => {
  describe("createUserMessage", () => {
    it("should create user message", () => {
      const msg = createUserMessage("Hello");
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello");
      expect(msg.timestamp).toBeDefined();
    });
  });

  describe("createAssistantMessage", () => {
    it("should create assistant message", () => {
      const msg = createAssistantMessage("Hi there");
      expect(msg.role).toBe("assistant");
      expect(msg.content).toBe("Hi there");
    });
  });

  describe("createSystemMessage", () => {
    it("should create system message", () => {
      const msg = createSystemMessage("System prompt");
      expect(msg.role).toBe("system");
      expect(msg.content).toBe("System prompt");
    });
  });
});

describe("UIMessageHelpers", () => {
  describe("text", () => {
    it("should create text message", () => {
      const msg = UIMessageHelpers.text("msg-1", "Hello");
      expect(msg.type).toBe("text");
      expect(msg.content).toBe("Hello");
      expect(msg.id).toBe("msg-1");
      expect(msg.timestamp).toBeDefined();
    });
  });

  describe("user", () => {
    it("should create user message", () => {
      const msg = UIMessageHelpers.user("msg-1", "User input");
      expect(msg.type).toBe("user");
      expect(msg.content).toBe("User input");
    });
  });

  describe("thinking", () => {
    it("should create thinking message", () => {
      const msg = UIMessageHelpers.thinking("msg-1", "Processing...");
      expect(msg.type).toBe("thinking");
      expect(msg.content).toBe("Processing...");
    });
  });

  describe("error", () => {
    it("should create error message", () => {
      const msg = UIMessageHelpers.error("msg-1", "Something went wrong");
      expect(msg.type).toBe("error");
      expect(msg.content).toBe("Something went wrong");
      expect(msg.isError).toBe(true);
    });
  });

  describe("toolUse", () => {
    it("should create tool use message", () => {
      const msg = UIMessageHelpers.toolUse(
        "msg-1",
        "tool-123",
        "read_file",
        { path: "/test.txt" }
      );
      expect(msg.type).toBe("tool_use");
      expect(msg.toolUseId).toBe("tool-123");
      expect(msg.toolName).toBe("read_file");
      expect(msg.toolInput).toEqual({ path: "/test.txt" });
    });
  });

  describe("toolResult", () => {
    it("should create tool result message", () => {
      const msg = UIMessageHelpers.toolResult(
        "msg-1",
        "tool-123",
        "File content",
        false
      );
      expect(msg.type).toBe("tool_result");
      expect(msg.toolUseId).toBe("tool-123");
      expect(msg.toolOutput).toBe("File content");
      expect(msg.isError).toBe(false);
    });

    it("should create error tool result message", () => {
      const msg = UIMessageHelpers.toolResult(
        "msg-1",
        "tool-123",
        "File not found",
        true
      );
      expect(msg.isError).toBe(true);
    });
  });
});
