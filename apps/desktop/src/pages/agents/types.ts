import type { Workspace } from "@/types";

// ============================================================================
// Panel Width Constants (used by executor-detail)
// ============================================================================

export const MIN_LEFT_PANEL_WIDTH = 200;
export const MAX_LEFT_PANEL_WIDTH = 400;
export const DEFAULT_LEFT_PANEL_WIDTH = 288; // w-72

export const MIN_RIGHT_PANEL_WIDTH = 240;
export const MAX_RIGHT_PANEL_WIDTH = 480;
export const DEFAULT_RIGHT_PANEL_WIDTH = 320; // w-80

// ============================================================================
// workspace-agents types
// ============================================================================

export interface ListItem {
  id: string;
  name: string;
  description?: string;
  type: "executor" | "agent" | "workspace-agent";
  executorType?: string; // e.g., "CLAUDE_CODE", "CODEX"
  /** Path to the agent configuration */
  path?: string;
  /** Workspace path this agent belongs to (for workspace-agent type) */
  workspacePath?: string;
  /** Source of config: "global", "project", "merged", or "workspace" */
  source?: "global" | "project" | "merged" | "workspace";
  /** Project-level config path (for executors with merged configs) */
  projectConfigPath?: string;
  /** Global config path (for executors) */
  globalConfigPath?: string;
  // For agents
  model?: string;
  provider?: string;
  mcp_servers?: string[];
  skills?: string[];
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  created_at?: string;
  updated_at?: string;
  // Template fields
  isTemplate?: boolean;
  templateDescription?: string;
}

export interface WorkspaceAgentsPageProps {
  /**
   * When true, the page is rendered inside the Settings page
   * - Hides the workspace header
   * - Uses workspaceOverride instead of route params
   */
  settingsMode?: boolean;
  /**
   * Override workspace object (used in settings mode)
   * Pass the full workspace object so the component has access to path, id, etc.
   */
  workspaceOverride?: Workspace;
}

// ============================================================================
// subagent-detail types
// ============================================================================

export interface FileTab {
  id: string;
  path: string;
  name: string;
  type: "overview" | "file";
}

// ============================================================================
// agents (legacy) types
// ============================================================================

/** Mapped executor info to match the legacy IdeAgentInfo interface */
export interface ExecutorDisplayInfo {
  id: string;
  name: string;
  installed: boolean;
  config_path: string | null;
  has_mcp_config: boolean;
  mcp_server_count?: number;
}
