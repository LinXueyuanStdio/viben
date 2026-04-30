import type { CommandCategory } from "./types";
import i18n from "@/i18n";

/**
 * Category labels for UI display (i18n-enabled via getter properties)
 */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  get session() { return i18n.t("chat.slashCommands.categories.session", "Session"); },
  get config() { return i18n.t("chat.slashCommands.categories.config", "Configuration"); },
  get info() { return i18n.t("chat.slashCommands.categories.info", "Information"); },
  get workspace() { return i18n.t("chat.slashCommands.categories.workspace", "Workspace"); },
  get auth() { return i18n.t("chat.slashCommands.categories.auth", "Authentication"); },
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
 * Source labels for UI display (i18n-enabled via getter properties)
 */
export const SOURCE_LABELS: Record<string, string> = {
  get builtin() { return i18n.t("chat.slashCommands.sources.builtin", "Built-in"); },
  get workspace() { return i18n.t("chat.slashCommands.sources.workspace", "Workspace"); },
  get skill() { return i18n.t("chat.slashCommands.sources.skill", "Skill"); },
};
