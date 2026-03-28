/**
 * Init Command Tests
 *
 * Tests for the `viben init` CLI command:
 * - `viben init` creates .viben/config.yaml in current directory
 * - `viben init --from <template>` initializes from template
 * - `viben init --force` overwrites existing workspace
 * - `viben init --list-templates` lists available templates
 * - JSON output includes created files and path
 * - Error handling for already initialized workspace
 * - Success message shows next steps
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { Command } from "commander";
import { registerInitCommand } from "./init";

// Mock the workspace module
vi.mock("../../workspace", () => ({
  workspaceManager: {},
  initWorkspace: vi.fn(),
  listWorkspaceTemplates: vi.fn(),
}));

// Mock process.cwd
const mockCwd = "/mock/project/path";

// Import mocked functions after vi.mock
import { initWorkspace, listWorkspaceTemplates } from "../../workspace";
import type {
  InitWorkspaceResult,
  WorkspaceTemplate,
} from "../../workspace";
import { AlreadyExistsError, ValidationError } from "../../error";

describe("viben init command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a fresh program for each test
    program = new Command();
    program.option("--json", "Output JSON");
    program.option("--verbose", "Verbose output");
    program.option("--quiet", "Quiet mode");

    // Register the init command
    registerInitCommand(program);

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock process.exit to prevent actual exit
    vi.spyOn(process, "exit").mockImplementation(((code?: number | string | null) => {
      throw new Error(`Process exited with code ${code}`);
    }) as never);

    // Mock process.cwd
    vi.spyOn(process, "cwd").mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Basic Initialization Tests
  // ==========================================================================

  describe("viben init (basic)", () => {
    it("should create .viben/config.yaml in current directory", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml", "agents/main.yaml"],
        config: {
          version: 1,
          name: "project",
          settings: { editor: "code", pager: "less", color: "auto" },
          agents: [],
          mcp: { enabled: [] },
          skills: { enabled: [] },
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init"]);

      expect(initWorkspace).toHaveBeenCalledWith({
        targetDir: mockCwd,
        template: undefined,
        force: undefined,
      });
    });

    it("should display success message with created files", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml", "agents/main.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init"]);

      // Check success message was displayed
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workspace initialized successfully")
      );
    });

    it("should show next steps in human output", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init"]);

      // Should show next steps
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Next steps/)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("viben config list")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("viben agent list")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("viben mcp install")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("viben skill install")
      );
    });

    it("should show created files in human output", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml", "agents/main.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init"]);

      // Should show created files
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(".viben/config.yaml")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(".viben/agents/main.yaml")
      );
    });
  });

  // ==========================================================================
  // JSON Output Tests
  // ==========================================================================

  describe("viben init --json", () => {
    it("should output JSON with success, path and files", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: "/mock/project/path/.viben",
        files: ["config.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init", "--json"]);

      // Find the JSON output call
      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.success !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(true);
      expect(output.data.success).toBe(true);
      expect(output.data.path).toBe("/mock/project/path/.viben");
      expect(output.data.files).toContain("config.yaml");
    });

    it("should include template in JSON output when specified", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: "/mock/project/path/.viben",
        files: ["config.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync([
        "node",
        "viben",
        "init",
        "--from",
        "my-template",
        "--json",
      ]);

      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.success !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.data.template).toBe("my-template");
    });
  });

  // ==========================================================================
  // Template Initialization Tests
  // ==========================================================================

  describe("viben init --from <template>", () => {
    it("should pass template option to initWorkspace", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml", "custom-file.txt"],
        config: {
          version: 1,
          name: "project",
          settings: { editor: "vim" },
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync([
        "node",
        "viben",
        "init",
        "--from",
        "my-template",
      ]);

      expect(initWorkspace).toHaveBeenCalledWith({
        targetDir: mockCwd,
        template: "my-template",
        force: undefined,
      });
    });

    it("should handle template initialization success", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml", "template-file.md"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync([
        "node",
        "viben",
        "init",
        "--from",
        "starter-template",
      ]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workspace initialized successfully")
      );
    });
  });

  // ==========================================================================
  // Force Initialization Tests
  // ==========================================================================

  describe("viben init --force", () => {
    it("should pass force option to initWorkspace", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init", "--force"]);

      expect(initWorkspace).toHaveBeenCalledWith({
        targetDir: mockCwd,
        template: undefined,
        force: true,
      });
    });

    it("should allow re-initialization with --force", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml", "agents/main.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync(["node", "viben", "init", "--force"]);

      expect(initWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({ force: true })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Workspace initialized successfully")
      );
    });

    it("should allow combining --force with --from", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      await program.parseAsync([
        "node",
        "viben",
        "init",
        "--force",
        "--from",
        "template",
      ]);

      expect(initWorkspace).toHaveBeenCalledWith({
        targetDir: mockCwd,
        template: "template",
        force: true,
      });
    });
  });

  // ==========================================================================
  // List Templates Tests
  // ==========================================================================

  describe("viben init --list-templates", () => {
    it("should list available templates", async () => {
      const mockTemplates: WorkspaceTemplate[] = [
        {
          id: "basic",
          name: "Basic Template",
          description: "A basic starter template",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "advanced",
          name: "Advanced Template",
          description: "An advanced template with more features",
          created_at: "2024-01-02T00:00:00.000Z",
        },
      ];

      vi.mocked(listWorkspaceTemplates).mockResolvedValue(mockTemplates);

      await program.parseAsync(["node", "viben", "init", "--list-templates"]);

      expect(listWorkspaceTemplates).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Available Templates")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("basic")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("advanced")
      );
    });

    it("should display template descriptions", async () => {
      const mockTemplates: WorkspaceTemplate[] = [
        {
          id: "my-template",
          name: "My Template",
          description: "This is a test description",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      vi.mocked(listWorkspaceTemplates).mockResolvedValue(mockTemplates);

      await program.parseAsync(["node", "viben", "init", "--list-templates"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("This is a test description")
      );
    });

    it("should handle empty template list", async () => {
      vi.mocked(listWorkspaceTemplates).mockResolvedValue([]);

      await program.parseAsync(["node", "viben", "init", "--list-templates"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No workspace templates available")
      );
    });

    it("should suggest creating template when list is empty", async () => {
      vi.mocked(listWorkspaceTemplates).mockResolvedValue([]);

      await program.parseAsync(["node", "viben", "init", "--list-templates"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("viben workspace template create")
      );
    });

    it("should output JSON when --json flag is used with --list-templates", async () => {
      const mockTemplates: WorkspaceTemplate[] = [
        {
          id: "test-template",
          name: "Test Template",
          description: "A test template",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      vi.mocked(listWorkspaceTemplates).mockResolvedValue(mockTemplates);

      await program.parseAsync([
        "node",
        "viben",
        "init",
        "--list-templates",
        "--json",
      ]);

      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.success !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(true);
      expect(output.data.templates).toHaveLength(1);
      expect(output.data.templates[0].id).toBe("test-template");
      expect(output.data.count).toBe(1);
    });

    it("should not call initWorkspace when listing templates", async () => {
      vi.mocked(listWorkspaceTemplates).mockResolvedValue([]);

      await program.parseAsync(["node", "viben", "init", "--list-templates"]);

      expect(initWorkspace).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("Error handling", () => {
    it("should handle AlreadyExistsError for initialized workspace", async () => {
      vi.mocked(initWorkspace).mockRejectedValue(
        new AlreadyExistsError("Workspace", mockCwd)
      );

      await expect(
        program.parseAsync(["node", "viben", "init"])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("already exists")
      );
    });

    it("should handle ValidationError for nested workspace", async () => {
      vi.mocked(initWorkspace).mockRejectedValue(
        new ValidationError("Already inside workspace. Nested workspaces are not supported.")
      );

      await expect(
        program.parseAsync(["node", "viben", "init"])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Nested workspaces are not supported")
      );
    });

    it("should output JSON error when --json flag is used", async () => {
      vi.mocked(initWorkspace).mockRejectedValue(
        new AlreadyExistsError("Workspace", mockCwd)
      );

      await expect(
        program.parseAsync(["node", "viben", "init", "--json"])
      ).rejects.toThrow("Process exited");

      const jsonCall = consoleLogSpy.mock.calls.find((call: unknown[]) => {
        try {
          const parsed = JSON.parse(String(call[0]));
          return parsed.success === false;
        } catch {
          return false;
        }
      });

      expect(jsonCall).toBeDefined();
      const output = JSON.parse(String(jsonCall![0]));
      expect(output.success).toBe(false);
      expect(output.error).toBeDefined();
      expect(output.error.code).toBe("ALREADY_EXISTS");
    });

    it("should handle unknown errors gracefully", async () => {
      vi.mocked(initWorkspace).mockRejectedValue(new Error("Unknown error"));

      await expect(
        program.parseAsync(["node", "viben", "init"])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown error")
      );
    });

    it("should handle template not found error", async () => {
      // Using a generic Error that would be converted by the error handler
      vi.mocked(initWorkspace).mockRejectedValue(
        new Error('WorkspaceTemplate "non-existent" not found')
      );

      await expect(
        program.parseAsync([
          "node",
          "viben",
          "init",
          "--from",
          "non-existent",
        ])
      ).rejects.toThrow("Process exited");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });
  });

  // ==========================================================================
  // Exit Code Tests
  // ==========================================================================

  describe("Exit codes", () => {
    it("should not exit on success", async () => {
      const mockResult: InitWorkspaceResult = {
        success: true,
        path: `${mockCwd}/.viben`,
        files: ["config.yaml"],
        config: {
          version: 1,
          name: "project",
        },
      };

      vi.mocked(initWorkspace).mockResolvedValue(mockResult);

      // Should not throw - successful execution
      await program.parseAsync(["node", "viben", "init"]);

      // If we get here, the command completed without calling process.exit
      expect(true).toBe(true);
    });

    it("should exit with code 1 on error", async () => {
      vi.mocked(initWorkspace).mockRejectedValue(
        new AlreadyExistsError("Workspace", mockCwd)
      );

      await expect(
        program.parseAsync(["node", "viben", "init"])
      ).rejects.toThrow("Process exited with code 1");
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("Command registration", () => {
    it("should register init command with correct options", () => {
      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      expect(initCmd).toBeDefined();
      expect(initCmd!.description()).toBe(
        "Initialize a Viben workspace in the current directory"
      );
    });

    it("should have --from option", () => {
      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const fromOption = initCmd!.options.find(
        (opt) => opt.long === "--from"
      );
      expect(fromOption).toBeDefined();
      expect(fromOption!.description).toBe("Initialize from a template");
    });

    it("should have --force option", () => {
      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const forceOption = initCmd!.options.find(
        (opt) => opt.long === "--force"
      );
      expect(forceOption).toBeDefined();
      expect(forceOption!.description).toBe(
        "Force initialization even if workspace already exists"
      );
    });

    it("should have --list-templates option", () => {
      const initCmd = program.commands.find((cmd) => cmd.name() === "init");
      const listOption = initCmd!.options.find(
        (opt) => opt.long === "--list-templates"
      );
      expect(listOption).toBeDefined();
      expect(listOption!.description).toBe(
        "List available workspace templates"
      );
    });
  });
});
