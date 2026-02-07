export interface ColumnConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  wipLimit?: number;
  order: number;
}

export const COLUMN_COLORS = [
  { name: "灰色", value: "hsl(var(--muted))" },
  { name: "蓝色", value: "hsl(var(--primary))" },
  { name: "黄色", value: "hsl(var(--warning))" },
  { name: "绿色", value: "hsl(var(--success))" },
  { name: "红色", value: "hsl(var(--destructive))" },
  { name: "紫色", value: "hsl(280 60% 50%)" },
  { name: "橙色", value: "hsl(25 90% 50%)" },
  { name: "青色", value: "hsl(180 60% 45%)" },
];
