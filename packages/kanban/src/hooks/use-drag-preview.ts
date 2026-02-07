import { useState, useCallback, useMemo } from "react";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";

export interface UseDragPreviewOptions {
  /**
   * Set of currently selected item IDs
   */
  selectedIds: Set<string>;
  /**
   * Callback when drag ends. Receives the event and all dragged item IDs.
   */
  onDragEnd?: (event: DragEndEvent, draggedIds: string[]) => void;
}

export interface UseDragPreviewReturn {
  /**
   * Whether a drag operation is in progress
   */
  isDragging: boolean;
  /**
   * IDs of all items being dragged (supports multi-select)
   */
  draggedIds: string[];
  /**
   * The ID of the actively dragged item (the one user grabbed)
   */
  activeId: string | null;
  /**
   * Handler for dnd-kit DragStartEvent
   */
  handleDragStart: (event: DragStartEvent) => void;
  /**
   * Handler for dnd-kit DragEndEvent
   */
  handleDragEnd: (event: DragEndEvent) => void;
  /**
   * Function to render preview content
   */
  renderPreview: (renderItem: (id: string) => ReactNode) => ReactNode | null;
}

/**
 * Hook for managing drag preview state with multi-select support.
 *
 * When dragging a selected item, all selected items will be dragged together.
 * When dragging an unselected item, only that item is dragged.
 *
 * @example
 * ```tsx
 * const { selectedIds } = useMultiSelect(items);
 * const {
 *   isDragging,
 *   draggedIds,
 *   handleDragStart,
 *   handleDragEnd,
 *   renderPreview
 * } = useDragPreview({
 *   selectedIds,
 *   onDragEnd: (event, ids) => {
 *     // Handle moving all dragged items
 *     moveItems(ids, event.over?.id);
 *   }
 * });
 * ```
 */
export function useDragPreview({
  selectedIds,
  onDragEnd,
}: UseDragPreviewOptions): UseDragPreviewReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedIds, setDraggedIds] = useState<string[]>([]);

  const isDragging = activeId !== null;

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveId(id);

      // If dragging a selected item, drag all selected items
      // Otherwise, only drag the single item
      if (selectedIds.has(id)) {
        setDraggedIds(Array.from(selectedIds));
      } else {
        setDraggedIds([id]);
      }
    },
    [selectedIds]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const currentDraggedIds = [...draggedIds];

      // Reset state first
      setActiveId(null);
      setDraggedIds([]);

      // Call the callback with dragged IDs
      if (onDragEnd) {
        onDragEnd(event, currentDraggedIds);
      }
    },
    [draggedIds, onDragEnd]
  );

  const renderPreview = useCallback(
    (renderItem: (id: string) => ReactNode): ReactNode | null => {
      if (!activeId) {
        return null;
      }

      // Return the rendered item for the active ID
      // The actual DragOverlay wrapping is done in MultiDragOverlay component
      return renderItem(activeId);
    },
    [activeId]
  );

  return useMemo(
    () => ({
      isDragging,
      draggedIds,
      activeId,
      handleDragStart,
      handleDragEnd,
      renderPreview,
    }),
    [isDragging, draggedIds, activeId, handleDragStart, handleDragEnd, renderPreview]
  );
}
