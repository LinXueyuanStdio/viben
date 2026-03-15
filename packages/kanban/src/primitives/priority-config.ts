import type { LucideIcon } from "lucide-react";
import { Flame, Zap, Sun, Leaf, Snowflake } from "lucide-react";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export interface PriorityConfig {
  value: IssuePriority;
  label: string;
  labelEn: string;
  color: string;
  Icon: LucideIcon;
}

export const PRIORITY_CONFIG: Record<IssuePriority, PriorityConfig> = {
  urgent: {
    value: "urgent",
    label: "紧急",
    labelEn: "Urgent",
    color: "#ef4444",  // Red 500 - 🔥 Fire
    Icon: Flame,
  },
  high: {
    value: "high",
    label: "高",
    labelEn: "High",
    color: "#f59e0b",  // Amber 500 - ⚡ Lightning
    Icon: Zap,
  },
  medium: {
    value: "medium",
    label: "中",
    labelEn: "Medium",
    color: "#3b82f6",  // Blue 500 - ☀️ Sun
    Icon: Sun,
  },
  low: {
    value: "low",
    label: "低",
    labelEn: "Low",
    color: "#22c55e",  // Green 500 - 🌿 Leaf
    Icon: Leaf,
  },
  none: {
    value: "none",
    label: "无",
    labelEn: "None",
    color: "#94a3b8",  // Slate 400 - ❄️ Snowflake
    Icon: Snowflake,
  },
};

export const PRIORITY_ORDER: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];
