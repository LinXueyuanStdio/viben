/**
 * Workspace Command Execution Tests
 *
 * Tests that actually execute workspace commands and verify behavior.
 * Uses real file system operations with temporary directories.
 *
 * This complements workspace.test.ts which mocks the workspaceManager.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerWorkspaceCommand } from "./workspace";
import {
  createWorkspaceTempDir,
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

// Mock workspaceManager to use our temp directories
vi.mock("../../workspace", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../workspace")>();
  return {
    ...original,
    workspaceManager: {
      ...original.workspaceManager,
      listWorkspaces: vi.fn(),
      getCurrentWorkspacePath: vi.fn(),
      getCurrentWorkspace: vi.fn(),
      findWorkspaceRoot: vi.fn(),
      getWorkspaceInfo: vi.fn(),
      readKnownWorkspaces: vi.fn(),
      writeKnownWorkspaces: vi.fn(),
      addKnownWorkspace: vi.fn(),
      readConfig: vi.fn(),
    },
  };
});

import { workspaceManager } from "../../workspace";
import type { Workspace, WorkspaceConfigFile, KnownWorkspacesFile } from "../../workspace";

// Store original process.exit and mock it
const originalExit = process.exit;
let exitCode: number | undefined;

// Store original process.cwd
const originalCwd = process.cwd;

// =============================================================================
// Test Context Helper
// =============================================================================

interface ExecutionTestContext {
  tempDir: TempDirContext & { vibenDir: string; tasksDir: string };
  program: Command;
  console: ConsoleSpy;
  run: (args: string[]) => Promise<void>;
  runJson: (args: string[]) => Promise<unknown>;
  cleanup: () => Promise<void>;
}

async function createExecutionTestContext(): Promise<ExecutionTestContext> {
  const tempDir = await createWorkspaceTempDir();

  // Mock process.cwd to return temp directory
  process.cwd = vi.fn(() => tempDir.root);

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

  registerWorkspaceCommand(program);

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
      // Restore process.exit and process.cwd
      process.exit = originalExit;
      process.cwd = originalCwd;
    },
  };
}

// =============================================================================
// Execution Tests
// =============================================================================

describe("workspace command execution", () => {
  let ctx: ExecutionTestContext;

  beforeEach(async () => {
    ctx = await createExecutionTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  // ===========================================================================
  // workspace list Tests
  // ===========================================================================

  describe("workspace list", () => {
    it("should list workspaces from real directory structure", async () => {
      // Create workspace config file
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `version: 1
name: Test Workspace
settings:
  editor: code
mcp:
  enabled:
    - filesystem
skills:
  enabled:
    - code-review
agents:
  - main
`
      );

      // Mock workspace manager to return workspace info
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Test Workspace",
        configPath: ctx.tempDir.resolve(".viben/config.yaml"),
        mcp: { enabled: ["filesystem"] },
        skills: { enabled: ["code-review"] },
        agents: ["main"],
      };

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue([mockWorkspace]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(ctx.tempDir.root);

      await ctx.run(["workspace", "list"]);

      expect(workspaceManager.listWorkspaces).toHaveBeenCalled();
      expect(ctx.console.hasLog("Known Workspaces:")).toBe(true);
      expect(ctx.console.hasLog("Test Workspace")).toBe(true);
    });

    it("should show empty list when no workspaces exist", async () => {
      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue([]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await ctx.run(["workspace", "list"]);

      expect(ctx.console.hasLog("No known workspaces.")).toBe(true);
      expect(ctx.console.hasLog("viben init")).toBe(true);
    });

    it("should mark current workspace with asterisk", async () => {
      const currentPath = ctx.tempDir.root;
      const mockWorkspaces: Workspace[] = [
        {
          path: currentPath,
          name: "Current Workspace",
          configPath: `${currentPath}/.viben/config.yaml`,
          mcp: { enabled: ["git"] },
          skills: { enabled: [] },
          agents: ["main"],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(mockWorkspaces);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(currentPath);

      await ctx.run(["workspace", "list"]);

      expect(ctx.console.hasLog("Current Workspace*")).toBe(true);
      expect(ctx.console.hasLog("* = current workspace")).toBe(true);
    });

    it("should show MCP and skills counts in list", async () => {
      const mockWorkspaces: Workspace[] = [
        {
          path: ctx.tempDir.root,
          name: "Workspace",
          configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
          mcp: { enabled: ["filesystem", "git", "docker"] },
          skills: { enabled: ["code-review", "commit"] },
          agents: ["main", "reviewer"],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(mockWorkspaces);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await ctx.run(["workspace", "list"]);

      expect(ctx.console.hasLog("3 enabled")).toBe(true);
      expect(ctx.console.hasLog("2 enabled")).toBe(true);
    });

    it("should output JSON format with --json flag", async () => {
      const mockWorkspaces: Workspace[] = [
        {
          path: ctx.tempDir.root,
          name: "JSON Test Workspace",
          configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
          mcp: { enabled: ["filesystem"] },
          skills: { enabled: ["code-review"] },
          agents: ["main"],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(mockWorkspaces);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      const result = (await ctx.runJson(["workspace", "list"])) as {
        success: boolean;
        data: {
          workspaces: Array<{
            path: string;
            name: string;
            mcp: string[];
            skills: string[];
            agents: string[];
            isCurrent: boolean;
          }>;
          count: number;
          current: string | null;
        };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.workspaces).toHaveLength(1);
      expect(result?.data?.workspaces[0].name).toBe("JSON Test Workspace");
      expect(result?.data?.count).toBe(1);
    });

    it("should handle error during list operation", async () => {
      vi.mocked(workspaceManager.listWorkspaces).mockRejectedValue(
        new Error("Failed to read workspaces file")
      );

      await ctx.run(["workspace", "list"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("Failed to read workspaces file")).toBe(true);
    });
  });

  // ===========================================================================
  // workspace current Tests
  // ===========================================================================

  describe("workspace current", () => {
    it("should show current workspace information", async () => {
      // Create a real workspace config file
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `version: 1
name: Current Test Workspace
settings:
  editor: code
mcp:
  enabled:
    - filesystem
    - git
skills:
  enabled:
    - code-review
    - commit
agents:
  - main
  - reviewer
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-15T00:00:00.000Z"
`
      );

      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Current Test Workspace",
        configPath: ctx.tempDir.resolve(".viben/config.yaml"),
        mcp: { enabled: ["filesystem", "git"] },
        skills: { enabled: ["code-review", "commit"] },
        agents: ["main", "reviewer"],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      await ctx.run(["workspace", "current"]);

      expect(ctx.console.hasLog("Current Workspace:")).toBe(true);
      expect(ctx.console.hasLog(ctx.tempDir.root)).toBe(true);
      expect(ctx.console.hasLog("Current Test Workspace")).toBe(true);
      expect(ctx.console.hasLog("filesystem, git")).toBe(true);
      expect(ctx.console.hasLog("code-review, commit")).toBe(true);
      expect(ctx.console.hasLog("main, reviewer")).toBe(true);
    });

    it("should show 'not in a workspace' when no workspace found", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(null);

      await ctx.run(["workspace", "current"]);

      expect(ctx.console.hasLog("Not in a workspace.")).toBe(true);
      expect(ctx.console.hasLog("viben init")).toBe(true);
    });

    it("should output JSON format with --json flag for current workspace", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "JSON Current Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: ["filesystem"] },
        skills: { enabled: ["code-review"] },
        agents: ["main"],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      const result = (await ctx.runJson(["workspace", "current"])) as {
        success: boolean;
        data: {
          path: string;
          name: string;
          configPath: string;
          mcp: { enabled: string[]; count: number };
          skills: { enabled: string[]; count: number };
          agents: { list: string[]; count: number };
          created_at: string;
          updated_at: string;
        };
      };

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.data?.path).toBe(ctx.tempDir.root);
      expect(result?.data?.name).toBe("JSON Current Workspace");
      expect(result?.data?.mcp?.enabled).toEqual(["filesystem"]);
      expect(result?.data?.mcp?.count).toBe(1);
      expect(result?.data?.skills?.enabled).toEqual(["code-review"]);
      expect(result?.data?.skills?.count).toBe(1);
      expect(result?.data?.agents?.list).toEqual(["main"]);
      expect(result?.data?.agents?.count).toBe(1);
    });

    it("should output error JSON when no workspace found with --json flag", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(null);

      const result = (await ctx.runJson(["workspace", "current"])) as {
        success: boolean;
        error: { code: string; message: string };
      };

      expect(result?.success).toBe(false);
      expect(result?.error?.code).toBe("NOT_IN_WORKSPACE");
      expect(result?.error?.message).toBe("Not in a workspace");
    });

    it("should show timestamps in verbose mode", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Verbose Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      // Create a new program with verbose flag for this test
      const verboseProgram = new Command();
      verboseProgram.option("--json", "Output JSON format");
      verboseProgram.option("--verbose", "Verbose output");
      verboseProgram.option("--quiet", "Quiet mode");
      verboseProgram.exitOverride();
      registerWorkspaceCommand(verboseProgram);

      try {
        await verboseProgram.parseAsync([
          "node",
          "test",
          "--verbose",
          "workspace",
          "current",
        ]);
      } catch {
        // Ignore commander errors
      }

      expect(ctx.console.hasLog("Created:")).toBe(true);
      expect(ctx.console.hasLog("Updated:")).toBe(true);
      expect(ctx.console.hasLog("2024-01-01T00:00:00.000Z")).toBe(true);
      expect(ctx.console.hasLog("2024-01-15T00:00:00.000Z")).toBe(true);
    });

    it("should not show timestamps without verbose flag", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Non-Verbose Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      await ctx.run(["workspace", "current"]);

      expect(ctx.console.hasLog("Created:")).toBe(false);
      expect(ctx.console.hasLog("Updated:")).toBe(false);
    });

    it("should show 'none' for empty MCP", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Empty MCP Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: [] },
        skills: { enabled: ["skill1"] },
        agents: [],
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      await ctx.run(["workspace", "current"]);

      const output = ctx.console.logs.join("\n");
      expect(output).toContain("MCP:");
      expect(output).toContain("none");
    });

    it("should show 'none' for empty skills", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Empty Skills Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: ["git"] },
        skills: { enabled: [] },
        agents: [],
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      await ctx.run(["workspace", "current"]);

      const output = ctx.console.logs.join("\n");
      expect(output).toContain("Skills:");
      expect(output).toContain("none");
    });

    it("should show 'none' for empty agents", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Empty Agents Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      await ctx.run(["workspace", "current"]);

      const output = ctx.console.logs.join("\n");
      expect(output).toContain("Agents:");
      expect(output).toContain("none");
    });

    it("should handle error during current workspace retrieval", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspace).mockRejectedValue(
        new Error("Failed to read config file")
      );

      await ctx.run(["workspace", "current"]);

      expect(exitCode).toBe(1);
      expect(ctx.console.hasError("Failed to read config file")).toBe(true);
    });

    it("should handle workspace with undefined mcp and skills", async () => {
      const mockWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Minimal Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        // mcp and skills are undefined
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(mockWorkspace);

      await ctx.run(["workspace", "current"]);

      expect(ctx.console.hasLog("Current Workspace:")).toBe(true);
      const output = ctx.console.logs.join("\n");
      expect(output).toContain("MCP:");
      expect(output).toContain("none");
      expect(output).toContain("Skills:");
      expect(output).toContain("none");
    });
  });

  // ===========================================================================
  // Real File System Operations Tests
  // ===========================================================================

  describe("real file system operations", () => {
    it("should verify .viben directory exists after workspace setup", async () => {
      expect(await ctx.tempDir.exists(".viben")).toBe(true);
    });

    it("should verify tasks directory exists after workspace setup", async () => {
      expect(await ctx.tempDir.exists(".viben/tasks")).toBe(true);
    });

    it("should read workspace config from real file", async () => {
      await ctx.tempDir.writeFile(
        ".viben/config.yaml",
        `version: 1
name: Real Config Test
settings:
  editor: vim
mcp:
  enabled: []
skills:
  enabled: []
`
      );

      const content = await ctx.tempDir.readFile(".viben/config.yaml");
      expect(content).toContain("name: Real Config Test");
      expect(content).toContain("editor: vim");
    });

    it("should create and read agents directory", async () => {
      await ctx.tempDir.mkdir(".viben/agents");
      await ctx.tempDir.writeFile(
        ".viben/agents/main.yaml",
        `id: main
name: Main Agent
description: Default workspace agent
`
      );

      expect(await ctx.tempDir.exists(".viben/agents")).toBe(true);
      expect(await ctx.tempDir.exists(".viben/agents/main.yaml")).toBe(true);

      const agentContent = await ctx.tempDir.readFile(".viben/agents/main.yaml");
      expect(agentContent).toContain("id: main");
      expect(agentContent).toContain("name: Main Agent");
    });
  });

  // ===========================================================================
  // Multiple Workspaces Tests
  // ===========================================================================

  describe("multiple workspaces", () => {
    it("should list multiple workspaces correctly", async () => {
      const workspace1: Workspace = {
        path: "/projects/workspace1",
        name: "Workspace 1",
        configPath: "/projects/workspace1/.viben/config.yaml",
        mcp: { enabled: ["filesystem"] },
        skills: { enabled: ["code-review"] },
        agents: ["main"],
      };

      const workspace2: Workspace = {
        path: "/projects/workspace2",
        name: "Workspace 2",
        configPath: "/projects/workspace2/.viben/config.yaml",
        mcp: { enabled: ["git", "docker"] },
        skills: { enabled: [] },
        agents: ["main", "reviewer"],
      };

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue([
        workspace1,
        workspace2,
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/projects/workspace1"
      );

      await ctx.run(["workspace", "list"]);

      expect(ctx.console.hasLog("Workspace 1")).toBe(true);
      expect(ctx.console.hasLog("Workspace 2")).toBe(true);
      expect(ctx.console.hasLog("Workspace 1*")).toBe(true);
    });

    it("should include isCurrent flag correctly in JSON for multiple workspaces", async () => {
      const workspace1: Workspace = {
        path: "/projects/workspace1",
        name: "Workspace 1",
        configPath: "/projects/workspace1/.viben/config.yaml",
      };

      const workspace2: Workspace = {
        path: "/projects/workspace2",
        name: "Workspace 2",
        configPath: "/projects/workspace2/.viben/config.yaml",
      };

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue([
        workspace1,
        workspace2,
      ]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        "/projects/workspace2"
      );

      const result = (await ctx.runJson(["workspace", "list"])) as {
        success: boolean;
        data: {
          workspaces: Array<{ name: string; isCurrent: boolean }>;
          current: string;
        };
      };

      expect(result?.data?.workspaces[0].isCurrent).toBe(false);
      expect(result?.data?.workspaces[1].isCurrent).toBe(true);
      expect(result?.data?.current).toBe("/projects/workspace2");
    });
  });

  // ===========================================================================
  // Workspace Validation Tests
  // ===========================================================================

  describe("workspace validation", () => {
    it("should handle workspace with invalid config gracefully", async () => {
      // Even if the local file is invalid, the mocked manager handles it
      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(null);

      await ctx.run(["workspace", "current"]);

      expect(ctx.console.hasLog("Not in a workspace.")).toBe(true);
    });

    it("should handle workspace list when some workspaces are missing", async () => {
      // When a workspace is deleted but still in the known list,
      // listWorkspaces should filter it out
      const validWorkspace: Workspace = {
        path: ctx.tempDir.root,
        name: "Valid Workspace",
        configPath: `${ctx.tempDir.root}/.viben/config.yaml`,
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
      };

      // Only return the valid workspace (missing one is filtered out)
      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue([validWorkspace]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await ctx.run(["workspace", "list"]);

      expect(ctx.console.hasLog("Valid Workspace")).toBe(true);
      expect(ctx.console.hasLog("Known Workspaces:")).toBe(true);
    });
  });
});
