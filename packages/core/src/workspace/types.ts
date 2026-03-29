/**
 * Workspace-specific types
 */
import type { ExecutorType } from "../types";

export type { ExecutorType };

// =============================================================================
// Executor Types
// =============================================================================

/**
 * Configuration for an AI executor's template setup
 */
export interface ExecutorTemplateConfig {
  /** Display name of the executor */
  name: string;
  /** Config directory name in the project root (e.g., ".claude") */
  configDir: string;
  /** Whether this executor uses Python hooks (affects Windows encoding detection) */
  hasPythonHooks: boolean;
  /** Template directory name (under packages/core/templates/) */
  templateDir: string;
}

/**
 * Registry of AI executors that have template support.
 * Not all ExecutorType values have templates - only those that support
 * project-level configuration files.
 */
export const EXECUTOR_TEMPLATE_CONFIGS: Partial<Record<ExecutorType, ExecutorTemplateConfig>> = {
  CLAUDE_CODE: {
    name: "Claude Code",
    configDir: ".claude",
    hasPythonHooks: true,
    templateDir: "claude",
  },
  CURSOR: {
    name: "Cursor",
    configDir: ".cursor",
    hasPythonHooks: false,
    templateDir: "cursor",
  },
  GEMINI: {
    name: "Gemini CLI",
    configDir: ".gemini",
    hasPythonHooks: false,
    templateDir: "gemini",
  },
  CODEX: {
    name: "Codex",
    configDir: ".agents/skills",
    hasPythonHooks: false,
    templateDir: "codex",
  },
  OPENCODE: {
    name: "OpenCode",
    configDir: ".opencode",
    hasPythonHooks: false,
    templateDir: "opencode",
  },
  IFLOW: {
    name: "iFlow CLI",
    configDir: ".iflow",
    hasPythonHooks: true,
    templateDir: "iflow",
  },
  KILO: {
    name: "Kilo CLI",
    configDir: ".kilocode",
    hasPythonHooks: false,
    templateDir: "kilo",
  },
  KIRO: {
    name: "Kiro Code",
    configDir: ".kiro/skills",
    hasPythonHooks: false,
    templateDir: "kiro",
  },
  ANTIGRAVITY: {
    name: "Antigravity",
    configDir: ".agent/workflows",
    hasPythonHooks: false,
    templateDir: "antigravity",
  },
};

// =============================================================================
// Workspace Configuration Types
// =============================================================================

/**
 * Workspace MCP configuration
 */
export interface WorkspaceMcpConfig {
  enabled: string[];
  disabled?: string[];
}

/**
 * Workspace skills configuration
 */
export interface WorkspaceSkillsConfig {
  enabled: string[];
  disabled?: string[];
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  editor?: string;
  pager?: string;
  color?: "auto" | "always" | "never";
}

/**
 * Workspace configuration file structure (stored in .viben/config.yaml)
 */
export interface WorkspaceConfigFile {
  version: number;
  name?: string;
  settings?: WorkspaceSettings;
  mcp?: WorkspaceMcpConfig;
  skills?: WorkspaceSkillsConfig;
  agents?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Workspace information (runtime representation)
 */
export interface Workspace {
  /** Absolute path to the workspace root directory */
  path: string;
  /** Workspace name (defaults to directory name) */
  name: string;
  /** Path to the config file (.viben/config.yaml) */
  configPath: string;
  /** MCP configuration */
  mcp?: WorkspaceMcpConfig;
  /** Skills configuration */
  skills?: WorkspaceSkillsConfig;
  /** List of agent IDs in this workspace */
  agents?: string[];
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Known workspace entry (stored in global workspaces.yaml)
 */
export interface KnownWorkspaceEntry {
  /** Absolute path to the workspace root */
  path: string;
  /** Custom name for the workspace */
  name?: string;
  /** Registration timestamp (when workspace was first added) */
  registeredAt?: string;
  /** Last accessed timestamp */
  lastAccessed?: string;
}

/**
 * Known workspaces file structure (~/.viben/workspaces.yaml)
 */
export interface KnownWorkspacesFile {
  version: number;
  workspaces: KnownWorkspaceEntry[];
}

/**
 * Options for initializing a workspace
 */
export interface InitWorkspaceOptions {
  /** Target directory to initialize (defaults to cwd) */
  targetDir?: string;
  /** Force initialization even if workspace already exists */
  force?: boolean;
  /** Skip existing files without error */
  skipExisting?: boolean;
  /** Developer name for workspace initialization */
  developerName?: string;
  /** AI executors to configure (default: CURSOR, CLAUDE_CODE) */
  executors?: ExecutorType[];
}

/**
 * Result of workspace initialization
 */
export interface InitWorkspaceResult {
  /** Whether the initialization was successful */
  success: boolean;
  /** Absolute path to .viben directory */
  path: string;
  /** List of created files (relative paths) */
  files: string[];
  /** The workspace configuration */
  config: WorkspaceConfigFile;
  /** Warning messages */
  warnings?: string[];
}
