export type SortMode = "manual" | "priority" | "dueDate" | "createdAt" | "updatedAt" | "title";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  mode: SortMode;
  direction: SortDirection;
}

export interface SortOption {
  value: SortMode;
  /** i18n key for the label */
  labelKey: string;
  icon: string; // Lucide icon name
}

export const SORT_OPTIONS: SortOption[] = [
  { value: "manual", labelKey: "kanban.sort.manual", icon: "GripVertical" },
  { value: "priority", labelKey: "kanban.sort.priority", icon: "Signal" },
  { value: "dueDate", labelKey: "kanban.sort.dueDate", icon: "Calendar" },
  { value: "createdAt", labelKey: "kanban.sort.createdAt", icon: "Clock" },
  { value: "updatedAt", labelKey: "kanban.sort.updatedAt", icon: "RefreshCw" },
  { value: "title", labelKey: "kanban.sort.title", icon: "ArrowDownAZ" },
];
