import type { ReactNode } from "react";
import type { SlashCommand as ChatSlashCommand } from "@viben/chat";

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
  /** Toast message (for action type). If i18n is true, message is treated as i18n key. */
  toast?: { message: string; type: "success" | "error" | "info"; i18n?: boolean; params?: Record<string, unknown> };
  /** Dialog to open (for ui type) */
  dialog?: { name: string; props?: Record<string, unknown> };
  /** Path to navigate (for ui type) */
  navigateTo?: string;
}

export type SlashCommandPayload = Record<string, unknown>;

export function getSlashCommandArg(payload: SlashCommandPayload, key = "args"): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

/**
 * Desktop slash command with execution logic.
 */
export type DesktopSlashCommand = Omit<ChatSlashCommand, "input"> & {
  id: string;
  icon?: ReactNode;
  input?: ChatSlashCommand["input"];
  args?: Array<{
    name: string;
    required?: boolean;
    description?: string;
  }>;
  description: string;
  category: CommandCategory;
  source: CommandSource;
  execute: (
    payload: SlashCommandPayload,
    context: CommandContext
  ) => Promise<CommandResult>;
};

/**
 * Workspace command loaded from .claude/commands/*.md
 */
export interface WorkspaceCommandFile {
  /** Command name (derived from filename) */
  name: string;
  /** Full command name with namespace (e.g., viben:start) */
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
