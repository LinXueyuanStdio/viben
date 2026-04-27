export interface ColumnConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  wipLimit?: number;
  order: number;
}

export const COLUMN_COLORS = [
  { key: "gray", nameKey: "kanban.color.gray", name: "Gray", value: "#71717a" },
  { key: "blue", nameKey: "kanban.color.blue", name: "Blue", value: "#3b82f6" },
  { key: "yellow", nameKey: "kanban.color.yellow", name: "Yellow", value: "#EAB308" },
  { key: "green", nameKey: "kanban.color.green", name: "Green", value: "#22c55e" },
  { key: "red", nameKey: "kanban.color.red", name: "Red", value: "#ef4444" },
  { key: "purple", nameKey: "kanban.color.purple", name: "Purple", value: "#A855F7" },
  { key: "orange", nameKey: "kanban.color.orange", name: "Orange", value: "#f97316" },
  { key: "cyan", nameKey: "kanban.color.cyan", name: "Cyan", value: "#22d3ee" },
];
