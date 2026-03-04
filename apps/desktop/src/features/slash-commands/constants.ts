import type { CommandCategory } from "./types";

/**
 * Category labels for UI display
 */
/**
 * Category labels for UI display (fallback values, prefer i18n)
 * Use t("chat.slashCommands.categories.<category>") for translation
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  session: "Session",
  config: "Configuration",
  info: "Information",
  workspace: "Workspace",
  auth: "Authentication",
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
 * Source labels for UI display (fallback values, prefer i18n)
 * Use t("chat.slashCommands.sources.<source>") for translation
 */
export const SOURCE_LABELS = {
  builtin: "Built-in",
  workspace: "Workspace",
  skill: "Skill",
} as const;
