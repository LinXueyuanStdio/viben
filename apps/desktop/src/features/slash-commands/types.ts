import type { ReactNode } from "react";

/**
 * Command categories for grouping in UI
 */
export type CommandCategory =
  | "session"
  | "config"
  | "info"
  | "workspace"
  | "auth";

/**
 * Command result types determine how the result is handled
 * - message: Display result in chat as a system message
 * - ui: Open a dialog/panel/navigate
 * - action: Execute silently, show toast
 * - prompt: Send content as prompt to AI
 */
export type CommandResultType = "message" | "ui" | "action" | "prompt";

/**
 * Command source indicates where the command comes from
 */
export type CommandSource = "builtin" | "workspace" | "skill";

/**
 * Command argument definition
 */
export interface CommandArg {
  name: string;
  required: boolean;
  description: string;
}

/**
 * Context available to command execution
 */
export interface CommandContext {
  // Session
  sessionId?: string;
  messages: Array<{ role: string; content: string }>;
  clearMessages: () => void;
  sendMessage: (content: string) => void;

  // Config
  workspacePath?: string;
  agentId?: string;
  currentModel?: string;
  setModel?: (model: string) => void;

  // UI
  openDialog: (dialog: string, props?: Record<string, unknown>) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;

  // Navigation
  navigate: (path: string) => void;

  // i18n
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  type: CommandResultType;
  /** Content to display (for message type) */
  content?: string | ReactNode;
  /** Prompt to send to AI (for prompt type) */
  prompt?: string;
  /** Toast message (for action type) */
  toast?: { message: string; type: "success" | "error" | "info" };
  /** Dialog to open (for ui type) */
  dialog?: { name: string; props?: Record<string, unknown> };
  /** Path to navigate (for ui type) */
  navigateTo?: string;
}

/**
 * Slash command definition with execution logic
 */
export interface SlashCommandDefinition {
  id: string;
  name: string;
  description: string;
  icon?: ReactNode;
  category: CommandCategory;
  source: CommandSource;
  args?: CommandArg[];
  /** Execute the command */
  execute: (context: CommandContext, args?: string) => Promise<CommandResult>;
}

/**
 * Workspace command loaded from .claude/commands/*.md
 */
export interface WorkspaceCommandFile {
  /** Command name (derived from filename) */
  name: string;
  /** Full command name with namespace (e.g., trellis:start) */
  fullName: string;
  /** File path */
  path: string;
  /** Title from markdown (first h1) */
  title: string;
  /** Description (first paragraph) */
  description: string;
  /** Full markdown content */
  content: string;
}

/**
 * Skill command loaded from skills directory
 */
export interface SkillCommandFile {
  /** Skill name */
  name: string;
  /** Skill triggers (command names) */
  triggers: string[];
  /** Description */
  description: string;
  /** File path */
  path: string;
  /** Full skill content */
  content: string;
}

/**
 * API response for workspace commands
 */
export interface WorkspaceCommandsResponse {
  commands: WorkspaceCommandFile[];
}

/**
 * API response for skill commands
 */
export interface SkillCommandsResponse {
  skills: SkillCommandFile[];
}
