/**
 * Workspace management for Viben
 *
 * Handles workspace detection, listing, and information retrieval.
 */
import { readdir, stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, resolve, parse } from "node:path";
import { stringify } from "yaml";
import { getStateDir } from "../config/paths";
import { readYaml, writeYaml, fileExists } from "../config/yaml";
import { AlreadyExistsError, ValidationError } from "../error";
import type {
  Workspace,
  WorkspaceConfigFile,
  KnownWorkspacesFile,
  KnownWorkspaceEntry,
  InitWorkspaceOptions,
  InitWorkspaceResult,
} from "./types";

export * from "./types";

// Export init functions
export {
  initFromTemplate,
  listWorkspaceTemplates,
  getWorkspaceTemplate,
  createWorkspaceTemplate,
  deleteWorkspaceTemplate,
  workspaceExists,
  isInsideWorkspace,
  validateDeveloperName,
} from "./init";

// Export update functions
export { updateIdeaTypes, updateRewardTypes } from "./update";

// Import initWorkspace for internal use (renamed to avoid conflict with local export)
import { initWorkspace as initWorkspaceFromInit } from "./init";

/**
 * Workspace directory name
 */
export const WORKSPACE_DIR = ".viben";

/**
 * Workspace config file name
 */
export const WORKSPACE_CONFIG_FILE = "config.yaml";

/**
 * Known workspaces file name (in global state dir)
 */
const KNOWN_WORKSPACES_FILE = "workspaces.yaml";

/**
 * Agents directory name within workspace
 */
export const AGENTS_DIR = "agents";

/**
 * Default workspace configuration
 */
export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfigFile = {
  version: 1,
  settings: {
    editor: "code",
    pager: "less",
    color: "auto",
  },
  agents: [],
  mcp: {
    enabled: [],
  },
  skills: {
    enabled: [],
  },
};

/**
 * Default agent configuration YAML content
 */
const DEFAULT_AGENT_CONFIG = `# Main agent configuration
id: main
name: Main Agent
description: Default workspace agent

# Model configuration (optional, uses defaults)
# model: claude-sonnet-4-20250514
# provider: anthropic
`;

/**
 * Get the path to the known workspaces file
 */
function getKnownWorkspacesPath(): string {
  return join(getStateDir(), KNOWN_WORKSPACES_FILE);
}

/**
 * WorkspaceManager handles workspace operations
 */
export class WorkspaceManager {
  /**
   * Find the workspace root directory by traversing up from the given directory.
   * Returns null if no workspace is found.
   */
  findWorkspaceRoot(startDir: string): string | null {
    let currentDir = resolve(startDir);
    const root = parse(currentDir).root;

    while (currentDir !== root) {
      const vibenDir = join(currentDir, WORKSPACE_DIR);
      const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);

      if (existsSync(configPath)) {
        return currentDir;
      }

      const parentDir = join(currentDir, "..");
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Read the known workspaces from the global state directory
   */
  async readKnownWorkspaces(): Promise<KnownWorkspacesFile> {
    const filePath = getKnownWorkspacesPath();

    if (!fileExists(filePath)) {
      return { version: 1, workspaces: [] };
    }

    const data = await readYaml<KnownWorkspacesFile>(filePath);
    return data || { version: 1, workspaces: [] };
  }

  /**
   * Write known workspaces to the global state directory
   */
  async writeKnownWorkspaces(data: KnownWorkspacesFile): Promise<void> {
    const filePath = getKnownWorkspacesPath();
    await writeYaml(filePath, data);
  }

  /**
   * Add a workspace to the known workspaces list
   */
  async addKnownWorkspace(workspace_path: string, name?: string): Promise<void> {
    const known = await this.readKnownWorkspaces();
    const normalizedPath = resolve(workspace_path);

    // Check if already exists
    const existingIndex = known.workspaces.findIndex(
      (w) => w.path === normalizedPath
    );

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update existing
      known.workspaces[existingIndex].lastAccessed = now;
      if (name) {
        known.workspaces[existingIndex].name = name;
      }
    } else {
      // Add new
      known.workspaces.push({
        path: normalizedPath,
        name,
        registeredAt: now,
        lastAccessed: now,
      });
    }

    await this.writeKnownWorkspaces(known);
  }

  /**
   * Register a workspace (alias for addKnownWorkspace)
   * Adds a workspace to the global registry
   */
  async registerWorkspace(workspace_path: string, name?: string): Promise<void> {
    return this.addKnownWorkspace(workspace_path, name);
  }

  /**
   * Remove a workspace from the known workspaces list
   */
  async removeKnownWorkspace(workspace_path: string): Promise<void> {
    const known = await this.readKnownWorkspaces();
    const normalizedPath = resolve(workspace_path);

    known.workspaces = known.workspaces.filter((w) => w.path !== normalizedPath);
    await this.writeKnownWorkspaces(known);
  }

  /**
   * Unregister a workspace (alias for removeKnownWorkspace)
   * Removes a workspace from the global registry
   */
  async unregisterWorkspace(workspace_path: string): Promise<void> {
    return this.removeKnownWorkspace(workspace_path);
  }

