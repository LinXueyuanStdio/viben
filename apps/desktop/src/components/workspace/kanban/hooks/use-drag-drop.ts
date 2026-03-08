/**
 * Hook for kanban drag-drop functionality
 *
 * Extracted from workspace-kanban.tsx to improve maintainability.
 * Handles task drag-drop with status transition validation.
 */

import { useState, useCallback } from "react";
import type { DragEndEvent } from "@viben/kanban";
import type { KanbanColumnId, TaskStatus as VibeTaskStatus } from "@/lib/vibe-kanban";
import {
  STATUS_TO_COLUMN,
  COLUMN_TO_STATUS,
  isValidStatusTransition,
  getValidDropTargets,
} from "@/lib/vibe-kanban";
import type { EnhancedTask, DragDropState } from "../types";

/**
 * Options for the useDragDrop hook
 */
interface UseDragDropOptions {
  /** Array of tasks to operate on */
  tasks: EnhancedTask[];
  /**
   * Callback when a task is moved to a new column
   * @param taskId - ID of the task being moved
   * @param toColumn - Target column ID
   */
  onMoveTask: (taskId: string, toColumn: KanbanColumnId) => void;
  /**
   * Optional callback when an invalid move is attempted
   * @param fromColumn - Source column ID
   * @param toColumn - Target column ID
   */
  onInvalidMove?: (fromColumn: string, toColumn: string) => void;
  /**
   * Optional callback when a task is moved to in_progress
   * Used to trigger auto-start functionality
   * @param taskId - ID of the task that was moved to in_progress
   */
  onMovedToInProgress?: (taskId: string) => void;
}

/**
 * Hook for managing kanban drag-drop operations
 *
 * Features:
 * - Validates status transitions based on VALID_STATUS_TRANSITIONS
 * - Computes valid drop targets for visual feedback during drag
 * - Handles special case when moving to in_progress (auto-start trigger)
 *
 * @param options - Configuration options for the hook
 * @returns DragDropState object with state and handlers
 *
 * @example
 * ```tsx
 * const { draggingTaskId, validDropTargets, handleDragStart, handleDragEnd, handleDragCancel } = useDragDrop({
 *   tasks,
 *   onMoveTask: (taskId, toColumn) => updateTaskStatus.mutate({ taskId, status: COLUMN_TO_STATUS[toColumn] }),
 *   onInvalidMove: (from, to) => toast.error(`Cannot move from ${from} to ${to}`),
 *   onMovedToInProgress: (taskId) => setAutoStartTask(taskId),
 * });
 * ```
 */
export function useDragDrop(options: UseDragDropOptions): DragDropState {
  const { tasks, onMoveTask, onInvalidMove, onMovedToInProgress } = options;

  // Track dragging state for visual feedback on valid drop targets
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [validDropTargets, setValidDropTargets] = useState<KanbanColumnId[]>([]);

  /**
   * Handle drag start - compute valid drop targets for visual feedback
   */
  const handleDragStart = useCallback(
    (activeId: string) => {
      setDraggingTaskId(activeId);
      // Find the task being dragged
      const task = tasks.find((t) => t.id === activeId);
      if (task) {
        const currentStatus = task.status as VibeTaskStatus;
        const targets = getValidDropTargets(currentStatus);
        setValidDropTargets(targets);
      }
    },
    [tasks]
  );

  /**
   * Handle drag end - move task to new status with transition validation
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Clear dragging state first
      setDraggingTaskId(null);
      setValidDropTargets([]);

      const { active, over } = event;

      if (!over) return;

      const taskId = active.id as string;
      const newColumnId = over.id as KanbanColumnId;
      const newStatus = COLUMN_TO_STATUS[newColumnId];

      if (!newStatus) return;

      // Get current task
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const currentStatus = task.status as VibeTaskStatus;
      const currentColumn = STATUS_TO_COLUMN[currentStatus];

      // Skip if same column (just reordering)
      if (currentColumn === newColumnId) return;

      // Validate status transition
      if (!isValidStatusTransition(currentStatus, newColumnId)) {
        // Notify about invalid transition
        onInvalidMove?.(currentColumn, newColumnId);
        return;
      }

      const isMovingToInProgress = newStatus === "in_progress" && currentStatus !== "in_progress";

      // Notify about the move
      onMoveTask(taskId, newColumnId);

      // If moving to in-progress, trigger callback for auto-start
      if (isMovingToInProgress) {
        onMovedToInProgress?.(taskId);
      }
    },
    [tasks, onMoveTask, onInvalidMove, onMovedToInProgress]
  );

  /**
   * Handle drag cancel - clear visual feedback state
   */
  const handleDragCancel = useCallback(() => {
    setDraggingTaskId(null);
    setValidDropTargets([]);
  }, []);

  return {
    draggingTaskId,
    validDropTargets,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}

export type { UseDragDropOptions };
