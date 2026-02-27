import type { CommandCategory } from "./types";

/**
 * Category labels for UI display
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  session: "Session",
  config: "Configuration",
  info: "Information",
  workspace: "Workspace",
  auth: "Authentication",
};

/**
 * Category labels in Chinese
 */
export const CATEGORY_LABELS_ZH: Record<CommandCategory, string> = {
  session: "会话",
  config: "配置",
  info: "信息",
  workspace: "工作区",
  auth: "认证",
};

/**
 * Category order for sorting
 */
export const CATEGORY_ORDER: CommandCategory[] = [
  "session",
  "config",
  "info",
  "workspace",
  "auth",
];

/**
 * Source labels for UI display
 */
export const SOURCE_LABELS = {
  builtin: "Built-in",
  workspace: "Workspace",
  skill: "Skill",
} as const;

/**
 * Source labels in Chinese
 */
export const SOURCE_LABELS_ZH = {
  builtin: "内置",
  workspace: "工作区",
  skill: "技能",
} as const;
