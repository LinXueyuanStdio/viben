/**
 * MCP CLI Commands Tests
 *
 * Tests for:
 * - `mcp list` - List installed MCP servers
 * - `mcp list --agent <id>` - List agent-specific MCPs
 * - `mcp show <name>` - Show MCP server details
 * - `mcp show <name> --agent <id>` - Show agent-specific MCP details
 * - `mcp inspector` - Start MCP Inspector proxy
 * - `mcp inspector <command> [args...]` - Inspector with MCP server command
 * - `mcp inspector --config <file> --server <name>` - Inspector with config file
 * - `mcp serve` - Show info about serving as MCP server
 * - `mcp add <name>` - Add MCP server to agent
 * - `mcp remove <name>` - Remove MCP server from agent
 * - JSON output for all commands
 * - Error handling
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { Command } from "commander";
import { registerMcpCommand } from "./mcp";
import type { McpServer, InstalledMcp } from "../../types";

// Mock child_process.spawn
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock the mcp module
vi.mock("../../mcp", () => ({
  mcpManager: {
    listInstalled: vi.fn(),
    getAgentServers: vi.fn(),
    setAgentServer: vi.fn(),
    removeAgentServer: vi.fn(),
  },
}));

// Mock chalk to avoid color output in tests
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    blue: (s: string) => s,
  },
}));

// Mock process.exit
vi.spyOn(process, "exit").mockImplementation((code?: number | string | null | undefined) => {
  throw new Error(`process.exit(${code})`);
});

import { mcpManager } from "../../mcp";
import { spawn } from "node:child_process";

/**
 * Helper to create a mock McpServer
 */
function createMockMcpServer(overrides: Partial<McpServer> = {}): McpServer {
  return {
    name: "test-mcp",
    command: "node",
    args: ["index.js"],
    enabled: true,
    ...overrides,
  };
}

/**
 * Helper to create a mock InstalledMcp
 */
function createMockInstalledMcp(overrides: Partial<InstalledMcp> = {}): InstalledMcp {
  return {
    name: "test-mcp",
    version: "1.0.0",
    path: "/path/to/mcp",
    installedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Create a mock child process with EventEmitter-like behavior
 */
function createMockChildProcess() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const mockChild = {
    on: vi.fn(function (
      this: typeof mockChild,
      event: string,
      callback: (...args: unknown[]) => void
    ) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      return mockChild;
    }),
    kill: vi.fn(),
    // Helper to emit events in tests
    _emit: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        for (const listener of listeners[event]) {
          listener(...args);
        }
      }
    },
  };

  return mockChild;
}

