/**
 * Workspace-specific types
 */

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
  createdAt?: string;
  updatedAt?: string;
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
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
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
  /** Template name to use */
  template?: string;
  /** Force initialization even if workspace already exists */
  force?: boolean;
}

/**
 * Result of workspace initialization
 */
export interface InitWorkspaceResult {
  /** Whether the initialization was successful */
  success: boolean;
  /** Absolute path to .viben directory */
  path: string;
  /** List of created files (relative to .viben) */
  files: string[];
  /** The workspace configuration */
  config: WorkspaceConfigFile;
}

/**
 * Workspace template metadata
 */
export interface WorkspaceTemplate {
  /** Template ID (directory name) */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Workspace template configuration file structure (stored in template directory)
 */
export interface WorkspaceTemplateConfig {
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Base workspace configuration to use */
  workspaceConfig?: Partial<WorkspaceConfigFile>;
  /** List of directories to create */
  directories?: string[];
  /** List of files to copy (relative paths within template) */
  files?: string[];
  /** Creation timestamp */
  createdAt: string;
}
