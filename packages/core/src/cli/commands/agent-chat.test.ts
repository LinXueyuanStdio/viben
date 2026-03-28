/**
 * Agent Chat Command Tests
 *
 * Tests for the `viben agent chat` subcommand which enables non-interactive
 * chat with an Agent using its configured executor.
 *
 * Based on spec: .trellis/spec/modules/cli/agent-chat.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";

// Use vi.hoisted to create state that's available during mock setup
const { mockState } = vi.hoisted(() => {
  type MockAgent = {
    id: string;
    name: string;
    executorType?: string;
    model?: string;
    mcpServers: string[];
    skills: string[];
    planMode: boolean;
    approvals: boolean;
    createdAt: string;
    updatedAt: string;
  };

  const state: {
    agents: MockAgent[];
    defaultAgent: string | undefined;
    memory: string;
    chatResult: { exitCode: number; error?: string };
    proxyType: "spawn" | "sdk";
    executeProxy: ReturnType<typeof vi.fn> | null;
  } = {
    agents: [],
    defaultAgent: undefined,
    memory: "",
    chatResult: { exitCode: 0 },
    proxyType: "spawn",
    executeProxy: null,
  };

  return { mockState: state };
});

// Mock agents module
vi.mock("../../agents", () => ({
  agentManager: {
    listAgents: vi.fn(() => Promise.resolve(mockState.agents)),
    getAgent: vi.fn((id: string) =>
      Promise.resolve(mockState.agents.find((a) => a.id === id) ?? null)
    ),
    createSession: vi.fn((agentId: string) =>
      Promise.resolve({
        id: "mock-session-id",
        agentId,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      })
    ),
  },
  templateManager: {
    list: vi.fn(() => Promise.resolve([])),
  },
  memoryManager: {
    getSessionStartupMemory: vi.fn(() => Promise.resolve(mockState.memory)),
    appendToDailyLog: vi.fn(() => Promise.resolve()),
  },
}));

// Mock config module
vi.mock("../../config", () => ({
  configManager: {
    getDefaultAgent: vi.fn(() => Promise.resolve(mockState.defaultAgent)),
    setDefaultAgent: vi.fn(),
  },
}));

// Mock executors module - includes ChatProxyFactory
vi.mock("../../executors", () => {
  const MOCK_EXECUTOR_TYPES = [
    "CLAUDE_CODE",
    "AMP",
    "GEMINI",
    "CODEX",
    "OPENCODE",
    "CURSOR_AGENT",
    "QWEN_CODE",
    "COPILOT",
    "DROID",
  ];

  const MOCK_CHAT_SUPPORTED_EXECUTORS = ["CLAUDE_CODE", "GEMINI", "CODEX"];

  return {
    EXECUTOR_TYPES: MOCK_EXECUTOR_TYPES,
    isExecutorType: vi.fn((type: string) => MOCK_EXECUTOR_TYPES.includes(type)),
    executorSupportsChat: vi.fn((type: string) =>
      MOCK_CHAT_SUPPORTED_EXECUTORS.includes(type)
    ),
    CHAT_SUPPORTED_EXECUTORS: MOCK_CHAT_SUPPORTED_EXECUTORS,
    createChatProxyAsync: vi.fn(() => {
      // Create a new execute mock for each call
      mockState.executeProxy = vi.fn(() => Promise.resolve(mockState.chatResult));
      return Promise.resolve({
        proxyType: mockState.proxyType,
        execute: mockState.executeProxy,
      });
    }),
    chatProxyFactory: {
      isSdkAvailable: vi.fn(() => mockState.proxyType === "sdk"),
    },
  };
});

// Import after mocks
import { registerAgentCommand } from "./agent";
import { agentManager, memoryManager } from "../../agents";
import { createChatProxyAsync } from "../../executors";

describe("agent chat command", () => {
  let program: Command;
  let consoleOutput: string[] = [];
  let consoleErrors: string[] = [];
  let exitCode: number | undefined;

  beforeEach(() => {
    // Reset state
    mockState.agents = [];
    mockState.defaultAgent = undefined;
    mockState.memory = "";
    mockState.chatResult = { exitCode: 0 };
    mockState.proxyType = "spawn";
    mockState.executeProxy = null;
    exitCode = undefined;

    // Setup program
    program = new Command();
    program.option("--json", "JSON output");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet output");
    registerAgentCommand(program);

    // Capture console output
    consoleOutput = [];
    consoleErrors = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args) => {
      consoleErrors.push(args.join(" "));
    });

    // Mock process.exit - store code and throw only for non-zero exit codes
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      if (code !== 0) {
        throw new Error(`process.exit(${code})`);
      }
      return undefined as never;
    });

    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runCommand = async (...args: string[]): Promise<void> => {
    await program.parseAsync(["node", "test", ...args]);
  };

  describe("basic functionality", () => {
    it("should run chat with specified agent", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          model: "claude-sonnet",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello");

      expect(exitCode).toBe(0);
      expect(agentManager.getAgent).toHaveBeenCalledWith("test-agent");
      expect(createChatProxyAsync).toHaveBeenCalledWith("CLAUDE_CODE", true);
    });

    it("should use default agent when -n not specified", async () => {
      mockState.agents = [
        {
          id: "default-agent",
          name: "Default Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockState.defaultAgent = "default-agent";

      await runCommand("agent", "chat", "-p", "Hello");

      expect(exitCode).toBe(0);
      expect(agentManager.getAgent).toHaveBeenCalledWith("default-agent");
    });

    it("should error when no agent specified and no default set", async () => {
      mockState.agents = [
        {
          id: "agent1",
          name: "Agent 1",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockState.defaultAgent = undefined;

      await expect(runCommand("agent", "chat", "-p", "Hello")).rejects.toThrow("process.exit(1)");

      expect(exitCode).toBe(1);
      expect(consoleErrors.some((e) => e.includes("No agent specified"))).toBe(true);
    });

    it("should error when agent not found", async () => {
      mockState.agents = [];

      await expect(runCommand("agent", "chat", "-n", "unknown-agent", "-p", "Hello")).rejects.toThrow("process.exit(1)");

      expect(exitCode).toBe(1);
      expect(consoleErrors.some((e) => e.includes("not found"))).toBe(true);
    });
  });

  describe("executor support", () => {
    it("should error when agent has no executor type", async () => {
      mockState.agents = [
        {
          id: "no-executor",
          name: "No Executor Agent",
          executorType: undefined,
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await expect(runCommand("agent", "chat", "-n", "no-executor", "-p", "Hello")).rejects.toThrow("process.exit(1)");

      expect(exitCode).toBe(1);
      expect(consoleErrors.some((e) => e.includes("no executor type"))).toBe(true);
    });

    it("should error when executor does not support chat", async () => {
      mockState.agents = [
        {
          id: "amp-agent",
          name: "AMP Agent",
          executorType: "AMP",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await expect(runCommand("agent", "chat", "-n", "amp-agent", "-p", "Hello")).rejects.toThrow("process.exit(1)");

      expect(exitCode).toBe(1);
      expect(consoleErrors.some((e) => e.includes("Chat not supported"))).toBe(true);
    });
  });

  describe("memory loading", () => {
    it("should load agent memory by default", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockState.memory = "# Agent Memory\nSome context here";

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello");

      expect(exitCode).toBe(0);
      expect(memoryManager.getSessionStartupMemory).toHaveBeenCalledWith("test-agent");

      // Verify memory was included in prompt
      expect(mockState.executeProxy).toHaveBeenCalled();
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].prompt).toContain("agent-memory");
      expect(executeCall[0].prompt).toContain("Agent Memory");
    });

    it("should skip memory loading with --no-memory", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--no-memory");

      expect(exitCode).toBe(0);
      expect(memoryManager.getSessionStartupMemory).not.toHaveBeenCalled();

      // Verify prompt doesn't include memory wrapper
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].prompt).not.toContain("agent-memory");
    });
  });

  describe("session management", () => {
    it("should create new session with --new-session", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--new-session");

      expect(exitCode).toBe(0);
      expect(agentManager.createSession).toHaveBeenCalledWith("test-agent");
    });

    it("should pass session ID with -s option", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "-s", "my-session");

      expect(exitCode).toBe(0);
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].session_id).toBe("my-session");
    });

    it("should pass resume with --resume option", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--resume", "old-session");

      expect(exitCode).toBe(0);
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].resume).toBe("old-session");
    });
  });

  describe("model override", () => {
    it("should override agent model with --model", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          model: "claude-sonnet",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--model", "claude-opus");

      expect(exitCode).toBe(0);
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].model).toBe("claude-opus");
    });

    it("should use agent model when --model not specified", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          model: "claude-sonnet",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello");

      expect(exitCode).toBe(0);
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].model).toBe("claude-sonnet");
    });
  });

  describe("proxy selection", () => {
    it("should prefer SDK by default", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello");

      expect(exitCode).toBe(0);
      expect(createChatProxyAsync).toHaveBeenCalledWith("CLAUDE_CODE", true);
    });

    it("should use spawn proxy with --no-sdk", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--no-sdk");

      expect(exitCode).toBe(0);
      expect(createChatProxyAsync).toHaveBeenCalledWith("CLAUDE_CODE", false);
    });
  });

  describe("JSON output", () => {
    it("should output JSON with --json flag", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("--json", "agent", "chat", "-n", "test-agent", "-p", "Hello");

      expect(exitCode).toBe(0);

      // Check that JSON was output
      const jsonOutput = consoleOutput.find((o) => o.includes('"success"'));
      expect(jsonOutput).toBeDefined();

      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.success).toBe(true);
      expect(parsed.agent_id).toBe("test-agent");
    });
  });

  describe("error handling", () => {
    it("should exit with non-zero code on chat error", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockState.chatResult = { exitCode: 1, error: "Chat failed" };

      await expect(runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello")).rejects.toThrow("process.exit(1)");

      expect(exitCode).toBe(1);
    });
  });

  describe("permissions", () => {
    it("should pass dangerouslySkipPermissions flag", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--dangerously-skip-permissions");

      expect(exitCode).toBe(0);
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].dangerouslySkipPermissions).toBe(true);
    });
  });

  describe("working directory", () => {
    it("should pass working directory with -C option", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "-C", "/tmp/project");

      expect(exitCode).toBe(0);
      const executeCall = (mockState.executeProxy as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(executeCall[0].cwd).toBe("/tmp/project");
    });
  });

  describe("post-processing", () => {
    it("should update daily log after successful chat", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello");

      expect(exitCode).toBe(0);
      expect(memoryManager.appendToDailyLog).toHaveBeenCalled();
      const logCall = (memoryManager.appendToDailyLog as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(logCall[0]).toBe("test-agent");
      expect(logCall[1].title).toBe("Chat session");
    });

    it("should not update daily log with --no-memory", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      await runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello", "--no-memory");

      expect(exitCode).toBe(0);
      expect(memoryManager.appendToDailyLog).not.toHaveBeenCalled();
    });

    it("should not update daily log on chat failure", async () => {
      mockState.agents = [
        {
          id: "test-agent",
          name: "Test Agent",
          executorType: "CLAUDE_CODE",
          mcpServers: [],
          skills: [],
          planMode: false,
          approvals: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockState.chatResult = { exitCode: 1, error: "Chat failed" };

      await expect(runCommand("agent", "chat", "-n", "test-agent", "-p", "Hello")).rejects.toThrow("process.exit(1)");

      expect(exitCode).toBe(1);
      expect(memoryManager.appendToDailyLog).not.toHaveBeenCalled();
    });
  });
});
