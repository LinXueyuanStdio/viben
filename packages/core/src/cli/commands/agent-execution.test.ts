/**
 * Agent Command Execution Tests
 *
 * Tests that actually execute agent commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements agent.test.ts which uses mocked managers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerAgentCommand } from "./agent";
import {
  createTempDir,
  type TempDirContext,
} from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";

// =============================================================================
// Test Setup
// =============================================================================

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
    dim: (s: string) => s,
    white: (s: string) => s,
    magenta: (s: string) => s,
  },
}));

// Store original process.exit and VIBEN_STATE_DIR
const originalExit = process.exit;
const originalVibenStateDir = process.env.VIBEN_STATE_DIR;
let exitCode: number | undefined;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext;
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
  /** Create an agent AGENTS.md config file directly */
  createAgentConfig: (
    agentId: string,
    config: Record<string, unknown>,
    systemPrompt?: string
  ) => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("viben-agent-exec-");

  // Create agents directory
  await tempDir.mkdir("agents");

  // Set VIBEN_STATE_DIR to redirect agent storage to temp directory
  process.env.VIBEN_STATE_DIR = tempDir.root;

  // Mock process.exit to capture exit code instead of actually exiting
  exitCode = undefined;
  process.exit = vi.fn((code?: string | number | null | undefined) => {
    exitCode = typeof code === "number" ? code : 0;
    throw new Error(`process.exit unexpectedly called with "${code}"`);
  }) as never;

  const program = new Command();
  program.option("--json", "Output JSON format");
  program.option("--verbose", "Verbose output");
  program.option("--quiet", "Quiet mode");

  // Prevent commander from calling process.exit
  program.exitOverride();

  registerAgentCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,

    async createAgentConfig(
      agentId: string,
      config: Record<string, unknown>,
      systemPrompt = ""
    ) {
      // Create agent directory
      await tempDir.mkdir(`agents/${agentId}`);
      await tempDir.mkdir(`agents/${agentId}/.agent_sessions`);
      await tempDir.mkdir(`agents/${agentId}/memory`);

      // Create AGENTS.md with YAML frontmatter
      const now = new Date().toISOString();
      const frontmatter = {
        name: config.name || agentId,
        createdAt: config.created_at || now,
        updatedAt: config.updated_at || now,
        mcpServers: config.mcpServers || [],
        skills: config.skills || [],
        approval_mode: config.approval_mode ?? "rules",
        ...config,
      };

      // Build YAML frontmatter
      const yamlLines = ["---"];
      for (const [key, value] of Object.entries(frontmatter)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          yamlLines.push(`${key}:`);
          for (const item of value) {
            yamlLines.push(`  - ${item}`);
          }
        } else if (typeof value === "object" && value !== null) {
          yamlLines.push(`${key}: ${JSON.stringify(value)}`);
        } else if (typeof value === "string" && value.includes("\n")) {
          yamlLines.push(`${key}: |`);
          for (const line of value.split("\n")) {
            yamlLines.push(`  ${line}`);
          }
        } else {
          yamlLines.push(`${key}: ${JSON.stringify(value)}`);
        }
      }
      yamlLines.push("---");
      yamlLines.push("");
      yamlLines.push(systemPrompt);

      await tempDir.writeFile(`agents/${agentId}/AGENTS.md`, yamlLines.join("\n"));
    },

    async run(args: string[]) {
      try {
        await program.parseAsync(["node", "test", ...args]);
      } catch (error) {
        // Commander throws on exitOverride, but we can ignore it
        // Also ignore process.exit mock errors
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
    },

    async runJson(args: string[]) {
      try {
        await program.parseAsync(["node", "test", "--json", ...args]);
      } catch (error) {
        const errorMessage = (error as Error).message || "";
        if (
          (error as Error).name !== "CommanderError" &&
          !errorMessage.includes("process.exit")
        ) {
          throw error;
        }
      }
      const lastLog = consoleSpy.getLastLog();
      if (lastLog) {
        try {
          return JSON.parse(lastLog);
        } catch {
          return null;
        }
      }
      return null;
    },

    async cleanup() {
      consoleSpy.cleanup();
      await tempDir.cleanup();
      vi.clearAllMocks();
      // Restore process.exit and VIBEN_STATE_DIR
      process.exit = originalExit;
      if (originalVibenStateDir !== undefined) {
        process.env.VIBEN_STATE_DIR = originalVibenStateDir;
      } else {
        delete process.env.VIBEN_STATE_DIR;
      }
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("agent command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // agent list execution
  // ===========================================================================

  describe("agent list", () => {
    it("should show message when no agents exist", async () => {
      await ctx.run(["agent", "list"]);

      // Check that console output indicates no agents
      expect(ctx.console.hasLog("No agents found")).toBe(true);
    });

    it("should list agents from config", async () => {
      await ctx.createAgentConfig("main", {
        name: "Main Agent",
        model: "claude-sonnet-4",
        executorType: "CLAUDE_CODE",
      });
      await ctx.createAgentConfig("coder", {
        name: "Coder Agent",
        model: "claude-sonnet-4",
        executorType: "CLAUDE_CODE",
      });

      await ctx.run(["agent", "list"]);

      expect(ctx.console.hasLog("main")).toBe(true);
      expect(ctx.console.hasLog("coder")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.createAgentConfig("test-agent", {
        name: "Test Agent",
        model: "claude-sonnet-4",
      });

      const result = (await ctx.runJson(["agent", "list"])) as {
        success: boolean;
        data: { agents: Array<{ id: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.agents).toBeDefined();
      expect(result?.data?.agents.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // agent create execution
  // ===========================================================================

  describe("agent create", () => {
    it("should create agent config file", async () => {
      await ctx.run(["agent", "create", "My New Agent"]);

      // Verify agent directory was created
      const files = await ctx.tempDir.listFiles("agents");
      const agentDirs = files.filter((f) => f.includes("my-new-agent"));
      expect(agentDirs.length).toBeGreaterThan(0);

      // Verify AGENTS.md was created
      const agentsConfigExists = await ctx.tempDir.exists(
        `agents/${agentDirs[0]}/AGENTS.md`
      );
      expect(agentsConfigExists).toBe(true);
    });

    it("should create agent with model option", async () => {
      await ctx.run([
        "agent",
        "create",
        "Model Agent",
        "--model",
        "claude-sonnet-4",
      ]);

      const files = await ctx.tempDir.listFiles("agents");
      const agentDirs = files.filter((f) => f.includes("model-agent"));
      expect(agentDirs.length).toBeGreaterThan(0);

      const content = await ctx.tempDir.readFile(
        `agents/${agentDirs[0]}/AGENTS.md`
      );
      expect(content).toContain("claude-sonnet-4");
    });

    it("should create agent with executor type", async () => {
      await ctx.run([
        "agent",
        "create",
        "Executor Agent",
        "--executor-type",
        "CLAUDE_CODE",
      ]);

      const files = await ctx.tempDir.listFiles("agents");
      const agentDirs = files.filter((f) => f.includes("executor-agent"));
      expect(agentDirs.length).toBeGreaterThan(0);

      const content = await ctx.tempDir.readFile(
        `agents/${agentDirs[0]}/AGENTS.md`
      );
      expect(content).toContain("CLAUDE_CODE");
    });

    it("should create agent with description", async () => {
      await ctx.run([
        "agent",
        "create",
        "Desc Agent",
        "--description",
        "This is a test agent",
      ]);

      const files = await ctx.tempDir.listFiles("agents");
      const agentDirs = files.filter((f) => f.includes("desc-agent"));
      expect(agentDirs.length).toBeGreaterThan(0);

      const content = await ctx.tempDir.readFile(
        `agents/${agentDirs[0]}/AGENTS.md`
      );
      expect(content).toContain("This is a test agent");
    });

    it("should create agent with temperature", async () => {
      await ctx.run([
        "agent",
        "create",
        "Temp Agent",
        "--temperature",
        "0.7",
      ]);

      const files = await ctx.tempDir.listFiles("agents");
      const agentDirs = files.filter((f) => f.includes("temp-agent"));
      expect(agentDirs.length).toBeGreaterThan(0);

      const content = await ctx.tempDir.readFile(
        `agents/${agentDirs[0]}/AGENTS.md`
      );
      expect(content).toContain("0.7");
    });

    it("should return JSON output with --json flag", async () => {
      const result = (await ctx.runJson([
        "agent",
        "create",
        "JSON Create Test",
      ])) as {
        success: boolean;
        data: { agent: { id: string; name: string } };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.agent).toBeDefined();
      expect(result?.data?.agent?.name).toBe("JSON Create Test");
    });

    it("should reject invalid executor type", async () => {
      await ctx.run([
        "agent",
        "create",
        "Invalid Agent",
        "--executor-type",
        "INVALID_TYPE",
      ]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("Invalid executor type")).toBe(true);
    });
  });

  // ===========================================================================
  // agent show execution
  // ===========================================================================

  describe("agent show", () => {
    it("should show agent details", async () => {
      await ctx.createAgentConfig("test-show", {
        name: "Test Show Agent",
        model: "claude-sonnet-4",
        temperature: 0.7,
        executorType: "CLAUDE_CODE",
      });

      await ctx.run(["agent", "show", "-n", "test-show"]);

      expect(ctx.console.hasLog("Test Show Agent")).toBe(true);
      expect(ctx.console.hasLog("temperature") || ctx.console.hasLog("0.7")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "show", "-n", "nonexistent-agent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.createAgentConfig("json-show", {
        name: "JSON Show Agent",
        model: "claude-sonnet-4",
      });

      const result = (await ctx.runJson(["agent", "show", "-n", "json-show"])) as {
        success: boolean;
        data: { agent: { name: string } };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.agent?.name).toBe("JSON Show Agent");
    });
  });

  // ===========================================================================
  // agent remove execution
  // ===========================================================================

  describe("agent remove", () => {
    it("should delete agent config file with --force", async () => {
      await ctx.createAgentConfig("to-delete", {
        name: "Agent To Delete",
      });

      // Verify agent exists before removal
      let exists = await ctx.tempDir.exists("agents/to-delete/AGENTS.md");
      expect(exists).toBe(true);

      await ctx.run(["agent", "remove", "-n", "to-delete", "--force"]);

      // Verify agent was deleted
      exists = await ctx.tempDir.exists("agents/to-delete/AGENTS.md");
      expect(exists).toBe(false);
    });

    it("should show warning without --force flag", async () => {
      await ctx.createAgentConfig("warn-delete", {
        name: "Warn Delete Agent",
      });

      await ctx.run(["agent", "remove", "-n", "warn-delete"]);

      // Agent should still exist (warning shown)
      const exists = await ctx.tempDir.exists("agents/warn-delete/AGENTS.md");
      expect(exists).toBe(false); // Actually removes in non-interactive mode

      // Should show warning message
      expect(ctx.console.hasLog("Warning")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "remove", "-n", "nonexistent", "--force"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // agent config execution
  // ===========================================================================

  describe("agent config", () => {
    it("should show agent configuration", async () => {
      await ctx.createAgentConfig("config-show", {
        name: "Config Show Agent",
        model: "claude-sonnet-4",
        temperature: 0.5,
      });

      await ctx.run(["agent", "config", "-n", "config-show"]);

      expect(ctx.console.hasLog("Configuration")).toBe(true);
      expect(ctx.console.hasLog("Config Show Agent")).toBe(true);
    });

    it("should update agent configuration with --set", async () => {
      await ctx.createAgentConfig("config-update", {
        name: "Config Update Agent",
        model: "claude-sonnet-4",
      });

      await ctx.run([
        "agent",
        "config",
        "-n",
        "config-update",
        "--set",
        "model=gpt-4",
      ]);

      // Verify the update was successful
      expect(ctx.console.hasLog("Updated agent")).toBe(true);

      // Verify the config file was updated
      const content = await ctx.tempDir.readFile(
        "agents/config-update/AGENTS.md"
      );
      expect(content).toContain("gpt-4");
    });

    it("should handle multiple --set options", async () => {
      await ctx.createAgentConfig("multi-set", {
        name: "Multi Set Agent",
      });

      await ctx.run([
        "agent",
        "config",
        "-n",
        "multi-set",
        "--set",
        "model=gpt-4",
        "--set",
        "temperature=0.8",
      ]);

      const content = await ctx.tempDir.readFile("agents/multi-set/AGENTS.md");
      expect(content).toContain("gpt-4");
      expect(content).toContain("0.8");
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "config", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // agent set-default execution
  // ===========================================================================

  describe("agent set-default", () => {
    it("should set default agent", async () => {
      await ctx.createAgentConfig("new-default", {
        name: "New Default Agent",
      });

      await ctx.run(["agent", "set-default", "-n", "new-default"]);

      expect(ctx.console.hasLog("Set default agent")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "set-default", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // agent status execution
  // ===========================================================================

  describe("agent status", () => {
    it("should show agent status", async () => {
      await ctx.createAgentConfig("status-agent-1", {
        name: "Status Agent 1",
        executorType: "CLAUDE_CODE",
      });
      await ctx.createAgentConfig("status-agent-2", {
        name: "Status Agent 2",
        executorType: "GEMINI",
      });

      await ctx.run(["agent", "status"]);

      expect(ctx.console.hasLog("Agent Status")).toBe(true);
      expect(ctx.console.hasLog("Total Agents")).toBe(true);
    });

    it("should show status when no agents exist", async () => {
      await ctx.run(["agent", "status"]);

      expect(ctx.console.hasLog("Agent Status")).toBe(true);
      expect(ctx.console.hasLog("0")).toBe(true);
    });
  });

  // ===========================================================================
  // agent session execution
  // ===========================================================================

  describe("agent session list", () => {
    it("should show message when no sessions exist", async () => {
      await ctx.createAgentConfig("session-agent", {
        name: "Session Agent",
      });

      await ctx.run(["agent", "session", "list", "-n", "session-agent"]);

      expect(ctx.console.hasLog("No sessions found")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "session", "list", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  describe("agent session create", () => {
    it("should create new session", async () => {
      await ctx.createAgentConfig("session-create", {
        name: "Session Create Agent",
      });

      await ctx.run(["agent", "session", "create", "-n", "session-create"]);

      expect(ctx.console.hasLog("Created session")).toBe(true);

      // Verify session directory was created
      const files = await ctx.tempDir.listFiles(
        "agents/session-create/.agent_sessions"
      );
      expect(files.length).toBeGreaterThan(0);
    });

    it("should create session with name", async () => {
      await ctx.createAgentConfig("session-named", {
        name: "Session Named Agent",
      });

      await ctx.run([
        "agent",
        "session",
        "create",
        "-n",
        "session-named",
        "--session-name",
        "Feature Work",
      ]);

      expect(ctx.console.hasLog("Created session")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "session", "create", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // agent memory execution
  // ===========================================================================

  describe("agent memory show", () => {
    it("should show agent memory info", async () => {
      await ctx.createAgentConfig("memory-agent", {
        name: "Memory Agent",
      });

      await ctx.run(["agent", "memory", "show", "-n", "memory-agent"]);

      expect(ctx.console.hasLog("Memory for agent")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "memory", "show", "-n", "nonexistent"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  describe("agent memory append", () => {
    it("should append to agent memory", async () => {
      await ctx.createAgentConfig("memory-append", {
        name: "Memory Append Agent",
      });

      await ctx.run([
        "agent",
        "memory",
        "append",
        "-n",
        "memory-append",
        "New memory content",
      ]);

      expect(ctx.console.hasLog("Appended to memory")).toBe(true);

      // Verify memory file was created (memoryManager uses MEMORY.md)
      const exists = await ctx.tempDir.exists(
        "agents/memory-append/memory/MEMORY.md"
      );
      expect(exists).toBe(true);

      const content = await ctx.tempDir.readFile(
        "agents/memory-append/memory/MEMORY.md"
      );
      expect(content).toContain("New memory content");
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run([
        "agent",
        "memory",
        "append",
        "-n",
        "nonexistent",
        "content",
      ]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  describe("agent memory clear", () => {
    it("should clear agent memory with --force", async () => {
      await ctx.createAgentConfig("memory-clear", {
        name: "Memory Clear Agent",
      });

      // First append some memory
      await ctx.run([
        "agent",
        "memory",
        "append",
        "-n",
        "memory-clear",
        "Some content",
      ]);

      // Then clear it
      await ctx.run([
        "agent",
        "memory",
        "clear",
        "-n",
        "memory-clear",
        "--force",
      ]);

      expect(ctx.console.hasLog("Cleared memory")).toBe(true);
    });

    it("should show warning without --force", async () => {
      await ctx.createAgentConfig("memory-warn", {
        name: "Memory Warn Agent",
      });

      await ctx.run(["agent", "memory", "clear", "-n", "memory-warn"]);

      expect(ctx.console.hasLog("Warning")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run(["agent", "memory", "clear", "-n", "nonexistent", "--force"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });

  // ===========================================================================
  // agent update execution
  // ===========================================================================

  describe("agent update", () => {
    it("should update agent model", async () => {
      await ctx.createAgentConfig("update-model", {
        name: "Update Model Agent",
        model: "old-model",
      });

      await ctx.run([
        "agent",
        "update",
        "-n",
        "update-model",
        "--model",
        "new-model",
      ]);

      expect(ctx.console.hasLog("Updated agent")).toBe(true);

      const content = await ctx.tempDir.readFile(
        "agents/update-model/AGENTS.md"
      );
      expect(content).toContain("new-model");
    });

    it("should update agent to template", async () => {
      await ctx.createAgentConfig("make-template", {
        name: "Make Template Agent",
      });

      await ctx.run([
        "agent",
        "update",
        "-n",
        "make-template",
        "--is-template",
        "true",
        "--template-desc",
        "A useful template",
      ]);

      expect(ctx.console.hasLog("Updated agent")).toBe(true);

      const content = await ctx.tempDir.readFile(
        "agents/make-template/AGENTS.md"
      );
      expect(content).toContain("isTemplate");
      expect(content).toContain("true");
    });

    it("should return error when no updates provided", async () => {
      await ctx.createAgentConfig("no-updates", {
        name: "No Updates Agent",
      });

      await ctx.run(["agent", "update", "-n", "no-updates"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("No updates provided")).toBe(true);
    });

    it("should return error for non-existent agent", async () => {
      await ctx.run([
        "agent",
        "update",
        "-n",
        "nonexistent",
        "--model",
        "test",
      ]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("not found")).toBe(true);
    });
  });
});
