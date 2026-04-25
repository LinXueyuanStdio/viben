import {
  Target,
  Bug,
  Wrench,
  FileText,
  Shield,
  Gauge,
  Palette,
  Server,
  TestTube,
} from "lucide-react";
import {
  COLUMN_COLORS as VIBE_COLUMN_COLORS,
  COLUMN_COLOR_VARS as VIBE_COLUMN_COLOR_VARS,
} from "@/lib/kanban";
import type { TaskCategory, IssuePriority } from "@viben/kanban";
import type { ColumnId } from "./types";

// Column colors mapping (full CSS value for List View)
export const COLUMN_COLORS: Record<ColumnId, string> = VIBE_COLUMN_COLORS;

// Column color CSS variables for KanbanHeader
export const COLUMN_COLOR_VARS: Record<ColumnId, string> = VIBE_COLUMN_COLOR_VARS;

// Category icon mapping (Lucide components)
export const CategoryIcons: Record<TaskCategory, React.ElementType> = {
  feature: Target,
  bug_fix: Bug,
  refactoring: Wrench,
  documentation: FileText,
  security: Shield,
  performance: Gauge,
  ui_ux: Palette,
  infrastructure: Server,
  testing: TestTube,
};

// Validate priority string is a valid IssuePriority
export const validatePriority = (priority?: string): IssuePriority | undefined => {
  if (!priority) return undefined;
  const validPriorities: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];
  return validPriorities.includes(priority as IssuePriority)
    ? (priority as IssuePriority)
    : undefined;
};
