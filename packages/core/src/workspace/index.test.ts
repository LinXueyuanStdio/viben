/**
 * WorkspaceManager Tests
 *
 * Tests for workspace management functionality:
 * - Workspace detection and traversal
 * - Known workspaces registry (CRUD operations)
 * - Workspace initialization
 * - Configuration read/write
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import {
  WorkspaceManager,
  WORKSPACE_DIR,
  WORKSPACE_CONFIG_FILE,
  DEFAULT_WORKSPACE_CONFIG,
} from "./index";
import { AlreadyExistsError, ValidationError } from "../error";
import type { WorkspaceConfigFile } from "./types";

describe("WorkspaceManager", () => {
  let tempDir: string;
  let stateDir: string;
  let originalStateDir: string | undefined;
  let manager: WorkspaceManager;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = await mkdtemp(join(tmpdir(), "viben-workspace-test-"));
    stateDir = await mkdtemp(join(tmpdir(), "viben-state-test-"));

    // Override VIBEN_STATE_DIR for testing
    originalStateDir = process.env.VIBEN_STATE_DIR;
    process.env.VIBEN_STATE_DIR = stateDir;

    // Create a fresh manager instance
    manager = new WorkspaceManager();
  });

  afterEach(async () => {
    // Restore original VIBEN_STATE_DIR
    if (originalStateDir !== undefined) {
      process.env.VIBEN_STATE_DIR = originalStateDir;
    } else {
      delete process.env.VIBEN_STATE_DIR;
    }

    // Clean up temporary directories
    await rm(tempDir, { recursive: true, force: true });
    await rm(stateDir, { recursive: true, force: true });
  });

  // Helper to create a workspace structure
  async function createWorkspaceStructure(
    basePath: string,
    config?: Partial<WorkspaceConfigFile>
  ): Promise<string> {
    const vibenDir = join(basePath, WORKSPACE_DIR);
    await mkdir(vibenDir, { recursive: true });

    const configContent = {
      ...DEFAULT_WORKSPACE_CONFIG,
      ...config,
    };

    const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);
    const { stringify } = await import("yaml");
    await writeFile(configPath, stringify(configContent), "utf-8");

    return basePath;
  }

  // ============================================================================
  // findWorkspaceRoot() Tests
  // ============================================================================

  describe("findWorkspaceRoot()", () => {
    it("should find workspace root when starting from workspace directory", async () => {
      const workspaceRoot = await createWorkspaceStructure(tempDir);

      const found = manager.findWorkspaceRoot(workspaceRoot);

      expect(found).toBe(workspaceRoot);
    });

    it("should find workspace root when starting from subdirectory", async () => {
      const workspaceRoot = await createWorkspaceStructure(tempDir);
      const subDir = join(workspaceRoot, "src", "components");
      await mkdir(subDir, { recursive: true });

      const found = manager.findWorkspaceRoot(subDir);

      expect(found).toBe(workspaceRoot);
    });

    it("should return null when no workspace is found", async () => {
      // Don't create any workspace structure
      const found = manager.findWorkspaceRoot(tempDir);

      expect(found).toBeNull();
    });

    it("should stop at filesystem root without infinite loop", async () => {
      // Start from a deeply nested non-workspace directory
      const deepPath = join(tempDir, "a", "b", "c", "d", "e");
      await mkdir(deepPath, { recursive: true });

      const found = manager.findWorkspaceRoot(deepPath);

      expect(found).toBeNull();
    });
  });

  // ============================================================================
  // Known Workspaces Registry Tests
  // ============================================================================

  describe("readKnownWorkspaces()", () => {
    it("should return empty workspaces when file does not exist", async () => {
      const known = await manager.readKnownWorkspaces();

      expect(known.version).toBe(1);
      expect(known.workspaces).toEqual([]);
    });

    it("should read existing workspaces file", async () => {
      // Pre-create workspaces.yaml
      const workspacesPath = join(stateDir, "workspaces.yaml");
      const { stringify } = await import("yaml");
      await writeFile(
        workspacesPath,
        stringify({
          version: 1,
          workspaces: [
            { path: "/test/path1", name: "Project1" },
            { path: "/test/path2", name: "Project2" },
          ],
        }),
        "utf-8"
      );

      const known = await manager.readKnownWorkspaces();

      expect(known.workspaces).toHaveLength(2);
      expect(known.workspaces[0].path).toBe("/test/path1");
      expect(known.workspaces[1].name).toBe("Project2");
    });
  });

  describe("registerWorkspace() / addKnownWorkspace()", () => {
    it("should register a new workspace", async () => {
      const workspacePath = join(tempDir, "my-project");
      await mkdir(workspacePath);

      await manager.registerWorkspace(workspacePath, "My Project");

      const known = await manager.readKnownWorkspaces();
      expect(known.workspaces).toHaveLength(1);
      expect(known.workspaces[0].path).toBe(workspacePath);
      expect(known.workspaces[0].name).toBe("My Project");
      expect(known.workspaces[0].registeredAt).toBeDefined();
      expect(known.workspaces[0].lastAccessed).toBeDefined();
    });

    it("should update lastAccessed when registering existing workspace", async () => {
      const workspacePath = join(tempDir, "existing-project");
      await mkdir(workspacePath);

      // Register first time
      await manager.registerWorkspace(workspacePath, "Original Name");
      const firstKnown = await manager.readKnownWorkspaces();
      const firstAccessed = firstKnown.workspaces[0].lastAccessed;
      const registeredAt = firstKnown.workspaces[0].registeredAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Register again with new name
      await manager.registerWorkspace(workspacePath, "New Name");
      const secondKnown = await manager.readKnownWorkspaces();

      // Should still be one workspace
      expect(secondKnown.workspaces).toHaveLength(1);
      // Name should be updated
      expect(secondKnown.workspaces[0].name).toBe("New Name");
      // registeredAt should remain the same
      expect(secondKnown.workspaces[0].registeredAt).toBe(registeredAt);
      // lastAccessed should be updated
      expect(secondKnown.workspaces[0].lastAccessed).not.toBe(firstAccessed);
    });

    it("should normalize path when registering", async () => {
      const workspacePath = join(tempDir, "project", "..", "project");
      await mkdir(join(tempDir, "project"));

      await manager.registerWorkspace(workspacePath);

      const known = await manager.readKnownWorkspaces();
      // Path should be normalized (no "..")
      expect(known.workspaces[0].path).toBe(join(tempDir, "project"));
    });
  });

  describe("unregisterWorkspace() / removeKnownWorkspace()", () => {
    it("should unregister an existing workspace", async () => {
      const workspacePath = join(tempDir, "to-remove");
      await mkdir(workspacePath);

      // Register first
      await manager.registerWorkspace(workspacePath);
      let known = await manager.readKnownWorkspaces();
      expect(known.workspaces).toHaveLength(1);

      // Unregister
      await manager.unregisterWorkspace(workspacePath);
      known = await manager.readKnownWorkspaces();
      expect(known.workspaces).toHaveLength(0);
    });

    it("should not fail when unregistering non-existent workspace", async () => {
      // Should not throw
      await manager.unregisterWorkspace("/non/existent/path");

      const known = await manager.readKnownWorkspaces();
      expect(known.workspaces).toHaveLength(0);
    });

    it("should only remove specified workspace", async () => {
      const path1 = join(tempDir, "project1");
      const path2 = join(tempDir, "project2");
      await mkdir(path1);
      await mkdir(path2);

      await manager.registerWorkspace(path1, "Project 1");
      await manager.registerWorkspace(path2, "Project 2");

      await manager.unregisterWorkspace(path1);

      const known = await manager.readKnownWorkspaces();
      expect(known.workspaces).toHaveLength(1);
      expect(known.workspaces[0].name).toBe("Project 2");
    });
  });

  // ============================================================================
  // listWorkspaces() Tests
  // ============================================================================

  describe("listWorkspaces()", () => {
    it("should return empty array when no workspaces registered", async () => {
      const workspaces = await manager.listWorkspaces();
      expect(workspaces).toEqual([]);
    });

    it("should list all valid registered workspaces", async () => {
      // Create two workspace directories with config
      const ws1 = await createWorkspaceStructure(
        join(tempDir, "workspace1"),
        { name: "Workspace 1" }
      );
      const ws2 = await createWorkspaceStructure(
        join(tempDir, "workspace2"),
        { name: "Workspace 2" }
      );

      // Register them
      await manager.registerWorkspace(ws1);
      await manager.registerWorkspace(ws2);

      const workspaces = await manager.listWorkspaces();

      expect(workspaces).toHaveLength(2);
      const names = workspaces.map((w) => w.name);
      expect(names).toContain("Workspace 1");
      expect(names).toContain("Workspace 2");
    });

    it("should filter out workspaces that no longer exist", async () => {
      // Create and register a workspace
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));
      await manager.registerWorkspace(wsPath, "My Workspace");

      // Remove the workspace directory
      await rm(wsPath, { recursive: true, force: true });

      const workspaces = await manager.listWorkspaces();

      // Should not include the deleted workspace
      expect(workspaces).toHaveLength(0);
    });

    it("should use custom name from registry over config name", async () => {
      const wsPath = await createWorkspaceStructure(
        join(tempDir, "workspace"),
        { name: "Config Name" }
      );

      // Register with custom name
      await manager.registerWorkspace(wsPath, "Registry Name");

      const workspaces = await manager.listWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe("Registry Name");
    });
  });

  // ============================================================================
  // getCurrentWorkspace() Tests
  // ============================================================================

  describe("getCurrentWorkspace()", () => {
    it("should return workspace info when in a workspace", async () => {
      const wsPath = await createWorkspaceStructure(
        join(tempDir, "workspace"),
        { name: "Current Workspace" }
      );

      const workspace = await manager.getCurrentWorkspace(wsPath);

      expect(workspace).not.toBeNull();
      expect(workspace?.name).toBe("Current Workspace");
      expect(workspace?.path).toBe(wsPath);
    });

    it("should return workspace info from subdirectory", async () => {
      const wsPath = await createWorkspaceStructure(
        join(tempDir, "workspace"),
        { name: "Parent Workspace" }
      );
      const subDir = join(wsPath, "src", "lib");
      await mkdir(subDir, { recursive: true });

      const workspace = await manager.getCurrentWorkspace(subDir);

      expect(workspace).not.toBeNull();
      expect(workspace?.path).toBe(wsPath);
    });

    it("should return null when not in a workspace", async () => {
      const workspace = await manager.getCurrentWorkspace(tempDir);
      expect(workspace).toBeNull();
    });
  });

  // ============================================================================
  // getWorkspaceInfo() Tests
  // ============================================================================

  describe("getWorkspaceInfo()", () => {
    it("should return full workspace info with all fields", async () => {
      const wsPath = await createWorkspaceStructure(
        join(tempDir, "workspace"),
        {
          name: "Full Info Workspace",
          mcp: { enabled: ["filesystem", "git"] },
          skills: { enabled: ["code-review"] },
          agents: ["main", "reviewer"],
        }
      );

      const info = await manager.getWorkspaceInfo(wsPath);

      expect(info).not.toBeNull();
      expect(info?.name).toBe("Full Info Workspace");
      expect(info?.path).toBe(wsPath);
      expect(info?.mcp?.enabled).toEqual(["filesystem", "git"]);
      expect(info?.skills?.enabled).toEqual(["code-review"]);
      expect(info?.agents).toEqual(["main", "reviewer"]);
      expect(info?.configPath).toBe(join(wsPath, WORKSPACE_DIR, WORKSPACE_CONFIG_FILE));
    });

    it("should return null for non-workspace directory", async () => {
      const info = await manager.getWorkspaceInfo(tempDir);
      expect(info).toBeNull();
    });

    it("should use directory name as default workspace name", async () => {
      // Create workspace without name in config
      const wsPath = await createWorkspaceStructure(
        join(tempDir, "my-project-dir"),
        { name: undefined }
      );

      const info = await manager.getWorkspaceInfo(wsPath);

      expect(info?.name).toBe("my-project-dir");
    });
  });

  // ============================================================================
  // init() Tests
  // ============================================================================

  describe("init()", () => {
    it("should initialize a new workspace", async () => {
      const targetDir = join(tempDir, "new-workspace");
      await mkdir(targetDir);

      const result = await manager.init({ targetDir });

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(targetDir, WORKSPACE_DIR));
      expect(result.files).toContain(WORKSPACE_CONFIG_FILE);
      expect(existsSync(join(targetDir, WORKSPACE_DIR, WORKSPACE_CONFIG_FILE))).toBe(true);
    });

    it("should create agents directory with default agent", async () => {
      const targetDir = join(tempDir, "workspace-with-agents");
      await mkdir(targetDir);

      const result = await manager.init({ targetDir });

      expect(result.files).toContain("agents/main.yaml");
      expect(existsSync(join(targetDir, WORKSPACE_DIR, "agents", "main.yaml"))).toBe(true);
    });

    it("should register workspace after initialization", async () => {
      const targetDir = join(tempDir, "auto-registered");
      await mkdir(targetDir);

      await manager.init({ targetDir });

      const known = await manager.readKnownWorkspaces();
      expect(known.workspaces.some((w) => w.path === targetDir)).toBe(true);
    });

    it("should throw AlreadyExistsError if workspace exists", async () => {
      const targetDir = await createWorkspaceStructure(join(tempDir, "existing"));

      await expect(manager.init({ targetDir })).rejects.toThrow(AlreadyExistsError);
    });

    it("should allow force re-initialization", async () => {
      const targetDir = await createWorkspaceStructure(join(tempDir, "force-init"));

      // Should not throw with force option
      const result = await manager.init({ targetDir, force: true });

      expect(result.success).toBe(true);
    });

    it("should throw ValidationError for nested workspaces", async () => {
      // Create parent workspace
      const parentDir = await createWorkspaceStructure(join(tempDir, "parent"));

      // Try to init inside it
      const nestedDir = join(parentDir, "nested");
      await mkdir(nestedDir);

      await expect(manager.init({ targetDir: nestedDir })).rejects.toThrow(
        ValidationError
      );
    });
  });

  // ============================================================================
  // Utility Methods Tests
  // ============================================================================

  describe("isInWorkspace()", () => {
    it("should return true when in a workspace", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));

      expect(manager.isInWorkspace(wsPath)).toBe(true);
    });

    it("should return false when not in a workspace", async () => {
      expect(manager.isInWorkspace(tempDir)).toBe(false);
    });
  });

  describe("getCurrentWorkspacePath()", () => {
    it("should return workspace path when in workspace", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));
      const subDir = join(wsPath, "deep", "nested");
      await mkdir(subDir, { recursive: true });

      expect(manager.getCurrentWorkspacePath(subDir)).toBe(wsPath);
    });

    it("should return null when not in workspace", async () => {
      expect(manager.getCurrentWorkspacePath(tempDir)).toBeNull();
    });
  });

  describe("getEnclosingWorkspace()", () => {
    it("should return enclosing workspace for nested directory", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));
      const nestedDir = join(wsPath, "src");
      await mkdir(nestedDir);

      expect(manager.getEnclosingWorkspace(nestedDir)).toBe(wsPath);
    });

    it("should return null for workspace root itself", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));

      expect(manager.getEnclosingWorkspace(wsPath)).toBeNull();
    });

    it("should return null when not in workspace", async () => {
      expect(manager.getEnclosingWorkspace(tempDir)).toBeNull();
    });
  });

  describe("getWorkspace*Dir() path helpers", () => {
    it("should return correct agents directory path", () => {
      const wsPath = "/test/workspace";
      expect(manager.getWorkspaceAgentsDir(wsPath)).toBe(
        join(wsPath, WORKSPACE_DIR, "agents")
      );
    });

    it("should return correct MCP directory path", () => {
      const wsPath = "/test/workspace";
      expect(manager.getWorkspaceMcpDir(wsPath)).toBe(
        join(wsPath, WORKSPACE_DIR, "mcp")
      );
    });

    it("should return correct skills directory path", () => {
      const wsPath = "/test/workspace";
      expect(manager.getWorkspaceSkillsDir(wsPath)).toBe(
        join(wsPath, WORKSPACE_DIR, "skills")
      );
    });

    it("should return correct config path", () => {
      const wsPath = "/test/workspace";
      expect(manager.getWorkspaceConfigPath(wsPath)).toBe(
        join(wsPath, WORKSPACE_DIR, WORKSPACE_CONFIG_FILE)
      );
    });
  });

  // ============================================================================
  // Config Read/Write Tests
  // ============================================================================

  describe("readConfig()", () => {
    it("should read workspace configuration", async () => {
      const wsPath = await createWorkspaceStructure(
        join(tempDir, "workspace"),
        {
          name: "Config Test",
          settings: { editor: "vim" },
        }
      );

      const config = await manager.readConfig(wsPath);

      expect(config).not.toBeNull();
      expect(config?.name).toBe("Config Test");
      expect(config?.settings?.editor).toBe("vim");
    });

    it("should return null for non-workspace", async () => {
      const config = await manager.readConfig(tempDir);
      expect(config).toBeNull();
    });
  });

  describe("writeConfig()", () => {
    it("should write workspace configuration", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));

      const newConfig: WorkspaceConfigFile = {
        version: 1,
        name: "Updated Name",
        settings: { editor: "neovim", color: "always" },
        mcp: { enabled: ["new-mcp"] },
      };

      await manager.writeConfig(wsPath, newConfig);

      // Read back and verify
      const config = await manager.readConfig(wsPath);
      expect(config?.name).toBe("Updated Name");
      expect(config?.settings?.editor).toBe("neovim");
      expect(config?.mcp?.enabled).toEqual(["new-mcp"]);
    });
  });

  // ============================================================================
  // listWorkspaceAgents() Tests
  // ============================================================================

  describe("listWorkspaceAgents()", () => {
    it("should return empty array when no agents directory", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));

      const agents = await manager.listWorkspaceAgents(wsPath);

      expect(agents).toEqual([]);
    });

    it("should list agent directories", async () => {
      const wsPath = await createWorkspaceStructure(join(tempDir, "workspace"));
      const agentsDir = join(wsPath, WORKSPACE_DIR, "agents");
      await mkdir(join(agentsDir, "agent1"), { recursive: true });
      await mkdir(join(agentsDir, "agent2"), { recursive: true });
      // Create a file (should be ignored)
      await writeFile(join(agentsDir, "config.yaml"), "", "utf-8");

      const agents = await manager.listWorkspaceAgents(wsPath);

      expect(agents).toHaveLength(2);
      expect(agents).toContain("agent1");
      expect(agents).toContain("agent2");
    });
  });
});
