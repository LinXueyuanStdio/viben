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

export type CommandCategory = "navigation" | "action" | "view" | "settings" | "sort";

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "导航",
  action: "操作",
  view: "视图",
  settings: "设置",
  sort: "排序",
};