  /**
   * Get workspace info for a given path.
   * Returns null if the path is not a valid workspace.
   */
  async getWorkspaceInfo(workspace_path: string): Promise<Workspace | null> {
    const vibenDir = join(workspace_path, WORKSPACE_DIR);
    const configPath = join(vibenDir, WORKSPACE_CONFIG_FILE);

    if (!fileExists(configPath)) {
      return null;
    }

    try {
      const config = await readYaml<WorkspaceConfigFile>(configPath);
      if (!config) {
        return null;
      }

      const fileStat = await stat(configPath);

      return {
        path: workspace_path,
        name: config.name || basename(workspace_path),
        configPath,
        mcp: config.mcp,
        skills: config.skills,
        agents: config.agents,
        created_at: config.created_at || fileStat.birthtime.toISOString(),
        updated_at: config.updated_at || fileStat.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * List all known workspaces with their info.
   * Filters out workspaces that no longer exist.
   */
  async listWorkspaces(): Promise<Workspace[]> {
    const known = await this.readKnownWorkspaces();
    const workspaces: Workspace[] = [];

    for (const entry of known.workspaces) {
      const info = await this.getWorkspaceInfo(entry.path);
      if (info) {
        // Override name if specified in known workspaces
        if (entry.name) {
          info.name = entry.name;
        }
        workspaces.push(info);
      }
    }

    return workspaces;
  }

  /**
   * Get current workspace info based on the current working directory.
   * Returns null if not in a workspace.
   */
  async getCurrentWorkspace(cwd?: string): Promise<Workspace | null> {
    const workingDir = cwd || process.cwd();
    const workspaceRoot = this.findWorkspaceRoot(workingDir);

    if (!workspaceRoot) {
      return null;
    }

    return this.getWorkspaceInfo(workspaceRoot);
  }

  /**
   * Check if a directory is in a workspace
   */
  isInWorkspace(cwd?: string): boolean {
    const workingDir = cwd || process.cwd();
    return this.findWorkspaceRoot(workingDir) !== null;
  }

  /**
   * Get current workspace path (if in a workspace).
   * Returns null if not in a workspace.
   */
  getCurrentWorkspacePath(cwd?: string): string | null {
    const workingDir = cwd || process.cwd();
    return this.findWorkspaceRoot(workingDir);
  }

  /**
   * List agents in a workspace
   */
  async listWorkspaceAgents(workspace_path: string): Promise<string[]> {
    const agentsDir = join(workspace_path, WORKSPACE_DIR, "agents");

    if (!fileExists(agentsDir)) {
      return [];
    }

    try {
      const entries = await readdir(agentsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Get the agents directory for a workspace
   */
  getWorkspaceAgentsDir(workspace_path: string): string {
    return join(workspace_path, WORKSPACE_DIR, "agents");
  }

  /**
   * Get the MCP directory for a workspace
   */
  getWorkspaceMcpDir(workspace_path: string): string {
    return join(workspace_path, WORKSPACE_DIR, "mcp");
  }

  /**
   * Get the skills directory for a workspace
   */
  getWorkspaceSkillsDir(workspace_path: string): string {
    return join(workspace_path, WORKSPACE_DIR, "skills");
  }

  /**
   * Get the config path for a workspace
   */
  getWorkspaceConfigPath(workspace_path: string): string {
    return join(workspace_path, WORKSPACE_DIR, WORKSPACE_CONFIG_FILE);
  }

  /**
   * Check if a directory is inside an existing workspace (but not the root).
   * Returns the enclosing workspace path if found, null otherwise.
   */
  getEnclosingWorkspace(dir: string): string | null {
    const resolvedDir = resolve(dir);
    const workspaceRoot = this.findWorkspaceRoot(resolvedDir);

    if (workspaceRoot && workspaceRoot !== resolvedDir) {
      return workspaceRoot;
    }

    return null;
  }

  /**
   * Initialize a Viben workspace in the target directory.
   *
   * Creates:
   * - .viben/config.yaml - Workspace configuration
   * - .viben/agents/main.yaml - Default agent configuration
   *
   * Supports template loading from registry or local file through the
   * `template` option.
   *
   * @param options - Initialization options
   * @returns Initialization result
   * @throws AlreadyExistsError if workspace already exists and force is false
   * @throws ValidationError if inside an existing workspace
   * @throws NotFoundError if template not found
   */
  async init(options: InitWorkspaceOptions = {}): Promise<InitWorkspaceResult> {
    // Delegate to initWorkspaceFromInit which properly handles templates
    const result = await initWorkspaceFromInit(options);

    // Add to known workspaces
    const targetDir = resolve(options.targetDir || process.cwd());
    await this.addKnownWorkspace(targetDir);

    return result;
  }

  /**
   * Read workspace configuration
   */
  async readConfig(workspace_path: string): Promise<WorkspaceConfigFile | null> {
    const configPath = this.getWorkspaceConfigPath(workspace_path);

    if (!fileExists(configPath)) {
      return null;
    }

    const config = await readYaml<WorkspaceConfigFile>(configPath);
    return config ?? null;
  }

  /**
   * Write workspace configuration
   */
  async writeConfig(
    workspace_path: string,
    config: WorkspaceConfigFile
  ): Promise<void> {
    const configPath = this.getWorkspaceConfigPath(workspace_path);
    await writeYaml(configPath, config);
  }
}

// Export singleton instance
export const workspaceManager = new WorkspaceManager();

/**
 * Standalone function to initialize a workspace (convenience export)
 *
 * Supports template loading from registry or local file through the
 * `template` option.
 */
export async function initWorkspace(
  options: InitWorkspaceOptions = {}
): Promise<InitWorkspaceResult> {
  // Delegate to workspaceManager.init which handles templates via initWorkspaceFromInit
  return workspaceManager.init(options);
}
