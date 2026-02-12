/**
 * CLI config command tests
 *
 * Tests for the git-style configuration management commands:
 * - config get <key>
 * - config set <key> <value>
 * - config list
 * - config unset <key>
 * - config edit
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerConfigCommand } from "./config";

// Mock dependencies
vi.mock("../../config", () => ({
  gitConfigManager: {
    get: vi.fn(),
    set: vi.fn(),
    list: vi.fn(),
    unset: vi.fn(),
    getMerged: vi.fn(),
  },
  getConfigPath: vi.fn(() => "/home/user/.viben/config.yaml"),
  getWorkspaceConfigPath: vi.fn(
    (path: string) => `${path}/.viben/config.yaml`
  ),
}));

vi.mock("../../workspace", () => ({
  workspaceManager: {
    getCurrentWorkspacePath: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockProcess = {
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === "close") {
          // Simulate immediate close
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      }),
    };
    return mockProcess;
  }),
}));

// Import mocked modules
import { gitConfigManager, getConfigPath, getWorkspaceConfigPath } from "../../config";
import { workspaceManager } from "../../workspace";
import { spawn } from "node:child_process";

describe("config command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  beforeEach(() => {
    // Create a fresh program for each test
    program = new Command();
    program
      .name("viben")
      .option("--json", "Output in JSON format")
      .option("--verbose", "Verbose output")
      .option("--quiet", "Minimal output")
      .option("--global", "Use global config instead of workspace");

    registerConfigCommand(program);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock process.exit to prevent test from exiting
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as () => never);

    // Reset all mocks
    vi.mocked(gitConfigManager.get).mockReset();
    vi.mocked(gitConfigManager.set).mockReset();
    vi.mocked(gitConfigManager.list).mockReset();
    vi.mocked(gitConfigManager.unset).mockReset();
    vi.mocked(gitConfigManager.getMerged).mockReset();
    vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // config get <key>
  // ============================================================================

  describe("config get <key>", () => {
    it("should get a configuration value", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("vim");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "settings.editor"]);

      expect(gitConfigManager.get).toHaveBeenCalledWith("settings.editor", {
        global: true,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith("vim");
    });

    it("should get value with --global flag", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("code");

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "get",
        "settings.editor",
        "--global",
      ]);

      expect(gitConfigManager.get).toHaveBeenCalledWith("settings.editor", {
        global: true,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith("code");
    });

    it("should get value from workspace config with --workspace flag", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("nvim");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/project/workspace"
      );

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "get",
        "settings.editor",
        "--workspace",
      ]);

      expect(gitConfigManager.get).toHaveBeenCalledWith("settings.editor", {
        global: false,
        workspacePath: "/project/workspace",
      });
    });

    it("should prefer workspace config when in a workspace", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("workspace-editor");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/my/workspace"
      );

      await program.parseAsync(["node", "viben", "config", "get", "settings.editor"]);

      expect(gitConfigManager.get).toHaveBeenCalledWith("settings.editor", {
        global: false,
        workspacePath: "/my/workspace",
      });
    });

    it("should handle undefined value (no output)", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "nonexistent.key"]);

      // Should not output anything for undefined (git behavior)
      // The humanRender function doesn't log for undefined values
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should output JSON format with --json flag", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("test-value");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "config",
        "get",
        "my.key",
      ]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.key).toBe("my.key");
      expect(parsed.data.value).toBe("test-value");
    });

    it("should support dot notation keys", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("value");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "a.b.c.d"]);

      expect(gitConfigManager.get).toHaveBeenCalledWith("a.b.c.d", {
        global: true,
      });
    });

    it("should format object values as JSON", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue({ nested: "object" });
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "complex.key"]);

      expect(consoleLogSpy).toHaveBeenCalledWith('{"nested":"object"}');
    });

    it("should throw error when --workspace is used outside a workspace", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "get",
        "key",
        "--workspace",
      ]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // config set <key> <value>
  // ============================================================================

  describe("config set <key> <value>", () => {
    it("should set a configuration value", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "settings.editor",
        "vim",
      ]);

      expect(gitConfigManager.set).toHaveBeenCalledWith("settings.editor", "vim", {
        global: true,
      });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should set value with --global flag", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "settings.pager",
        "less",
        "--global",
      ]);

      expect(gitConfigManager.set).toHaveBeenCalledWith("settings.pager", "less", {
        global: true,
      });
    });

    it("should set value in workspace config with --workspace flag", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/my/project"
      );

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "mcp.enabled",
        "true",
        "--workspace",
      ]);

      expect(gitConfigManager.set).toHaveBeenCalledWith("mcp.enabled", "true", {
        global: false,
        workspacePath: "/my/project",
      });
    });

    it("should output JSON format with --json flag", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "config",
        "set",
        "test.key",
        "test-value",
      ]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.key).toBe("test.key");
      expect(parsed.data.value).toBe("test-value");
      expect(parsed.data.scope).toBe("global");
    });

    it("should support dot notation for setting nested values", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "deeply.nested.key",
        "value",
      ]);

      expect(gitConfigManager.set).toHaveBeenCalledWith(
        "deeply.nested.key",
        "value",
        { global: true }
      );
    });

    it("should handle setting numeric values", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "timeout",
        "30",
      ]);

      expect(gitConfigManager.set).toHaveBeenCalledWith("timeout", "30", {
        global: true,
      });
    });

    it("should handle setting boolean values", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "feature.enabled",
        "true",
      ]);

      expect(gitConfigManager.set).toHaveBeenCalledWith("feature.enabled", "true", {
        global: true,
      });
    });
  });

  // ============================================================================
  // config list
  // ============================================================================

  describe("config list", () => {
    it("should list all configuration values", async () => {
      vi.mocked(gitConfigManager.list).mockResolvedValue([
        { key: "settings.editor", value: "vim", origin: "global" },
        { key: "settings.theme", value: "dark", origin: "global" },
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "list"]);

      expect(gitConfigManager.list).toHaveBeenCalledWith({ global: true });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should list global config with --global flag", async () => {
      vi.mocked(gitConfigManager.list).mockResolvedValue([
        { key: "global.setting", value: "value", origin: "global" },
      ]);

      await program.parseAsync(["node", "viben", "config", "list", "--global"]);

      expect(gitConfigManager.list).toHaveBeenCalledWith({ global: true });
    });

    it("should list workspace config with --workspace flag", async () => {
      vi.mocked(gitConfigManager.list).mockResolvedValue([
        { key: "workspace.setting", value: "ws-value", origin: "workspace" },
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/my/workspace"
      );

      await program.parseAsync(["node", "viben", "config", "list", "--workspace"]);

      expect(gitConfigManager.list).toHaveBeenCalledWith({
        global: false,
        workspacePath: "/my/workspace",
      });
    });

    it("should show origin with --show-origin flag", async () => {
      vi.mocked(gitConfigManager.getMerged).mockResolvedValue([
        { key: "settings.editor", value: "vim", origin: "global" },
        { key: "settings.theme", value: "dark", origin: "workspace" },
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/my/workspace"
      );

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "list",
        "--show-origin",
      ]);

      expect(gitConfigManager.getMerged).toHaveBeenCalledWith("/my/workspace");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should output JSON format with --json flag", async () => {
      vi.mocked(gitConfigManager.list).mockResolvedValue([
        { key: "test.key", value: "test-value", origin: "global" },
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "--json", "config", "list"]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.items).toHaveLength(1);
      expect(parsed.data.items[0].key).toBe("test.key");
    });

    it("should handle empty configuration", async () => {
      vi.mocked(gitConfigManager.list).mockResolvedValue([]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "list"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should show merged config with --show-origin when in workspace", async () => {
      vi.mocked(gitConfigManager.getMerged).mockResolvedValue([
        { key: "global.setting", value: "g-value", origin: "global" },
        { key: "workspace.setting", value: "w-value", origin: "workspace" },
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/project"
      );

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "list",
        "--show-origin",
      ]);

      expect(gitConfigManager.getMerged).toHaveBeenCalledWith("/project");
    });

    it("should handle --show-origin when not in workspace", async () => {
      vi.mocked(gitConfigManager.getMerged).mockResolvedValue([
        { key: "setting", value: "value", origin: "global" },
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "list",
        "--show-origin",
      ]);

      expect(gitConfigManager.getMerged).toHaveBeenCalledWith(undefined);
    });
  });

  // ============================================================================
  // config unset <key>
  // ============================================================================

  describe("config unset <key>", () => {
    it("should remove a configuration key", async () => {
      vi.mocked(gitConfigManager.unset).mockResolvedValue(true);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "unset",
        "settings.editor",
      ]);

      expect(gitConfigManager.unset).toHaveBeenCalledWith("settings.editor", {
        global: true,
      });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should unset with --global flag", async () => {
      vi.mocked(gitConfigManager.unset).mockResolvedValue(true);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "unset",
        "old.key",
        "--global",
      ]);

      expect(gitConfigManager.unset).toHaveBeenCalledWith("old.key", {
        global: true,
      });
    });

    it("should unset from workspace config with --workspace flag", async () => {
      vi.mocked(gitConfigManager.unset).mockResolvedValue(true);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/my/project"
      );

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "unset",
        "workspace.key",
        "--workspace",
      ]);

      expect(gitConfigManager.unset).toHaveBeenCalledWith("workspace.key", {
        global: false,
        workspacePath: "/my/project",
      });
    });

    it("should exit with error when key not found", async () => {
      vi.mocked(gitConfigManager.unset).mockResolvedValue(false);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "unset",
        "nonexistent.key",
      ]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should output JSON format with --json flag", async () => {
      vi.mocked(gitConfigManager.unset).mockResolvedValue(true);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "config",
        "unset",
        "my.key",
      ]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.key).toBe("my.key");
      expect(parsed.data.deleted).toBe(true);
    });

    it("should output error JSON when key not found with --json flag", async () => {
      vi.mocked(gitConfigManager.unset).mockResolvedValue(false);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "config",
        "unset",
        "missing.key",
      ]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe("KEY_NOT_FOUND");
    });
  });

  // ============================================================================
  // config edit
  // ============================================================================

  describe("config edit", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should open editor for global config", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);
      process.env.EDITOR = "nano";

      await program.parseAsync(["node", "viben", "config", "edit"]);

      expect(spawn).toHaveBeenCalledWith(
        "nano",
        ["/home/user/.viben/config.yaml"],
        expect.objectContaining({ stdio: "inherit", shell: true })
      );
    });

    it("should use EDITOR environment variable", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);
      process.env.EDITOR = "code";

      await program.parseAsync(["node", "viben", "config", "edit"]);

      expect(spawn).toHaveBeenCalledWith(
        "code",
        ["/home/user/.viben/config.yaml"],
        expect.any(Object)
      );
    });

    it("should use VISUAL if EDITOR not set", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);
      delete process.env.EDITOR;
      process.env.VISUAL = "subl";

      await program.parseAsync(["node", "viben", "config", "edit"]);

      expect(spawn).toHaveBeenCalledWith(
        "subl",
        ["/home/user/.viben/config.yaml"],
        expect.any(Object)
      );
    });

    it("should default to vi if no EDITOR or VISUAL", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);
      delete process.env.EDITOR;
      delete process.env.VISUAL;

      await program.parseAsync(["node", "viben", "config", "edit"]);

      expect(spawn).toHaveBeenCalledWith(
        "vi",
        ["/home/user/.viben/config.yaml"],
        expect.any(Object)
      );
    });

    it("should edit global config with --global flag", async () => {
      process.env.EDITOR = "vim";

      await program.parseAsync(["node", "viben", "config", "edit", "--global"]);

      expect(spawn).toHaveBeenCalledWith(
        "vim",
        ["/home/user/.viben/config.yaml"],
        expect.any(Object)
      );
    });

    it("should edit workspace config with --workspace flag", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/my/project"
      );
      vi.mocked(getWorkspaceConfigPath).mockReturnValue(
        "/my/project/.viben/config.yaml"
      );
      process.env.EDITOR = "vim";

      await program.parseAsync(["node", "viben", "config", "edit", "--workspace"]);

      expect(spawn).toHaveBeenCalledWith(
        "vim",
        ["/my/project/.viben/config.yaml"],
        expect.any(Object)
      );
    });

    it("should output JSON format with --json flag", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);
      process.env.EDITOR = "nano";

      await program.parseAsync(["node", "viben", "--json", "config", "edit"]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
      expect(parsed.data.configPath).toBe("/home/user/.viben/config.yaml");
      expect(parsed.data.editor).toBe("nano");
    });

    it("should handle editor spawn error", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);
      process.env.EDITOR = "nonexistent-editor";

      // Override spawn to simulate error
      vi.mocked(spawn).mockImplementation(((() => {
        const mockProcess = {
          on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
            if (event === "error") {
              setTimeout(() => callback(new Error("spawn ENOENT")), 0);
            }
            return mockProcess;
          }),
        };
        return mockProcess;
      }) as unknown) as typeof spawn);

      await program.parseAsync(["node", "viben", "config", "edit"]);

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ============================================================================
  // Edge cases and error handling
  // ============================================================================

  describe("edge cases", () => {
    it("should handle config get with array index notation", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("server1");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "get",
        "mcp.enabled[0]",
      ]);

      expect(gitConfigManager.get).toHaveBeenCalledWith("mcp.enabled[0]", {
        global: true,
      });
    });

    it("should handle errors from gitConfigManager.get", async () => {
      vi.mocked(gitConfigManager.get).mockRejectedValue(
        new Error("Config file corrupted")
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "some.key"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle errors from gitConfigManager.set", async () => {
      vi.mocked(gitConfigManager.set).mockRejectedValue(
        new Error("Permission denied")
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "config",
        "set",
        "test.key",
        "value",
      ]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle errors from gitConfigManager.list", async () => {
      vi.mocked(gitConfigManager.list).mockRejectedValue(
        new Error("Cannot read config")
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "list"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should respect quiet mode", async () => {
      vi.mocked(gitConfigManager.set).mockResolvedValue(undefined);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "--quiet",
        "config",
        "set",
        "test.key",
        "value",
      ]);

      // In quiet mode, success operations should have minimal output
      expect(gitConfigManager.set).toHaveBeenCalled();
    });

    it("should handle null value formatting", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue(null);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "null.key"]);

      // null should format as empty string
      expect(consoleLogSpy).toHaveBeenCalledWith("");
    });

    it("should handle global flag from parent program", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue("global-value");
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/workspace"
      );

      await program.parseAsync([
        "node",
        "viben",
        "--global",
        "config",
        "get",
        "some.key",
      ]);

      // Global flag from parent should take precedence
      expect(gitConfigManager.get).toHaveBeenCalledWith("some.key", {
        global: true,
      });
    });
  });

  // ============================================================================
  // Output formatting tests
  // ============================================================================

  describe("output formatting", () => {
    it("should format boolean values correctly", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue(true);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "bool.key"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("true");
    });

    it("should format number values correctly", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue(42);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "num.key"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("42");
    });

    it("should format array values as JSON", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue(["a", "b", "c"]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "array.key"]);

      expect(consoleLogSpy).toHaveBeenCalledWith('["a","b","c"]');
    });

    it("should format nested object values as JSON", async () => {
      vi.mocked(gitConfigManager.get).mockResolvedValue({
        nested: { deep: "value" },
      });
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "config", "get", "obj.key"]);

      expect(consoleLogSpy).toHaveBeenCalledWith('{"nested":{"deep":"value"}}');
    });
  });
});
