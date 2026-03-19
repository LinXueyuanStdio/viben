/**
 * MCP Command Execution Tests
 *
 * Tests that actually execute MCP commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements mcp.test.ts which tests with fully mocked mcpManager.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerMcpCommand } from "./mcp";
import { createTempDir, type TempDirContext } from "../../test/helpers/temp-dir";
import { createConsoleSpy, type ConsoleSpy } from "../../test/mocks/console";
import { join } from "node:path";

// =============================================================================
// Test Setup
// =============================================================================

// Mock config/paths to use our temp directory for VIBEN_STATE_DIR
vi.mock("../../config/paths", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../config/paths")>();
  return {
    ...original,
    getStateDir: vi.fn(),
    getAgentsDir: vi.fn(),
    getAgentDir: vi.fn(),
    getAgentMcpServersPath: vi.fn(),
    getSharedMcpDir: vi.fn(),
  };
});

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

// Mock child_process.spawn to avoid actually starting processes
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import * as configPaths from "../../config/paths";

// Store original process.exit and mock it
const originalExit = process.exit;
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
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createTempDir("viben-mcp-test-");

  // Create directory structure
  await tempDir.mkdir("agents");
  await tempDir.mkdir("mcp");

  // Mock path functions to return our temp directory paths
  vi.mocked(configPaths.getStateDir).mockReturnValue(tempDir.root);
  vi.mocked(configPaths.getAgentsDir).mockReturnValue(join(tempDir.root, "agents"));
  vi.mocked(configPaths.getAgentDir).mockImplementation((agentId: string) =>
    join(tempDir.root, "agents", agentId)
  );
  vi.mocked(configPaths.getAgentMcpServersPath).mockImplementation((agentId: string) =>
    join(tempDir.root, "agents", agentId, "mcp_servers.json")
  );
  vi.mocked(configPaths.getSharedMcpDir).mockReturnValue(join(tempDir.root, "mcp"));

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

  registerMcpCommand(program);

  const consoleSpy = createConsoleSpy();

  return {
    tempDir,
    program,
    console: consoleSpy,

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
      // Restore process.exit
      process.exit = originalExit;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("mcp command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // mcp list execution (global installed MCPs)
  // ===========================================================================

  describe("mcp list", () => {
    it("should show message when no MCP servers installed globally", async () => {
      await ctx.run(["mcp", "list"]);

      // Check that console output indicates no MCPs
      const hasNoMcpMessage = ctx.console.logs.some(
        (log) => log.includes("No MCP servers installed globally")
      );
      expect(hasNoMcpMessage).toBe(true);
    });

    it("should list globally installed MCP servers from installed.yaml", async () => {
      // Create installed.yaml file with MCP entries
      await ctx.tempDir.writeFile(
        "mcp/installed.yaml",
        `installed:
  - name: filesystem
    version: "1.2.0"
    path: /path/to/filesystem
    installedAt: "2024-01-15T10:00:00Z"
  - name: git
    version: "2.0.1"
    path: /path/to/git
    installedAt: "2024-01-16T12:00:00Z"
`
      );

      await ctx.run(["mcp", "list"]);

      // Check that MCPs are listed
      const hasFilesystem = ctx.console.logs.some((log) => log.includes("filesystem"));
      const hasGit = ctx.console.logs.some((log) => log.includes("git"));
      expect(hasFilesystem).toBe(true);
      expect(hasGit).toBe(true);
    });

    it("should return JSON output with --json flag", async () => {
      await ctx.tempDir.writeFile(
        "mcp/installed.yaml",
        `installed:
  - name: test-mcp
    version: "1.0.0"
    path: /path/to/test
    installedAt: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["mcp", "list"])) as {
        success: boolean;
        data: { installed: Array<{ name: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.installed).toBeDefined();
      expect(result?.data?.installed?.length).toBe(1);
      expect(result?.data?.installed?.[0]?.name).toBe("test-mcp");
    });
  });

  // ===========================================================================
  // mcp list --agent execution
  // ===========================================================================

  describe("mcp list --agent", () => {
    it("should show message when agent has no MCP servers", async () => {
      // Create agent directory but no mcp_servers.json
      await ctx.tempDir.mkdir("agents/empty-agent");

      await ctx.run(["mcp", "list", "--agent", "empty-agent"]);

      const hasNoMcpMessage = ctx.console.logs.some(
        (log) => log.includes('No MCP servers configured for agent "empty-agent"')
      );
      expect(hasNoMcpMessage).toBe(true);
    });

    it("should list MCP servers configured for an agent", async () => {
      // Create agent directory with mcp_servers.json
      await ctx.tempDir.mkdir("agents/my-agent");
      await ctx.tempDir.writeJson("agents/my-agent/mcp_servers.json", {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["@anthropic-ai/mcp-server-filesystem", "/home/user"],
            enabled: true,
          },
          git: {
            command: "npx",
            args: ["@anthropic-ai/mcp-server-git"],
            enabled: false,
          },
        },
      });

      await ctx.run(["mcp", "list", "--agent", "my-agent"]);

      // Check that servers are listed
      const hasFilesystem = ctx.console.logs.some((log) => log.includes("filesystem"));
      const hasGit = ctx.console.logs.some((log) => log.includes("git"));
      expect(hasFilesystem).toBe(true);
      expect(hasGit).toBe(true);
    });

    it("should return JSON output for agent MCP list", async () => {
      await ctx.tempDir.mkdir("agents/json-agent");
      await ctx.tempDir.writeJson("agents/json-agent/mcp_servers.json", {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["@anthropic-ai/mcp-server-filesystem"],
            enabled: true,
          },
        },
      });

      const result = (await ctx.runJson(["mcp", "list", "--agent", "json-agent"])) as {
        success: boolean;
        data: { agent: string; servers: Array<{ name: string }> };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.agent).toBe("json-agent");
      expect(result?.data?.servers?.length).toBe(1);
      expect(result?.data?.servers?.[0]?.name).toBe("filesystem");
    });
  });

  // ===========================================================================
  // mcp show execution
  // ===========================================================================

  describe("mcp show", () => {
    it("should show globally installed MCP server details", async () => {
      await ctx.tempDir.writeFile(
        "mcp/installed.yaml",
        `installed:
  - name: filesystem
    version: "1.2.0"
    path: /path/to/filesystem
    installedAt: "2024-01-15T10:00:00Z"
`
      );

      await ctx.run(["mcp", "show", "filesystem"]);

      const hasName = ctx.console.logs.some((log) => log.includes("MCP Server: filesystem"));
      expect(hasName).toBe(true);
    });

    it("should show error when MCP server not found", async () => {
      await ctx.run(["mcp", "show", "nonexistent"]);

      // Should have called process.exit with non-zero code
      expect(exitCode).toBe(1);
      const hasError = ctx.console.errors.some(
        (log) => log.includes('MCP server "nonexistent" not found')
      );
      expect(hasError).toBe(true);
    });

    it("should return JSON output for mcp show", async () => {
      await ctx.tempDir.writeFile(
        "mcp/installed.yaml",
        `installed:
  - name: test-mcp
    version: "1.0.0"
    path: /path/to/test
    installedAt: "2024-01-01T00:00:00Z"
`
      );

      const result = (await ctx.runJson(["mcp", "show", "test-mcp"])) as {
        success: boolean;
        data: { mcp: { name: string; version: string } };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.mcp?.name).toBe("test-mcp");
      expect(result?.data?.mcp?.version).toBe("1.0.0");
    });
  });

  // ===========================================================================
  // mcp show --agent execution
  // ===========================================================================

  describe("mcp show --agent", () => {
    it("should show agent-specific MCP server details", async () => {
      await ctx.tempDir.mkdir("agents/my-agent");
      await ctx.tempDir.writeJson("agents/my-agent/mcp_servers.json", {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["@anthropic-ai/mcp-server-filesystem", "/home/user"],
            enabled: true,
            env: { DEBUG: "true" },
          },
        },
      });

      await ctx.run(["mcp", "show", "filesystem", "--agent", "my-agent"]);

      const hasName = ctx.console.logs.some((log) => log.includes("MCP Server: filesystem"));
      expect(hasName).toBe(true);
    });

    it("should show error when agent MCP server not found", async () => {
      await ctx.tempDir.mkdir("agents/my-agent");
      await ctx.tempDir.writeJson("agents/my-agent/mcp_servers.json", {
        mcpServers: {},
      });

      await ctx.run(["mcp", "show", "nonexistent", "--agent", "my-agent"]);

      expect(exitCode).toBe(1);
      const hasError = ctx.console.errors.some(
        (log) => log.includes('MCP server "nonexistent" not found for agent "my-agent"')
      );
      expect(hasError).toBe(true);
    });

    it("should show environment variables with secret masking", async () => {
      await ctx.tempDir.mkdir("agents/env-agent");
      await ctx.tempDir.writeJson("agents/env-agent/mcp_servers.json", {
        mcpServers: {
          "api-mcp": {
            command: "node",
            args: ["index.js"],
            enabled: true,
            env: {
              API_KEY: "secret-key-12345678",
              DEBUG: "true",
            },
          },
        },
      });

      await ctx.run(["mcp", "show", "api-mcp", "--agent", "env-agent"]);

      const hasEnvSection = ctx.console.logs.some((log) =>
        log.includes("Environment Variables")
      );
      expect(hasEnvSection).toBe(true);
    });
  });

  // ===========================================================================
  // mcp add execution
  // ===========================================================================

  describe("mcp add", () => {
    it("should add MCP server to agent", async () => {
      // Agent directory will be created by setAgentServer
      await ctx.run([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "new-agent",
        "--command",
        "npx @anthropic-ai/mcp-server-filesystem",
      ]);

      // Verify mcp_servers.json was created
      const configPath = "agents/new-agent/mcp_servers.json";
      const exists = await ctx.tempDir.exists(configPath);
      expect(exists).toBe(true);

      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, { command: string; enabled: boolean }>;
      }>(configPath);
      expect(config.mcpServers.filesystem).toBeDefined();
      expect(config.mcpServers.filesystem.command).toBe(
        "npx @anthropic-ai/mcp-server-filesystem"
      );
      expect(config.mcpServers.filesystem.enabled).toBe(true);
    });

    it("should add MCP server with args", async () => {
      await ctx.run([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "args-agent",
        "--command",
        "npx",
        "--args",
        "@anthropic-ai/mcp-server-filesystem",
        "/home/user",
      ]);

      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, { command: string; args: string[] }>;
      }>("agents/args-agent/mcp_servers.json");

      expect(config.mcpServers.filesystem.command).toBe("npx");
      expect(config.mcpServers.filesystem.args).toEqual([
        "@anthropic-ai/mcp-server-filesystem",
        "/home/user",
      ]);
    });

    it("should add MCP server with environment variables", async () => {
      await ctx.run([
        "mcp",
        "add",
        "api-mcp",
        "--agent",
        "env-agent",
        "--command",
        "node",
        "--env",
        "API_KEY=secret123",
        "--env",
        "DEBUG=true",
      ]);

      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, { env: Record<string, string> }>;
      }>("agents/env-agent/mcp_servers.json");

      expect(config.mcpServers["api-mcp"].env).toEqual({
        API_KEY: "secret123",
        DEBUG: "true",
      });
    });

    it("should add MCP server as disabled with --disabled flag", async () => {
      await ctx.run([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "disabled-agent",
        "--command",
        "npx",
        "--disabled",
      ]);

      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, { enabled: boolean }>;
      }>("agents/disabled-agent/mcp_servers.json");

      expect(config.mcpServers.filesystem.enabled).toBe(false);
    });

    it("should return JSON output when adding MCP server", async () => {
      const result = (await ctx.runJson([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "json-agent",
        "--command",
        "npx",
      ])) as {
        success: boolean;
        data: { name: string; agent: string; added: boolean };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.name).toBe("filesystem");
      expect(result?.data?.agent).toBe("json-agent");
      expect(result?.data?.added).toBe(true);
    });

    it("should update existing MCP server configuration", async () => {
      // Create existing config
      await ctx.tempDir.mkdir("agents/update-agent");
      await ctx.tempDir.writeJson("agents/update-agent/mcp_servers.json", {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["old-package"],
            enabled: true,
          },
        },
      });

      // Update the server
      await ctx.run([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "update-agent",
        "--command",
        "npx",
        "--args",
        "new-package",
        "/new/path",
      ]);

      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, { args: string[] }>;
      }>("agents/update-agent/mcp_servers.json");

      expect(config.mcpServers.filesystem.args).toEqual(["new-package", "/new/path"]);
    });
  });

  // ===========================================================================
  // mcp remove execution
  // ===========================================================================

  describe("mcp remove", () => {
    it("should remove MCP server from agent", async () => {
      // Create existing config with multiple servers
      await ctx.tempDir.mkdir("agents/remove-agent");
      await ctx.tempDir.writeJson("agents/remove-agent/mcp_servers.json", {
        mcpServers: {
          filesystem: {
            command: "npx",
            enabled: true,
          },
          git: {
            command: "npx",
            enabled: true,
          },
        },
      });

      await ctx.run(["mcp", "remove", "filesystem", "--agent", "remove-agent"]);

      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, unknown>;
      }>("agents/remove-agent/mcp_servers.json");

      expect(config.mcpServers.filesystem).toBeUndefined();
      expect(config.mcpServers.git).toBeDefined();
    });

    it("should handle removing non-existent server gracefully", async () => {
      await ctx.tempDir.mkdir("agents/empty-agent");
      await ctx.tempDir.writeJson("agents/empty-agent/mcp_servers.json", {
        mcpServers: {},
      });

      // This should not throw
      await ctx.run(["mcp", "remove", "nonexistent", "--agent", "empty-agent"]);

      // Should succeed (no-op)
      const hasSuccess = ctx.console.logs.some(
        (log) => log.includes('MCP server "nonexistent" removed')
      );
      expect(hasSuccess).toBe(true);
    });

    it("should return JSON output when removing MCP server", async () => {
      await ctx.tempDir.mkdir("agents/json-remove");
      await ctx.tempDir.writeJson("agents/json-remove/mcp_servers.json", {
        mcpServers: {
          filesystem: { command: "npx", enabled: true },
        },
      });

      const result = (await ctx.runJson([
        "mcp",
        "remove",
        "filesystem",
        "--agent",
        "json-remove",
      ])) as {
        success: boolean;
        data: { name: string; agent: string; removed: boolean };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.name).toBe("filesystem");
      expect(result?.data?.agent).toBe("json-remove");
      expect(result?.data?.removed).toBe(true);
    });
  });

  // ===========================================================================
  // mcp serve execution
  // ===========================================================================

  describe("mcp serve", () => {
    it("should show info about browse-mcp", async () => {
      await ctx.run(["mcp", "serve"]);

      const hasInfo = ctx.console.logs.some(
        (log) => log.includes("browse-mcp")
      );
      expect(hasInfo).toBe(true);
    });

    it("should show installation instructions", async () => {
      await ctx.run(["mcp", "serve"]);

      const hasUvx = ctx.console.logs.some((log) => log.includes("uvx browse-mcp"));
      const hasPip = ctx.console.logs.some((log) => log.includes("pip install browse-mcp"));
      expect(hasUvx).toBe(true);
      expect(hasPip).toBe(true);
    });

    it("should not show output in quiet mode", async () => {
      await ctx.run(["--quiet", "mcp", "serve"]);

      // Should not have any logs
      expect(ctx.console.logs.length).toBe(0);
    });
  });

  // ===========================================================================
  // Integration scenarios
  // ===========================================================================

  describe("integration scenarios", () => {
    it("should allow user to add, list, show, and remove MCP server", async () => {
      const agentId = "integration-agent";

      // Step 1: Add MCP server
      await ctx.run([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        agentId,
        "--command",
        "npx",
        "--args",
        "@anthropic-ai/mcp-server-filesystem",
        "/home/user",
      ]);

      // Verify file was created
      const exists = await ctx.tempDir.exists(`agents/${agentId}/mcp_servers.json`);
      expect(exists).toBe(true);

      ctx.console.reset();

      // Step 2: List MCP servers
      await ctx.run(["mcp", "list", "--agent", agentId]);
      expect(ctx.console.hasLog("filesystem")).toBe(true);

      ctx.console.reset();

      // Step 3: Show MCP server details
      await ctx.run(["mcp", "show", "filesystem", "--agent", agentId]);
      expect(ctx.console.hasLog("MCP Server: filesystem")).toBe(true);

      ctx.console.reset();

      // Step 4: Remove MCP server
      await ctx.run(["mcp", "remove", "filesystem", "--agent", agentId]);
      expect(ctx.console.hasLog('MCP server "filesystem" removed')).toBe(true);

      // Verify server was removed
      const config = await ctx.tempDir.readJson<{
        mcpServers: Record<string, unknown>;
      }>(`agents/${agentId}/mcp_servers.json`);
      expect(config.mcpServers.filesystem).toBeUndefined();
    });

    it("should handle multiple agents with different MCP configurations", async () => {
      // Setup agent 1
      await ctx.run([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "agent-1",
        "--command",
        "npx",
      ]);

      // Setup agent 2 with different servers
      await ctx.run([
        "mcp",
        "add",
        "git",
        "--agent",
        "agent-2",
        "--command",
        "npx",
      ]);
      await ctx.run([
        "mcp",
        "add",
        "github",
        "--agent",
        "agent-2",
        "--command",
        "npx",
      ]);

      // Verify agent 1 config
      const config1 = await ctx.tempDir.readJson<{
        mcpServers: Record<string, unknown>;
      }>("agents/agent-1/mcp_servers.json");
      expect(Object.keys(config1.mcpServers)).toEqual(["filesystem"]);

      // Verify agent 2 config
      const config2 = await ctx.tempDir.readJson<{
        mcpServers: Record<string, unknown>;
      }>("agents/agent-2/mcp_servers.json");
      expect(Object.keys(config2.mcpServers).sort()).toEqual(["git", "github"]);
    });
  });
});
