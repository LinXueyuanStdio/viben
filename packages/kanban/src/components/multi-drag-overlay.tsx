"use client";

import * as React from "react";
import { DragOverlay } from "@dnd-kit/core";
import { DragPreview } from "./drag-preview";

export interface MultiDragOverlayProps {
  /**
   * Whether a drag operation is in progress
   */
  isDragging: boolean;
  /**
   * IDs of all items being dragged
   */
  draggedIds: string[];
  /**
   * The ID of the actively dragged item
   */
  activeId: string | null;
  /**
   * Function to render the content for a given item ID
   */
  renderItem: (id: string) => React.ReactNode;
  /**
   * Optional modifier class for the overlay
   */
  className?: string;
}

/**
 * MultiDragOverlay renders a drag overlay using @dnd-kit's DragOverlay.
 * Shows a preview for the dragged item(s) with multi-select badge if applicable.
 *
 * @example
 * ```tsx
 * <DndContext
 *   onDragStart={handleDragStart}
 *   onDragEnd={handleDragEnd}
 * >
 *   {children}
 *   <MultiDragOverlay
 *     isDragging={isDragging}
 *     draggedIds={draggedIds}
 *     activeId={activeId}
 *     renderItem={(id) => <TaskCard task={tasks.find(t => t.id === id)} />}
 *   />
 * </DndContext>
 * ```
 */
export function MultiDragOverlay({
  isDragging,
  draggedIds,
  activeId,
  renderItem,
  className,
}: MultiDragOverlayProps) {
  if (!isDragging || !activeId) {
    return null;
  }

  const count = draggedIds.length;

  return (
    <DragOverlay dropAnimation={null}>
      <DragPreview count={count} className={className}>
        {renderItem(activeId)}
      </DragPreview>
    </DragOverlay>
  );
}

MultiDragOverlay.displayName = "MultiDragOverlay";
