import type * as React from "react";

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
  category?: CommandCategory;
  keywords?: string[];
}

export type CommandCategory = "navigation" | "action" | "view" | "settings" | "sort" | "filter";

/** i18n keys for command category labels */
export const CATEGORY_LABEL_KEYS: Record<CommandCategory, string> = {
  navigation: "kanban.command.navigation",
  action: "kanban.command.action",
  view: "kanban.command.view",
  settings: "kanban.command.settings",
  sort: "kanban.command.sort",
  filter: "kanban.command.filter",
};
