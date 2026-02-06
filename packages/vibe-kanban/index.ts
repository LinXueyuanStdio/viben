/**
 * @viben/vibe-kanban
 *
 * Symlink wrapper for vibe-kanban components.
 * This package provides access to vibe-kanban's frontend components via symlinks.
 *
 * Directory structure:
 * - ui/       → vibe-kanban UI components (shadcn-io based)
 * - ui-new/   → vibe-kanban new design components
 * - hooks/    → vibe-kanban custom hooks
 * - shared/   → vibe-kanban shared types
 * - lib/      → vibe-kanban utility library
 *
 * Usage:
 *   import { KanbanBoard, KanbanCard } from '@viben/vibe-kanban/ui/shadcn-io/kanban';
 *   import { useTask } from '@viben/vibe-kanban/hooks';
 *   import type { Task } from '@viben/vibe-kanban/shared';
 */

// Re-export Kanban components for convenience
export {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  type KanbanProviderProps,
  type KanbanBoardProps,
  type KanbanCardProps,
  type KanbanCardsProps,
  type KanbanHeaderProps,
  type Status,
  type Feature,
  type DragEndEvent,
} from './ui/shadcn-io/kanban';

// Re-export commonly used hooks
export {
  useTask,
  useTaskMutations,
  useTaskAttempt,
  useTaskAttemptWithSession,
  useTaskAttempts,
  useTaskImages,
} from './hooks';