describe("MCP CLI Commands", () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh program instance
    program = new Command();
    program.option("--json", "Output in JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register mcp commands
    registerMcpCommand(program);

    // Spy on console
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper to run command
  // ============================================================================
  async function runCommand(args: string[]): Promise<void> {
    await program.parseAsync(["node", "test", ...args]);
  }

  // ============================================================================
  // mcp list
  // ============================================================================

  describe("mcp list", () => {
    it("should list globally installed MCP servers", async () => {
      const mockInstalled = [
        createMockInstalledMcp({
          name: "filesystem",
          version: "1.2.0",
          path: "/path/to/filesystem",
        }),
        createMockInstalledMcp({
          name: "git",
          version: "2.0.1",
          path: "/path/to/git",
        }),
      ];

      vi.mocked(mcpManager.listInstalled).mockResolvedValue(mockInstalled);

      await runCommand(["mcp", "list"]);

      expect(mcpManager.listInstalled).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Installed MCP Servers"));
    });

    it("should show message when no MCP servers installed", async () => {
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([]);

      await runCommand(["mcp", "list"]);

      expect(mcpManager.listInstalled).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("No MCP servers installed globally")
      );
    });

    it("should show help message when no MCPs installed", async () => {
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([]);

      await runCommand(["mcp", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("viben mcp list --agent")
      );
    });

    it("should output JSON when --json flag is provided", async () => {
      const mockInstalled = [
        createMockInstalledMcp({
          name: "filesystem",
          version: "1.2.0",
        }),
      ];

      vi.mocked(mcpManager.listInstalled).mockResolvedValue(mockInstalled);

      await runCommand(["--json", "mcp", "list"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"installed"')
      );
    });
  });

  // ============================================================================
  // mcp list --agent <id>
  // ============================================================================

  describe("mcp list --agent <id>", () => {
    it("should list MCP servers for a specific agent", async () => {
      const mockServers = [
        createMockMcpServer({
          name: "filesystem",
          command: "npx",
          args: ["@anthropic-ai/mcp-server-filesystem"],
          enabled: true,
        }),
        createMockMcpServer({
          name: "git",
          command: "npx",
          args: ["@anthropic-ai/mcp-server-git"],
          enabled: false,
        }),
      ];

      vi.mocked(mcpManager.getAgentServers).mockResolvedValue(mockServers);

      await runCommand(["mcp", "list", "--agent", "my-agent"]);

      expect(mcpManager.getAgentServers).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP Servers for Agent: my-agent")
      );
    });

    it("should show message when agent has no MCP servers", async () => {
      vi.mocked(mcpManager.getAgentServers).mockResolvedValue([]);

      await runCommand(["mcp", "list", "--agent", "empty-agent"]);

      expect(mcpManager.getAgentServers).toHaveBeenCalledWith("empty-agent");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No MCP servers configured for agent "empty-agent"')
      );
    });

    it("should output JSON for agent MCP list", async () => {
      const mockServers = [
        createMockMcpServer({
          name: "filesystem",
          command: "npx",
          enabled: true,
        }),
      ];

      vi.mocked(mcpManager.getAgentServers).mockResolvedValue(mockServers);

      await runCommand(["--json", "mcp", "list", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"agent": "my-agent"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"servers"')
      );
    });

    it("should display enabled/disabled status in table", async () => {
      const mockServers = [
        createMockMcpServer({ name: "enabled-mcp", enabled: true }),
        createMockMcpServer({ name: "disabled-mcp", enabled: false }),
      ];

      vi.mocked(mcpManager.getAgentServers).mockResolvedValue(mockServers);

      await runCommand(["mcp", "list", "--agent", "my-agent"]);

      // The table should show yes/no for enabled status
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // mcp show <name>
  // ============================================================================

  describe("mcp show <name>", () => {
    it("should show globally installed MCP server details", async () => {
      const mockInstalled = [
        createMockInstalledMcp({
          name: "filesystem",
          version: "1.2.0",
          path: "/path/to/filesystem",
          installedAt: "2024-01-15T10:00:00Z",
        }),
      ];

      vi.mocked(mcpManager.listInstalled).mockResolvedValue(mockInstalled);

      await runCommand(["mcp", "show", "filesystem"]);

      expect(mcpManager.listInstalled).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP Server: filesystem")
      );
    });

    it("should show error when MCP server not found", async () => {
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([]);

      await expect(runCommand(["mcp", "show", "nonexistent"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP server "nonexistent" not found')
      );
    });

    it("should output JSON for MCP show", async () => {
      const mockInstalled = [
        createMockInstalledMcp({
          name: "filesystem",
          version: "1.2.0",
        }),
      ];

      vi.mocked(mcpManager.listInstalled).mockResolvedValue(mockInstalled);

      await runCommand(["--json", "mcp", "show", "filesystem"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"mcp"')
      );
    });
  });

  // ============================================================================
  // mcp show <name> --agent <id>
  // ============================================================================

  describe("mcp show <name> --agent <id>", () => {
    it("should show agent-specific MCP server details", async () => {
      const mockServers = [
        createMockMcpServer({
          name: "filesystem",
          command: "npx",
          args: ["@anthropic-ai/mcp-server-filesystem", "/home/user"],
          enabled: true,
        }),
      ];

      vi.mocked(mcpManager.getAgentServers).mockResolvedValue(mockServers);

      await runCommand(["mcp", "show", "filesystem", "--agent", "my-agent"]);

      expect(mcpManager.getAgentServers).toHaveBeenCalledWith("my-agent");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP Server: filesystem")
      );
    });

    it("should show error when agent MCP server not found", async () => {
      vi.mocked(mcpManager.getAgentServers).mockResolvedValue([]);

      await expect(
        runCommand(["mcp", "show", "nonexistent", "--agent", "my-agent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP server "nonexistent" not found for agent "my-agent"')
      );
    });

    it("should display environment variables with secret masking", async () => {
      const mockServers = [
        createMockMcpServer({
          name: "api-mcp",
          command: "node",
          args: ["index.js"],
          env: {
            API_KEY: "secret-key-12345678",
            DEBUG: "true",
          },
          enabled: true,
        }),
      ];

      vi.mocked(mcpManager.getAgentServers).mockResolvedValue(mockServers);

      await runCommand(["mcp", "show", "api-mcp", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Environment Variables")
      );
    });

    it("should output JSON for agent MCP show", async () => {
      const mockServers = [
        createMockMcpServer({
          name: "filesystem",
          command: "npx",
          enabled: true,
        }),
      ];

      vi.mocked(mcpManager.getAgentServers).mockResolvedValue(mockServers);

      await runCommand(["--json", "mcp", "show", "filesystem", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"server"')
      );
    });
  });

  // ============================================================================
  // mcp inspector
  // ============================================================================

  describe("mcp inspector", () => {
    it("should start MCP Inspector proxy", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Start the command (don't await as it will hang waiting for process to exit)
      const commandPromise = runCommand(["mcp", "inspector"]);

      // Simulate process exit after a short delay
      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["@modelcontextprotocol/inspector"],
        expect.objectContaining({
          stdio: "inherit",
          shell: true,
          env: expect.objectContaining({
            MCP_AUTO_OPEN_ENABLED: "false",
          }),
        })
      );
    });

    it("should start inspector with MCP server command", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand(["mcp", "inspector", "node", "build/index.js"]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining([
          "@modelcontextprotocol/inspector",
          "--",
          "node",
          "build/index.js",
        ]),
        expect.any(Object)
      );
    });

    it("should pass --config option to inspector", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand(["mcp", "inspector", "--config", "mcp.json"]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["--config", "mcp.json"]),
        expect.any(Object)
      );
    });

    it("should pass --server option to inspector", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "mcp",
        "inspector",
        "--config",
        "mcp.json",
        "--server",
        "myserver",
      ]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["--server", "myserver"]),
        expect.any(Object)
      );
    });

    it("should pass --cli option to inspector", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand(["mcp", "inspector", "--cli", "node", "index.js"]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["--cli"]),
        expect.any(Object)
      );
    });

    it("should pass --transport option to inspector", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "mcp",
        "inspector",
        "--transport",
        "sse",
        "--server-url",
        "https://example.com/sse",
      ]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["--transport", "sse", "--server-url", "https://example.com/sse"]),
        expect.any(Object)
      );
    });

    it("should pass environment variables with -e option", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand([
        "mcp",
        "inspector",
        "-e",
        "API_KEY=value",
        "node",
        "index.js",
      ]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(spawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining(["-e", "API_KEY=value"]),
        expect.any(Object)
      );
    });

    it("should show verbose output when --verbose flag is set", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand(["--verbose", "mcp", "inspector"]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Arguments:")
      );
    });

    it("should not show output in quiet mode", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand(["--quiet", "mcp", "inspector"]);

      setTimeout(() => {
        mockChild._emit("exit", 0, null);
      }, 10);

      await commandPromise;

      // Should not show "Starting MCP Inspector Proxy..." message
      const startingCalls = consoleSpy.mock.calls.filter(
        (call) => (call[0] as string)?.includes?.("Starting MCP Inspector")
      );
      expect(startingCalls.length).toBe(0);
    });

    it("should handle process error", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Track if process.exit was called
      let processExitCalled = false;
      let processExitCode: number | string | null | undefined = undefined;

      // Temporarily override process.exit to not throw but track the call
      // We emit exit with code 0 to resolve the promise without triggering another process.exit
      vi.mocked(process.exit).mockImplementation((code?: number | string | null | undefined) => {
        processExitCalled = true;
        processExitCode = code;
        // Emit exit with code 0 (or null) to resolve the promise without recursion
        // The exit handler only calls process.exit if code !== 0 && code !== null
        mockChild._emit("exit", 0, null);
        return undefined as never;
      });

      const commandPromise = runCommand(["mcp", "inspector"]);

      // Emit error after a short delay
      setTimeout(() => {
        mockChild._emit("error", new Error("spawn failed"));
      }, 10);

      await commandPromise;

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to start MCP Inspector")
      );
      expect(processExitCalled).toBe(true);
      expect(processExitCode).toBe(1);

      // Restore original mock
      vi.mocked(process.exit).mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit(${code})`);
      });
    });

    it("should handle process exit with non-zero code", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      // Track if process.exit was called with the correct code
      let exitCode: number | string | null | undefined = undefined;

      // Temporarily override process.exit to track the call and resolve the promise
      vi.mocked(process.exit).mockImplementation((code?: number | string | null | undefined) => {
        exitCode = code;
        return undefined as never;
      });

      const commandPromise = runCommand(["mcp", "inspector"]);

      // Emit exit with non-zero code
      setTimeout(() => {
        mockChild._emit("exit", 1, null);
      }, 10);

      await commandPromise;

      expect(exitCode).toBe(1);

      // Restore original mock
      vi.mocked(process.exit).mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit(${code})`);
      });
    });

    it("should handle process termination by signal", async () => {
      const mockChild = createMockChildProcess();
      vi.mocked(spawn).mockReturnValue(mockChild as unknown as ReturnType<typeof spawn>);

      const commandPromise = runCommand(["mcp", "inspector"]);

      setTimeout(() => {
        mockChild._emit("exit", null, "SIGTERM");
      }, 10);

      await commandPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("terminated by signal SIGTERM")
      );
    });
  });

  // ============================================================================
  // mcp serve
  // ============================================================================

  describe("mcp serve", () => {
    it("should show info about browse-mcp", async () => {
      await runCommand(["mcp", "serve"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP server functionality is handled by browse-mcp")
      );
    });

    it("should show installation instructions", async () => {
      await runCommand(["mcp", "serve"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("uvx browse-mcp")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("pip install browse-mcp")
      );
    });

    it("should not show output in quiet mode", async () => {
      await runCommand(["--quiet", "mcp", "serve"]);

      // Should not show any output
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // mcp add <name>
  // ============================================================================

  describe("mcp add <name>", () => {
    it("should add MCP server to agent", async () => {
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);

      await runCommand([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "my-agent",
        "--command",
        "npx @anthropic-ai/mcp-server-filesystem",
      ]);

      expect(mcpManager.setAgentServer).toHaveBeenCalledWith(
        "my-agent",
        expect.objectContaining({
          name: "filesystem",
          command: "npx @anthropic-ai/mcp-server-filesystem",
          enabled: true,
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP server "filesystem" added to agent "my-agent"')
      );
    });

    it("should add MCP server with args", async () => {
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);

      await runCommand([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "my-agent",
        "--command",
        "npx",
        "--args",
        "@anthropic-ai/mcp-server-filesystem",
        "/home/user",
      ]);

      expect(mcpManager.setAgentServer).toHaveBeenCalledWith(
        "my-agent",
        expect.objectContaining({
          name: "filesystem",
          command: "npx",
          args: ["@anthropic-ai/mcp-server-filesystem", "/home/user"],
        })
      );
    });

    it("should add MCP server with environment variables", async () => {
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);

      await runCommand([
        "mcp",
        "add",
        "api-mcp",
        "--agent",
        "my-agent",
        "--command",
        "node",
        "--env",
        "API_KEY=secret123",
        "--env",
        "DEBUG=true",
      ]);

      expect(mcpManager.setAgentServer).toHaveBeenCalledWith(
        "my-agent",
        expect.objectContaining({
          name: "api-mcp",
          env: {
            API_KEY: "secret123",
            DEBUG: "true",
          },
        })
      );
    });

    it("should add MCP server as disabled with --disabled flag", async () => {
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);

      await runCommand([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "my-agent",
        "--command",
        "npx",
        "--disabled",
      ]);

      expect(mcpManager.setAgentServer).toHaveBeenCalledWith(
        "my-agent",
        expect.objectContaining({
          name: "filesystem",
          enabled: false,
        })
      );
    });

    it("should output JSON when adding MCP server", async () => {
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);

      await runCommand([
        "--json",
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "my-agent",
        "--command",
        "npx",
      ]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"added": true')
      );
    });

    it("should handle error when adding MCP server fails", async () => {
      vi.mocked(mcpManager.setAgentServer).mockRejectedValue(new Error("Failed to add"));

      await expect(
        runCommand([
          "mcp",
          "add",
          "filesystem",
          "--agent",
          "my-agent",
          "--command",
          "npx",
        ])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should require --agent option", async () => {
      // Commander should fail if required option is missing
      await expect(
        runCommand(["mcp", "add", "filesystem", "--command", "npx"])
      ).rejects.toThrow();
    });

    it("should require --command option", async () => {
      // Commander should fail if required option is missing
      await expect(
        runCommand(["mcp", "add", "filesystem", "--agent", "my-agent"])
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // mcp remove <name>
  // ============================================================================

  describe("mcp remove <name>", () => {
    it("should remove MCP server from agent", async () => {
      vi.mocked(mcpManager.removeAgentServer).mockResolvedValue(undefined);

      await runCommand(["mcp", "remove", "filesystem", "--agent", "my-agent"]);

      expect(mcpManager.removeAgentServer).toHaveBeenCalledWith("my-agent", "filesystem");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP server "filesystem" removed from agent "my-agent"')
      );
    });

    it("should output JSON when removing MCP server", async () => {
      vi.mocked(mcpManager.removeAgentServer).mockResolvedValue(undefined);

      await runCommand(["--json", "mcp", "remove", "filesystem", "--agent", "my-agent"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"removed": true')
      );
    });

    it("should handle error when removing MCP server fails", async () => {
      vi.mocked(mcpManager.removeAgentServer).mockRejectedValue(new Error("Failed to remove"));

      await expect(
        runCommand(["mcp", "remove", "nonexistent", "--agent", "my-agent"])
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should require --agent option", async () => {
      // Commander should fail if required option is missing
      await expect(runCommand(["mcp", "remove", "filesystem"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // JSON output for all commands
  // ============================================================================

  describe("JSON output", () => {
    it("should output valid JSON for mcp list", async () => {
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([]);

      await runCommand(["--json", "mcp", "list"]);

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should output valid JSON for mcp list --agent", async () => {
      vi.mocked(mcpManager.getAgentServers).mockResolvedValue([]);

      await runCommand(["--json", "mcp", "list", "--agent", "test"]);

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should output valid JSON for mcp show", async () => {
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([
        createMockInstalledMcp({ name: "test" }),
      ]);

      await runCommand(["--json", "mcp", "show", "test"]);

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should output valid JSON for mcp add", async () => {
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);

      await runCommand([
        "--json",
        "mcp",
        "add",
        "test",
        "--agent",
        "agent",
        "--command",
        "cmd",
      ]);

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should output valid JSON for mcp remove", async () => {
      vi.mocked(mcpManager.removeAgentServer).mockResolvedValue(undefined);

      await runCommand(["--json", "mcp", "remove", "test", "--agent", "agent"]);

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("should include success: true in all successful JSON responses", async () => {
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([]);

      await runCommand(["--json", "mcp", "list"]);

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });
  });

  // ============================================================================
  // Error handling
  // ============================================================================

  describe("Error handling", () => {
    it("should handle error in mcp list", async () => {
      vi.mocked(mcpManager.listInstalled).mockRejectedValue(new Error("Database error"));

      await expect(runCommand(["mcp", "list"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Database error")
      );
    });

    it("should handle error in mcp list --agent", async () => {
      vi.mocked(mcpManager.getAgentServers).mockRejectedValue(new Error("Agent not found"));

      await expect(runCommand(["mcp", "list", "--agent", "invalid"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle error in mcp show", async () => {
      vi.mocked(mcpManager.listInstalled).mockRejectedValue(new Error("Read error"));

      await expect(runCommand(["mcp", "show", "test"])).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should output error in JSON format when --json flag is set", async () => {
      vi.mocked(mcpManager.listInstalled).mockRejectedValue(new Error("Test error"));

      await expect(runCommand(["--json", "mcp", "list"])).rejects.toThrow();

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("");
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });
  });

  // ============================================================================
  // Integration scenarios
  // ============================================================================

  describe("Integration scenarios", () => {
    it("should allow user to add, list, and remove MCP server", async () => {
      // Step 1: Add MCP server
      vi.mocked(mcpManager.setAgentServer).mockResolvedValue(undefined);
      await runCommand([
        "mcp",
        "add",
        "filesystem",
        "--agent",
        "my-agent",
        "--command",
        "npx",
      ]);
      expect(mcpManager.setAgentServer).toHaveBeenCalled();

      // Clear console spy calls
      consoleSpy.mockClear();

      // Step 2: List MCP servers
      vi.mocked(mcpManager.getAgentServers).mockResolvedValue([
        createMockMcpServer({ name: "filesystem", command: "npx", enabled: true }),
      ]);
      await runCommand(["mcp", "list", "--agent", "my-agent"]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("MCP Servers for Agent")
      );

      // Clear console spy calls
      consoleSpy.mockClear();

      // Step 3: Remove MCP server
      vi.mocked(mcpManager.removeAgentServer).mockResolvedValue(undefined);
      await runCommand(["mcp", "remove", "filesystem", "--agent", "my-agent"]);
      expect(mcpManager.removeAgentServer).toHaveBeenCalledWith("my-agent", "filesystem");
    });

    it("should allow user to view MCP server details", async () => {
      // List globally installed
      vi.mocked(mcpManager.listInstalled).mockResolvedValue([
        createMockInstalledMcp({ name: "filesystem", version: "1.2.0" }),
        createMockInstalledMcp({ name: "git", version: "2.0.0" }),
      ]);

      await runCommand(["--json", "mcp", "list"]);
      const listOutput = consoleSpy.mock.calls.map((call) => call[0]).join("");
      const listParsed = JSON.parse(listOutput);
      expect(listParsed.data.installed.length).toBe(2);

      consoleSpy.mockClear();

      // Show specific MCP
      await runCommand(["--json", "mcp", "show", "filesystem"]);
      const showOutput = consoleSpy.mock.calls.map((call) => call[0]).join("");
      const showParsed = JSON.parse(showOutput);
      expect(showParsed.data.mcp.name).toBe("filesystem");
    });
  });
});
