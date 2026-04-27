export interface Tag {
  id: string;
  name: string;
  color: string;
}

export const TAG_COLORS = [
  { nameKey: "kanban.color.red", name: "Red", value: "#ef4444" },
  { nameKey: "kanban.color.orange", name: "Orange", value: "#f97316" },
  { nameKey: "kanban.color.yellow", name: "Yellow", value: "#eab308" },
  { nameKey: "kanban.color.green", name: "Green", value: "#22c55e" },
  { nameKey: "kanban.color.teal", name: "Teal", value: "#14b8a6" },
  { nameKey: "kanban.color.blue", name: "Blue", value: "#3b82f6" },
  { nameKey: "kanban.color.purple", name: "Purple", value: "#8b5cf6" },
  { nameKey: "kanban.color.pink", name: "Pink", value: "#ec4899" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number];
