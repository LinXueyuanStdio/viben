/**
 * Workspace Command Tests
 *
 * Tests for workspace CLI commands:
 * - workspace list: List all known workspaces
 * - workspace current: Show current workspace information
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerWorkspaceCommand } from "./workspace";
import type { Workspace } from "../../workspace";

// Mock workspaceManager
vi.mock("../../workspace", () => ({
  workspaceManager: {
    listWorkspaces: vi.fn(),
    getCurrentWorkspacePath: vi.fn(),
    getCurrentWorkspace: vi.fn(),
  },
}));

// Import the mocked module
import { workspaceManager } from "../../workspace";

// Mock chalk to avoid color codes in test output
vi.mock("chalk", () => ({
  default: {
    bold: (s: string) => s,
    gray: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
  },
}));

describe("workspace command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    // Create a fresh program
    program = new Command();
    program.option("--json", "Output JSON format");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register the workspace command
    registerWorkspaceCommand(program);

    // Capture console output
    logOutput = [];
    errorOutput = [];
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logOutput.push(args.map(String).join(" "));
    });
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        errorOutput.push(args.map(String).join(" "));
      });

    // Mock process.exit to throw instead of exiting
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Reset all mocks
    vi.mocked(workspaceManager.listWorkspaces).mockReset();
    vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReset();
    vi.mocked(workspaceManager.getCurrentWorkspace).mockReset();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ============================================================================
  // workspace list Tests
  // ============================================================================

  describe("workspace list", () => {
    it("should list all known workspaces", async () => {
      const mockWorkspaces: Workspace[] = [
        {
          path: "/projects/workspace1",
          name: "Workspace 1",
          configPath: "/projects/workspace1/.viben/config.yaml",
          mcp: { enabled: ["filesystem", "git"] },
          skills: { enabled: ["code-review"] },
          agents: ["main"],
        },
        {
          path: "/projects/workspace2",
          name: "Workspace 2",
          configPath: "/projects/workspace2/.viben/config.yaml",
          mcp: { enabled: [] },
          skills: { enabled: [] },
          agents: [],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(
        mockWorkspaces
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "workspace", "list"]);

      expect(workspaceManager.listWorkspaces).toHaveBeenCalled();
      // Check that output contains workspace names
      const output = logOutput.join("\n");
      expect(output).toContain("Known Workspaces:");
      expect(output).toContain("Workspace 1");
      expect(output).toContain("Workspace 2");
    });

    it("should output JSON format with --json flag", async () => {
      const mockWorkspaces: Workspace[] = [
        {
          path: "/projects/workspace1",
          name: "Workspace 1",
          configPath: "/projects/workspace1/.viben/config.yaml",
          mcp: { enabled: ["filesystem"] },
          skills: { enabled: ["code-review"] },
          agents: ["main"],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(
        mockWorkspaces
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "--json", "workspace", "list"]);

      expect(logOutput.length).toBeGreaterThan(0);
      // Parse the JSON output
      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.workspaces).toHaveLength(1);
      expect(jsonOutput.data.workspaces[0].name).toBe("Workspace 1");
      expect(jsonOutput.data.workspaces[0].path).toBe("/projects/workspace1");
      expect(jsonOutput.data.count).toBe(1);
    });

    it("should mark current workspace with asterisk", async () => {
      const currentPath = "/projects/current-workspace";
      const mockWorkspaces: Workspace[] = [
        {
          path: "/projects/other-workspace",
          name: "Other Workspace",
          configPath: "/projects/other-workspace/.viben/config.yaml",
          mcp: { enabled: [] },
          skills: { enabled: [] },
          agents: [],
        },
        {
          path: currentPath,
          name: "Current Workspace",
          configPath: `${currentPath}/.viben/config.yaml`,
          mcp: { enabled: ["git"] },
          skills: { enabled: [] },
          agents: ["main"],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(
        mockWorkspaces
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        currentPath
      );

      await program.parseAsync(["node", "viben", "workspace", "list"]);

      const output = logOutput.join("\n");
      // Current workspace should be marked with asterisk
      expect(output).toContain("Current Workspace*");
      expect(output).toContain("* = current workspace");
    });

    it("should show MCP and skills counts", async () => {
      const mockWorkspaces: Workspace[] = [
        {
          path: "/projects/workspace1",
          name: "Workspace 1",
          configPath: "/projects/workspace1/.viben/config.yaml",
          mcp: { enabled: ["filesystem", "git", "docker"] },
          skills: { enabled: ["code-review", "commit"] },
          agents: ["main", "reviewer"],
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(
        mockWorkspaces
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "workspace", "list"]);

      const output = logOutput.join("\n");
      // Should show counts
      expect(output).toContain("3 enabled");
      expect(output).toContain("2 enabled");
    });

    it("should show hint when no workspaces found", async () => {
      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue([]);
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(null);

      await program.parseAsync(["node", "viben", "workspace", "list"]);

      const output = logOutput.join("\n");
      expect(output).toContain("No known workspaces.");
      expect(output).toContain("viben init");
    });

    it("should include isCurrent flag in JSON output", async () => {
      const currentPath = "/projects/current-workspace";
      const mockWorkspaces: Workspace[] = [
        {
          path: "/projects/other",
          name: "Other",
          configPath: "/projects/other/.viben/config.yaml",
        },
        {
          path: currentPath,
          name: "Current",
          configPath: `${currentPath}/.viben/config.yaml`,
        },
      ];

      vi.mocked(workspaceManager.listWorkspaces).mockResolvedValue(
        mockWorkspaces
      );
      vi.mocked(workspaceManager.getCurrentWorkspacePath).mockReturnValue(
        currentPath
      );

      await program.parseAsync(["node", "viben", "--json", "workspace", "list"]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.data.workspaces[0].isCurrent).toBe(false);
      expect(jsonOutput.data.workspaces[1].isCurrent).toBe(true);
      expect(jsonOutput.data.current).toBe(currentPath);
    });

    it("should handle error during list", async () => {
      vi.mocked(workspaceManager.listWorkspaces).mockRejectedValue(
        new Error("Failed to list workspaces")
      );

      await expect(
        program.parseAsync(["node", "viben", "workspace", "list"])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Failed to list workspaces");
    });
  });

  // ============================================================================
  // workspace current Tests
  // ============================================================================

  describe("workspace current", () => {
    it("should show current workspace information", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/current-workspace",
        name: "Current Workspace",
        configPath: "/projects/current-workspace/.viben/config.yaml",
        mcp: { enabled: ["filesystem", "git"] },
        skills: { enabled: ["code-review", "commit"] },
        agents: ["main", "reviewer"],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).toContain("Current Workspace:");
      expect(output).toContain("/projects/current-workspace");
      expect(output).toContain("Current Workspace");
      expect(output).toContain("filesystem, git");
      expect(output).toContain("2 enabled");
      expect(output).toContain("code-review, commit");
      expect(output).toContain("main, reviewer");
    });

    it("should output JSON format with --json flag", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/my-workspace",
        name: "My Workspace",
        configPath: "/projects/my-workspace/.viben/config.yaml",
        mcp: { enabled: ["filesystem"] },
        skills: { enabled: ["code-review"] },
        agents: ["main"],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "workspace",
        "current",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.data.path).toBe("/projects/my-workspace");
      expect(jsonOutput.data.name).toBe("My Workspace");
      expect(jsonOutput.data.mcp.enabled).toEqual(["filesystem"]);
      expect(jsonOutput.data.mcp.count).toBe(1);
      expect(jsonOutput.data.skills.enabled).toEqual(["code-review"]);
      expect(jsonOutput.data.skills.count).toBe(1);
      expect(jsonOutput.data.agents.list).toEqual(["main"]);
      expect(jsonOutput.data.agents.count).toBe(1);
    });

    it("should handle no current workspace", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(null);

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).toContain("Not in a workspace.");
      expect(output).toContain("viben init");
    });

    it("should output error JSON when no workspace found with --json flag", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(null);

      await program.parseAsync([
        "node",
        "viben",
        "--json",
        "workspace",
        "current",
      ]);

      const jsonOutput = JSON.parse(logOutput.join(""));
      expect(jsonOutput.success).toBe(false);
      expect(jsonOutput.error.code).toBe("NOT_IN_WORKSPACE");
      expect(jsonOutput.error.message).toBe("Not in a workspace");
    });

    it("should show timestamps in verbose mode", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/workspace",
        name: "Workspace",
        configPath: "/projects/workspace/.viben/config.yaml",
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync([
        "node",
        "viben",
        "--verbose",
        "workspace",
        "current",
      ]);

      const output = logOutput.join("\n");
      expect(output).toContain("Created:");
      expect(output).toContain("Updated:");
      expect(output).toContain("2024-01-01T00:00:00.000Z");
      expect(output).toContain("2024-01-15T00:00:00.000Z");
    });

    it("should not show timestamps in non-verbose mode", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/workspace",
        name: "Workspace",
        configPath: "/projects/workspace/.viben/config.yaml",
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-15T00:00:00.000Z",
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).not.toContain("Created:");
      expect(output).not.toContain("Updated:");
    });

    it("should show 'none' for empty MCP", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/workspace",
        name: "Workspace",
        configPath: "/projects/workspace/.viben/config.yaml",
        mcp: { enabled: [] },
        skills: { enabled: ["skill1"] },
        agents: [],
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).toContain("MCP:");
      expect(output).toContain("none");
    });

    it("should show 'none' for empty skills", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/workspace",
        name: "Workspace",
        configPath: "/projects/workspace/.viben/config.yaml",
        mcp: { enabled: ["git"] },
        skills: { enabled: [] },
        agents: [],
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).toContain("Skills:");
      expect(output).toContain("none");
    });

    it("should show 'none' for empty agents", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/workspace",
        name: "Workspace",
        configPath: "/projects/workspace/.viben/config.yaml",
        mcp: { enabled: [] },
        skills: { enabled: [] },
        agents: [],
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).toContain("Agents:");
      expect(output).toContain("none");
    });

    it("should handle error during current workspace retrieval", async () => {
      vi.mocked(workspaceManager.getCurrentWorkspace).mockRejectedValue(
        new Error("Failed to get current workspace")
      );

      await expect(
        program.parseAsync(["node", "viben", "workspace", "current"])
      ).rejects.toThrow("process.exit(1)");

      const errOutput = errorOutput.join("\n");
      expect(errOutput).toContain("Failed to get current workspace");
    });

    it("should handle workspace with undefined mcp and skills", async () => {
      const mockWorkspace: Workspace = {
        path: "/projects/workspace",
        name: "Workspace",
        configPath: "/projects/workspace/.viben/config.yaml",
        // mcp and skills are undefined
      };

      vi.mocked(workspaceManager.getCurrentWorkspace).mockResolvedValue(
        mockWorkspace
      );

      await program.parseAsync(["node", "viben", "workspace", "current"]);

      const output = logOutput.join("\n");
      expect(output).toContain("Current Workspace:");
      expect(output).toContain("MCP:");
      expect(output).toContain("none");
      expect(output).toContain("Skills:");
      expect(output).toContain("none");
    });
  });
});
