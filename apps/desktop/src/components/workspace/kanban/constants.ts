/**
 * Constants for the workspace kanban component
 *
 * This file contains constant values and configurations extracted from
 * workspace-kanban.tsx for better organization and reusability.
 */

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
import type { TaskCategory } from "@viben/kanban";
import {
  COLUMN_COLORS as VIBE_COLUMN_COLORS,
  COLUMN_COLOR_VARS as VIBE_COLUMN_COLOR_VARS,
  KANBAN_COLUMNS,
  type KanbanColumnId,
} from "@/lib/kanban";

// ============================================
// Re-exports from vibe-kanban
// ============================================

/**
 * Kanban columns in display order
 * @see packages/core/src/lib/vibe-kanban/types.ts
 */
export { KANBAN_COLUMNS };

/**
 * Full CSS color values for column indicators
 */
export const COLUMN_COLORS = VIBE_COLUMN_COLORS;

/**
 * CSS variable names for column colors (--xxx format)
 */
export const COLUMN_COLOR_VARS = VIBE_COLUMN_COLOR_VARS;

// ============================================
// Category Icons
// ============================================

/**
 * Category icon mapping using Lucide React components
 *
 * Maps TaskCategory to corresponding Lucide icon component.
 * Used in task cards to display visual category indicators.
 */
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

// ============================================
// Column i18n Keys
// ============================================

/**
 * Column i18n key mapping
 *
 * Maps column IDs to their corresponding i18n key suffixes.
 * Used with `t(`workspace.column.${COLUMN_I18N_KEYS[columnId]}`)`.
 */
export const COLUMN_I18N_KEYS: Record<KanbanColumnId, string> = {
  backlog: "backlog",
  queue: "queue",
  in_progress: "inProgress",
  paused: "paused",
  review: "review",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  archived: "archived",
};

// ============================================
// Default Values
// ============================================

/**
 * Default column width in pixels
 */
export const DEFAULT_COLUMN_WIDTH = 280;

/**
 * Minimum column width in pixels
 */
export const MIN_COLUMN_WIDTH = 200;

/**
 * Maximum column width in pixels
 */
export const MAX_COLUMN_WIDTH = 600;

/**
 * Default maximum parallel tasks
 */
export const DEFAULT_MAX_PARALLEL_TASKS = 3;

/**
 * Maximum value for parallel tasks setting
 */
export const MAX_PARALLEL_TASKS_LIMIT = 10;

/**
 * Minimum value for parallel tasks setting
 */
export const MIN_PARALLEL_TASKS_LIMIT = 1;

// ============================================
// Stuck Detection Thresholds
// ============================================

/**
 * Default stuck detection threshold in milliseconds
 * Task is considered stuck if no activity for this duration
 */
export const DEFAULT_STUCK_THRESHOLD_MS = 60000; // 1 minute

/**
 * Default stuck detection check interval in milliseconds
 */
export const DEFAULT_STUCK_CHECK_INTERVAL_MS = 30000; // 30 seconds

// ============================================
// Animation Durations
// ============================================

/**
 * Card animation duration in milliseconds
 */
export const CARD_ANIMATION_DURATION_MS = 200;

/**
 * Panel animation duration in milliseconds
 */
export const PANEL_ANIMATION_DURATION_MS = 300;

// ============================================
// View Mode Constants
// ============================================

/**
 * Available view modes for kanban
 */
export const VIEW_MODES = ["kanban", "list", "table"] as const;

/**
 * Default view mode
 */
export const DEFAULT_VIEW_MODE = "kanban" as const;

// ============================================
// Sort Mode Constants
// ============================================

/**
 * Available sort modes
 */
export const SORT_MODES = [
  "manual",
  "createdAt",
  "updatedAt",
  "title",
  "priority",
] as const;

/**
 * Default sort mode
 */
export const DEFAULT_SORT_MODE = "createdAt" as const;

/**
 * Default sort direction
 */
export const DEFAULT_SORT_DIRECTION = "desc" as const;
