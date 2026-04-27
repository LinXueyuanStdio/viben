import type { LucideIcon } from "lucide-react";
import { Flame, Zap, Sun, Leaf, Snowflake } from "lucide-react";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export interface PriorityConfig {
  value: IssuePriority;
  /** i18n key for the label */
  labelKey: string;
  color: string;
  Icon: LucideIcon;
}

export const PRIORITY_CONFIG: Record<IssuePriority, PriorityConfig> = {
  urgent: {
    value: "urgent",
    labelKey: "kanban.priority.urgent",
    color: "#ef4444",  // Red 500
    Icon: Flame,
  },
  high: {
    value: "high",
    labelKey: "kanban.priority.high",
    color: "#f59e0b",  // Amber 500
    Icon: Zap,
  },
  medium: {
    value: "medium",
    labelKey: "kanban.priority.medium",
    color: "#3b82f6",  // Blue 500
    Icon: Sun,
  },
  low: {
    value: "low",
    labelKey: "kanban.priority.low",
    color: "#22c55e",  // Green 500
    Icon: Leaf,
  },
  none: {
    value: "none",
    labelKey: "kanban.priority.none",
    color: "#94a3b8",  // Slate 400
    Icon: Snowflake,
  },
};

export const PRIORITY_ORDER: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];
