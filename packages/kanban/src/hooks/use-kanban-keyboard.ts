"use client";

import { useEffect, useCallback } from "react";
import type { IssuePriority } from "../primitives/priority-config";

interface KanbanKeyboardItem {
  id: string;
  columnId: string;
}

interface UseKanbanKeyboardOptions<T extends KanbanKeyboardItem> {
  items: T[];
  columns: string[]; // Column IDs in order
  enabled?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCreateInColumn?: (columnId: string) => void;
  onPriorityChange?: (id: string, priority: IssuePriority) => void;
  onToggleSelect?: (id: string) => void;
}

const PRIORITY_KEYS: Record<string, IssuePriority> = {
  "1": "urgent",
  "2": "high",
  "3": "medium",
  "4": "low",
  "5": "none",
};

export function useKanbanKeyboard<T extends KanbanKeyboardItem>({
  items,
  columns,
  enabled = true,
  selectedId,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
  onCreateInColumn,
  onPriorityChange,
  onToggleSelect,
}: UseKanbanKeyboardOptions<T>) {
  // Get current selected item's position and column
  const getItemPosition = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return null;

      const columnIndex = columns.indexOf(item.columnId);
      const columnItems = items.filter((i) => i.columnId === item.columnId);
      const indexInColumn = columnItems.findIndex((i) => i.id === id);

      return { columnIndex, indexInColumn, columnItems, item };
    },
    [items, columns]
  );

  // Get items in a column
  const getColumnItems = useCallback(
    (columnId: string) => {
      return items.filter((i) => i.columnId === columnId);
    },
    [items]
  );

  // Navigate to next/previous item
  const navigateVertical = useCallback(
    (direction: "up" | "down") => {
      if (!selectedId) {
        // No selection, select first item in first column
        const firstColumnItems = getColumnItems(columns[0]);
        if (firstColumnItems.length > 0) {
          onSelect?.(firstColumnItems[0].id);
        }
        return;
      }

      const position = getItemPosition(selectedId);
      if (!position) return;

      const { columnItems, indexInColumn } = position;
      const newIndex =
        direction === "down"
          ? Math.min(indexInColumn + 1, columnItems.length - 1)
          : Math.max(indexInColumn - 1, 0);

      if (newIndex !== indexInColumn) {
        onSelect?.(columnItems[newIndex].id);
      }
    },
    [selectedId, getItemPosition, getColumnItems, columns, onSelect]
  );

  // Navigate to left/right column
  const navigateHorizontal = useCallback(
    (direction: "left" | "right") => {
      if (!selectedId) {
        const firstColumnItems = getColumnItems(columns[0]);
        if (firstColumnItems.length > 0) {
          onSelect?.(firstColumnItems[0].id);
        }
        return;
      }

      const position = getItemPosition(selectedId);
      if (!position) return;

      const { columnIndex, indexInColumn } = position;
      const newColumnIndex =
        direction === "right"
          ? Math.min(columnIndex + 1, columns.length - 1)
          : Math.max(columnIndex - 1, 0);

      if (newColumnIndex !== columnIndex) {
        const newColumnItems = getColumnItems(columns[newColumnIndex]);
        if (newColumnItems.length > 0) {
          // Try to maintain the same row position
          const targetIndex = Math.min(indexInColumn, newColumnItems.length - 1);
          onSelect?.(newColumnItems[targetIndex].id);
        }
      }
    },
    [selectedId, getItemPosition, getColumnItems, columns, onSelect]
  );

  // Keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          navigateVertical("down");
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          navigateVertical("up");
          break;
        case "ArrowLeft":
        case "h":
          e.preventDefault();
          navigateHorizontal("left");
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          navigateHorizontal("right");
          break;
        case "Enter":
          e.preventDefault();
          if (selectedId) {
            onOpen?.(selectedId);
          }
          break;
        case " ":
          e.preventDefault();
          if (selectedId) {
            onToggleSelect?.(selectedId);
          }
          break;
        case "e":
          e.preventDefault();
          if (selectedId) {
            onEdit?.(selectedId);
          }
          break;
        case "d":
        case "Delete":
        case "Backspace":
          if (e.key === "d" || e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (selectedId) {
              onDelete?.(selectedId);
            }
          }
          break;
        case "n":
          e.preventDefault();
          if (selectedId) {
            const position = getItemPosition(selectedId);
            if (position) {
              onCreateInColumn?.(position.item.columnId);
            }
          } else if (columns.length > 0) {
            onCreateInColumn?.(columns[0]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onSelect?.(null);
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          e.preventDefault();
          if (selectedId && PRIORITY_KEYS[e.key]) {
            onPriorityChange?.(selectedId, PRIORITY_KEYS[e.key]);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    selectedId,
    navigateVertical,
    navigateHorizontal,
    onOpen,
    onEdit,
    onDelete,
    onCreateInColumn,
    onPriorityChange,
    onToggleSelect,
    onSelect,
    getItemPosition,
    columns,
  ]);

  return {
    navigateVertical,
    navigateHorizontal,
  };
}
