/**
 * Workspace Initialization Tests
 *
 * Tests for workspace initialization functionality:
 * - initWorkspace() - Basic initialization
 * - initFromTemplate() - Template-based initialization
 * - Workspace template management
 * - Existing workspace detection
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { parse } from "yaml";
import {
  initWorkspace,
  initFromTemplate,
  listWorkspaceTemplates,
  getWorkspaceTemplate,
  createWorkspaceTemplate,
  deleteWorkspaceTemplate,
  workspaceExists,
  isInsideWorkspace,
} from "./init";
import {
  WORKSPACE_DIR,
  WORKSPACE_CONFIG_FILE,
  AGENTS_DIR,
} from "./index";
import { AlreadyExistsError, ValidationError, NotFoundError } from "../error";
import { getWorkspaceTemplatesDir, getWorkspaceTemplateDir } from "../config/paths";
import { writeYaml } from "../config/yaml";
import type { WorkspaceConfigFile, WorkspaceTemplateConfig } from "./types";

describe("Workspace Initialization", () => {
  let tempDir: string;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-workspace-init-test-"));
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = join(tempDir, ".viben-global");
    // Create the state directory
    await mkdir(join(tempDir, ".viben-global"), { recursive: true });
  });

  afterEach(async () => {
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // initWorkspace() Tests - Basic Initialization
  // ==========================================================================

  describe("initWorkspace()", () => {
    it("should create .viben directory with config.yaml", async () => {
      const targetDir = join(tempDir, "my-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(targetDir, WORKSPACE_DIR));
      expect(result.files).toContain(WORKSPACE_CONFIG_FILE);
      expect(existsSync(join(targetDir, WORKSPACE_DIR, WORKSPACE_CONFIG_FILE))).toBe(true);
    });

    it("should create default agent configuration", async () => {
      const targetDir = join(tempDir, "project-with-agent");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.files).toContain(`${AGENTS_DIR}/main.yaml`);
      expect(existsSync(join(targetDir, WORKSPACE_DIR, AGENTS_DIR, "main.yaml"))).toBe(true);
    });

    it("should set workspace name from directory name", async () => {
      const targetDir = join(tempDir, "my-awesome-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.config.name).toBe("my-awesome-project");
    });

    it("should set version to 1", async () => {
      const targetDir = join(tempDir, "versioned-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.config.version).toBe(1);
    });

    it("should set createdAt and updatedAt timestamps", async () => {
      const targetDir = join(tempDir, "timestamped-project");
      await mkdir(targetDir, { recursive: true });

      const before = new Date().toISOString();
      const result = await initWorkspace({ targetDir });
      const after = new Date().toISOString();

      expect(result.config.createdAt).toBeDefined();
      expect(result.config.updatedAt).toBeDefined();
      // Timestamps should be between before and after
      expect(result.config.createdAt! >= before).toBe(true);
      expect(result.config.createdAt! <= after).toBe(true);
    });

    it("should write valid YAML config file", async () => {
      const targetDir = join(tempDir, "yaml-project");
      await mkdir(targetDir, { recursive: true });

      await initWorkspace({ targetDir });

      const configPath = join(targetDir, WORKSPACE_DIR, WORKSPACE_CONFIG_FILE);
      const content = await readFile(configPath, "utf-8");
      const config = parse(content) as WorkspaceConfigFile;

      expect(config.version).toBe(1);
      expect(config.name).toBe("yaml-project");
    });

    it("should use current directory when targetDir not specified", async () => {
      const { realpath } = await import("node:fs/promises");
      const originalCwd = process.cwd();
      const targetDir = join(tempDir, "cwd-project");
      await mkdir(targetDir, { recursive: true });

      try {
        process.chdir(targetDir);
        const result = await initWorkspace();

        // Use realpath to handle macOS /var -> /private/var symlink
        const expectedPath = await realpath(join(targetDir, WORKSPACE_DIR));
        const actualPath = await realpath(result.path);
        expect(actualPath).toBe(expectedPath);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  // ==========================================================================
  // Existing Workspace Detection Tests
  // ==========================================================================

  describe("Existing Workspace Detection", () => {
    it("should throw AlreadyExistsError when workspace already exists", async () => {
      const targetDir = join(tempDir, "existing-workspace");
      await mkdir(targetDir, { recursive: true });

      // First init
      await initWorkspace({ targetDir });

      // Second init should fail
      await expect(initWorkspace({ targetDir })).rejects.toThrow(AlreadyExistsError);
    });

    it("should allow re-initialization with force option", async () => {
      const targetDir = join(tempDir, "force-reinit");
      await mkdir(targetDir, { recursive: true });

      // First init
      await initWorkspace({ targetDir });

      // Second init with force should succeed
      const result = await initWorkspace({ targetDir, force: true });

      expect(result.success).toBe(true);
    });

    it("should throw ValidationError when inside existing workspace", async () => {
      const parentDir = join(tempDir, "parent-workspace");
      const childDir = join(parentDir, "child-project");
      await mkdir(childDir, { recursive: true });

      // Initialize parent workspace
      await initWorkspace({ targetDir: parentDir });

      // Try to init in child - should fail
      await expect(initWorkspace({ targetDir: childDir })).rejects.toThrow(ValidationError);
    });

    it("should detect nested workspace attempt with proper error message", async () => {
      const parentDir = join(tempDir, "nested-parent");
      const nestedDir = join(parentDir, "deeply", "nested", "dir");
      await mkdir(nestedDir, { recursive: true });

      await initWorkspace({ targetDir: parentDir });

      try {
        await initWorkspace({ targetDir: nestedDir });
        expect.fail("Should have thrown ValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toContain("Nested workspaces are not supported");
      }
    });
  });

  // ==========================================================================
  // Template-Based Initialization Tests
  // ==========================================================================

  describe("initFromTemplate()", () => {
    it("should throw NotFoundError for non-existent template", async () => {
      const targetDir = join(tempDir, "template-project");
      await mkdir(targetDir, { recursive: true });

      await expect(initFromTemplate(targetDir, "non-existent-template")).rejects.toThrow(
        NotFoundError
      );
    });

    it("should initialize workspace from template", async () => {
      // Create a template first
      const templateId = "test-template";
      const templatesDir = getWorkspaceTemplatesDir();
      const templateDir = getWorkspaceTemplateDir(templateId);
      await mkdir(templateDir, { recursive: true });

      const templateConfig: WorkspaceTemplateConfig = {
        name: "Test Template",
        description: "A test template",
        workspaceConfig: {
          settings: {
            editor: "vim",
            color: "always",
          },
        },
        createdAt: new Date().toISOString(),
      };
      await writeYaml(join(templateDir, "template.yaml"), templateConfig);

      // Initialize from template
      const targetDir = join(tempDir, "from-template-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initFromTemplate(targetDir, templateId);

      expect(result.success).toBe(true);
      expect(result.config.settings?.editor).toBe("vim");
      expect(result.config.settings?.color).toBe("always");
    });

    it("should create template-specified directories", async () => {
      // Create template with custom directories
      const templateId = "dirs-template";
      const templateDir = getWorkspaceTemplateDir(templateId);
      await mkdir(templateDir, { recursive: true });

      const templateConfig: WorkspaceTemplateConfig = {
        name: "Dirs Template",
        directories: ["custom-dir", "another-dir/nested"],
        createdAt: new Date().toISOString(),
      };
      await writeYaml(join(templateDir, "template.yaml"), templateConfig);

      const targetDir = join(tempDir, "dirs-project");
      await mkdir(targetDir, { recursive: true });

      await initFromTemplate(targetDir, templateId);

      expect(existsSync(join(targetDir, WORKSPACE_DIR, "custom-dir"))).toBe(true);
      expect(existsSync(join(targetDir, WORKSPACE_DIR, "another-dir", "nested"))).toBe(true);
    });

    it("should copy template files", async () => {
      // Create template with files
      const templateId = "files-template";
      const templateDir = getWorkspaceTemplateDir(templateId);
      await mkdir(templateDir, { recursive: true });

      // Create a file in template
      await writeFile(join(templateDir, "README.md"), "# Project Readme");
      await mkdir(join(templateDir, "config"), { recursive: true });
      await writeFile(join(templateDir, "config", "settings.json"), '{"key": "value"}');

      const templateConfig: WorkspaceTemplateConfig = {
        name: "Files Template",
        files: ["README.md", "config/settings.json"],
        createdAt: new Date().toISOString(),
      };
      await writeYaml(join(templateDir, "template.yaml"), templateConfig);

      const targetDir = join(tempDir, "files-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initFromTemplate(targetDir, templateId);

      expect(result.files).toContain("README.md");
      expect(result.files).toContain("config/settings.json");
      expect(existsSync(join(targetDir, WORKSPACE_DIR, "README.md"))).toBe(true);
      expect(existsSync(join(targetDir, WORKSPACE_DIR, "config", "settings.json"))).toBe(true);

      // Verify file content
      const readmeContent = await readFile(join(targetDir, WORKSPACE_DIR, "README.md"), "utf-8");
      expect(readmeContent).toBe("# Project Readme");
    });
  });

  // ==========================================================================
  // Template Management Tests
  // ==========================================================================

  describe("Workspace Template Management", () => {
    describe("createWorkspaceTemplate()", () => {
      it("should create a new template", async () => {
        const template = await createWorkspaceTemplate("my-template", {
          name: "My Template",
          description: "A custom template",
        });

        expect(template.id).toBe("my-template");
        expect(template.name).toBe("My Template");
        expect(template.description).toBe("A custom template");
        expect(template.createdAt).toBeDefined();
      });

      it("should throw AlreadyExistsError for duplicate template", async () => {
        await createWorkspaceTemplate("duplicate-template", {
          name: "First Template",
        });

        await expect(
          createWorkspaceTemplate("duplicate-template", {
            name: "Second Template",
          })
        ).rejects.toThrow(AlreadyExistsError);
      });
    });

    describe("getWorkspaceTemplate()", () => {
      it("should return null for non-existent template", async () => {
        const template = await getWorkspaceTemplate("non-existent");
        expect(template).toBeNull();
      });

      it("should return template metadata", async () => {
        await createWorkspaceTemplate("get-test", {
          name: "Get Test Template",
          description: "For testing get",
        });

        const template = await getWorkspaceTemplate("get-test");

        expect(template).not.toBeNull();
        expect(template?.id).toBe("get-test");
        expect(template?.name).toBe("Get Test Template");
      });
    });

    describe("listWorkspaceTemplates()", () => {
      it("should return empty array when no templates exist", async () => {
        const templates = await listWorkspaceTemplates();
        expect(templates).toEqual([]);
      });

      it("should list all templates", async () => {
        await createWorkspaceTemplate("template-1", { name: "Template 1" });
        await createWorkspaceTemplate("template-2", { name: "Template 2" });
        await createWorkspaceTemplate("template-3", { name: "Template 3" });

        const templates = await listWorkspaceTemplates();

        expect(templates).toHaveLength(3);
        const names = templates.map((t) => t.name);
        expect(names).toContain("Template 1");
        expect(names).toContain("Template 2");
        expect(names).toContain("Template 3");
      });
    });

    describe("deleteWorkspaceTemplate()", () => {
      it("should delete existing template", async () => {
        await createWorkspaceTemplate("to-delete", { name: "Delete Me" });

        const result = await deleteWorkspaceTemplate("to-delete");

        expect(result).toBe(true);
        const template = await getWorkspaceTemplate("to-delete");
        expect(template).toBeNull();
      });

      it("should return false for non-existent template", async () => {
        const result = await deleteWorkspaceTemplate("non-existent");
        expect(result).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Utility Function Tests
  // ==========================================================================

  describe("Utility Functions", () => {
    describe("workspaceExists()", () => {
      it("should return false for non-existent workspace", async () => {
        const targetDir = join(tempDir, "no-workspace");
        await mkdir(targetDir, { recursive: true });

        expect(workspaceExists(targetDir)).toBe(false);
      });

      it("should return true for existing workspace", async () => {
        const targetDir = join(tempDir, "has-workspace");
        await mkdir(targetDir, { recursive: true });
        await initWorkspace({ targetDir });

        expect(workspaceExists(targetDir)).toBe(true);
      });
    });

    describe("isInsideWorkspace()", () => {
      it("should return null when not inside workspace", async () => {
        const targetDir = join(tempDir, "outside-workspace");
        await mkdir(targetDir, { recursive: true });

        expect(isInsideWorkspace(targetDir)).toBeNull();
      });

      it("should return workspace root when inside workspace", async () => {
        const workspaceDir = join(tempDir, "parent-ws");
        const childDir = join(workspaceDir, "src", "components");
        await mkdir(childDir, { recursive: true });
        await initWorkspace({ targetDir: workspaceDir });

        const result = isInsideWorkspace(childDir);

        expect(result).toBe(workspaceDir);
      });

      it("should return workspace root for workspace root itself", async () => {
        const workspaceDir = join(tempDir, "root-ws");
        await mkdir(workspaceDir, { recursive: true });
        await initWorkspace({ targetDir: workspaceDir });

        const result = isInsideWorkspace(workspaceDir);

        expect(result).toBe(workspaceDir);
      });
    });
  });

  // ==========================================================================
  // Config File Content Tests
  // ==========================================================================

  describe("Config File Content", () => {
    it("should include default settings", async () => {
      const targetDir = join(tempDir, "settings-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.config.settings).toBeDefined();
      expect(result.config.settings?.editor).toBe("code");
      expect(result.config.settings?.pager).toBe("less");
      expect(result.config.settings?.color).toBe("auto");
    });

    it("should include empty MCP and skills config", async () => {
      const targetDir = join(tempDir, "mcp-skills-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.config.mcp).toBeDefined();
      expect(result.config.mcp?.enabled).toEqual([]);
      expect(result.config.skills).toBeDefined();
      expect(result.config.skills?.enabled).toEqual([]);
    });

    it("should include empty agents array", async () => {
      const targetDir = join(tempDir, "agents-project");
      await mkdir(targetDir, { recursive: true });

      const result = await initWorkspace({ targetDir });

      expect(result.config.agents).toEqual([]);
    });
  });
});
