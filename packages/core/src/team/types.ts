/**
 * Team initialization types
 *
 * Re-exports ExecutorType from main types module and adds team-specific configurations.
 */

// Re-export ExecutorType from main types
export type { ExecutorType } from "../types";
import type { ExecutorType } from "../types";

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

/**
 * Project type for initialization
 */
export type ProjectType = "frontend" | "backend" | "fullstack";
