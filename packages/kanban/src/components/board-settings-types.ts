export interface ColumnConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  wipLimit?: number;
  order: number;
}

export const COLUMN_COLORS = [
  { key: "gray", name: "Gray", value: "hsl(var(--muted))" },
  { key: "blue", name: "Blue", value: "hsl(var(--primary))" },
  { key: "yellow", name: "Yellow", value: "hsl(var(--warning))" },
  { key: "green", name: "Green", value: "hsl(var(--success))" },
  { key: "red", name: "Red", value: "hsl(var(--destructive))" },
  { key: "purple", name: "Purple", value: "hsl(280 60% 50%)" },
  { key: "orange", name: "Orange", value: "hsl(25 90% 50%)" },
  { key: "cyan", name: "Cyan", value: "hsl(180 60% 45%)" },
];
