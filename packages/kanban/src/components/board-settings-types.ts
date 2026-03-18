export interface ColumnConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  wipLimit?: number;
  order: number;
}

export const COLUMN_COLORS = [
  { key: "gray", name: "Gray", value: "#71717a" },        // Zinc-500
  { key: "blue", name: "Blue", value: "#3b82f6" },        // Blue-500
  { key: "yellow", name: "Yellow", value: "#EAB308" },    // Yellow-500
  { key: "green", name: "Green", value: "#22c55e" },      // Green-500
  { key: "red", name: "Red", value: "#ef4444" },          // Red-500
  { key: "purple", name: "Purple", value: "#A855F7" },    // Purple-500
  { key: "orange", name: "Orange", value: "#f97316" },    // Orange-500
  { key: "cyan", name: "Cyan", value: "#22d3ee" },        // Cyan-400
];
