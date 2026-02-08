/**
 * Executor type definitions
 *
 * Executor is the underlying coding agent (e.g., Claude Code, Cursor)
 * that Viben uses to run agents with custom skills, prompts, and MCP servers.
 */

/**
 * Executor detector configuration
 */
export interface ExecutorDetector {
  /** Unique executor ID (e.g., "CLAUDE_CODE") */
  id: string;
  /** Display name (e.g., "Claude Code") */
  name: string;
  /** Description of the executor */
  description: string;
  /** Command to detect if installed (e.g., "claude --version") */
  detectCommand: string;
  /** Possible executable names to search in PATH */
  executableNames: string[];
  /** Config directory paths to check (relative to home) */
  configPaths: string[];
  /** MCP config file path (relative to home) */
  mcpConfigPath?: string;
  /** Settings file path (relative to home) */
  settingsPath?: string;
  /** Capabilities of this executor */
  capabilities: ExecutorCapability[];
}

/**
 * Detected executor information
 */
export interface DetectedExecutor {
  /** Unique executor ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Whether the executor is installed */
  installed: boolean;
  /** Version string (if installed) */
  version?: string;
  /** Full path to executable (if installed) */
  path?: string;
  /** Config directory path (if exists) */
  configDir?: string;
  /** MCP config file path (if exists) */
  mcpConfigPath?: string;
  /** Settings file path (if exists) */
  settingsPath?: string;
  /** Capabilities */
  capabilities: ExecutorCapability[];
}

/**
 * Executor capabilities
 */
export type ExecutorCapability =
  | 'tool_use'
  | 'mcp_support'
  | 'multi_turn'
  | 'extended_thinking'
  | 'vision'
  | 'code_execution'
  | 'web_browsing'
  | 'file_editing';

/**
 * Executor list response data
 */
export interface ExecutorListData {
  executors: DetectedExecutor[];
  installed: DetectedExecutor[];
  notInstalled: DetectedExecutor[];
}

/**
 * Executor show response data
 */
export interface ExecutorShowData {
  executor: DetectedExecutor;
  agents?: Array<{
    id: string;
    sessionCount: number;
    isDefault: boolean;
  }>;
}
