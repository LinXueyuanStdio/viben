import type { LucideIcon } from "lucide-react";
import { AlertCircle, ArrowUp, Minus, ArrowDown, MoreHorizontal } from "lucide-react";

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
    color: "var(--color-error, hsl(var(--destructive)))",
    Icon: AlertCircle,
  },
  high: {
    value: "high",
    label: "高",
    labelEn: "High",
    color: "hsl(var(--primary))",
    Icon: ArrowUp,
  },
  medium: {
    value: "medium",
    label: "中",
    labelEn: "Medium",
    color: "hsl(var(--brand-teal-500, 195 0.14 0.65))",
    Icon: Minus,
  },
  low: {
    value: "low",
    label: "低",
    labelEn: "Low",
    color: "hsl(var(--muted-foreground))",
    Icon: ArrowDown,
  },
  none: {
    value: "none",
    label: "无",
    labelEn: "None",
    color: "hsl(var(--muted-foreground) / 0.5)",
    Icon: MoreHorizontal,
  },
};

export const PRIORITY_ORDER: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];
