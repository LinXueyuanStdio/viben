export type SortMode = "manual" | "priority" | "dueDate" | "createdAt" | "updatedAt" | "title";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  mode: SortMode;
  direction: SortDirection;
}

export interface SortOption {
  value: SortMode;
  label: string;
  labelEn: string;
  icon: string; // Lucide icon name
}

export const SORT_OPTIONS: SortOption[] = [
  { value: "manual", label: "手动排序", labelEn: "Manual", icon: "GripVertical" },
  { value: "priority", label: "按优先级", labelEn: "Priority", icon: "Signal" },
  { value: "dueDate", label: "按截止日期", labelEn: "Due Date", icon: "Calendar" },
  { value: "createdAt", label: "按创建时间", labelEn: "Created", icon: "Clock" },
  { value: "updatedAt", label: "按更新时间", labelEn: "Updated", icon: "RefreshCw" },
  { value: "title", label: "按标题", labelEn: "Title", icon: "ArrowDownAZ" },
];
