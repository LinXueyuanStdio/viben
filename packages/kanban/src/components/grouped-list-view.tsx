"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { cn } from "@viben/ui";
import { GroupedListSection } from "./grouped-list-section";
import type { ListGroup } from "./grouped-list-types";

export interface GroupedListViewProps<T extends { id: string }> {
  /** All items to display */
  items: T[];
  /** Group definitions */
  groups: ListGroup[];
  /** Function to determine which group an item belongs to */
  groupBy: (item: T) => string;
  /** Set of collapsed group IDs */
  collapsedGroups?: Set<string>;
  /** Callback when a group is toggled */
  onToggleGroup?: (groupId: string) => void;
  /** Function to render each item */
  renderItem: (item: T, dragProps: DragItemProps) => React.ReactNode;
  /** Callback when drag ends */
  onDragEnd?: (event: DragEndEvent, item: T, newGroupId: string) => void;
  /** Message to show when a group is empty */
  emptyMessage?: string;
  /** Additional class name */
  className?: string;
  /** Whether drag is disabled */
  dragDisabled?: boolean;
}

export interface DragItemProps {
  /** Whether the item is being dragged */
  isDragging: boolean;
  /** Listeners to attach to the drag handle */
  listeners: ReturnType<typeof useDraggable>["listeners"];
  /** Attributes to attach to the drag handle */
  attributes: ReturnType<typeof useDraggable>["attributes"];
  /** Ref to attach to the draggable element */
  setNodeRef: ReturnType<typeof useDraggable>["setNodeRef"];
}

/** Internal component for making items draggable */
function DraggableItem<T extends { id: string }>({
  item,
  renderItem,
  disabled,
}: {
  item: T;
  renderItem: (item: T, dragProps: DragItemProps) => React.ReactNode;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {renderItem(item, { isDragging, listeners, attributes, setNodeRef: () => {} })}
    </div>
  );
}

/** Internal component for droppable groups */
function DroppableGroup({
  groupId,
  children,
}: {
  groupId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: groupId,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[1px] transition-colors duration-200",
        isOver && "bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

export function GroupedListView<T extends { id: string }>({
  items,
  groups,
  groupBy,
  collapsedGroups = new Set(),
  onToggleGroup,
  renderItem,
  onDragEnd,
  emptyMessage = "No items",
  className,
  dragDisabled = false,
}: GroupedListViewProps<T>) {
  const [activeItem, setActiveItem] = useState<T | null>(null);

  // Group items by their group ID
  const groupedItems = useMemo(() => {
    const grouped = new Map<string, T[]>();

    // Initialize all groups with empty arrays
    groups.forEach((group) => {
      grouped.set(group.id, []);
    });

    // Distribute items into groups
    items.forEach((item) => {
      const groupId = groupBy(item);
      const groupItems = grouped.get(groupId);
      if (groupItems) {
        groupItems.push(item);
      } else {
        // Item belongs to an unknown group, add to first group if available
        const firstGroup = groups[0];
        if (firstGroup) {
          grouped.get(firstGroup.id)?.push(item);
        }
      }
    });

    return grouped;
  }, [items, groups, groupBy]);

  // Update group counts
  const groupsWithCounts = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      count: groupedItems.get(group.id)?.length ?? 0,
    }));
  }, [groups, groupedItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = (active.data.current as { item: T } | undefined)?.item;
    if (item) {
      setActiveItem(item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over || !onDragEnd) return;

    const item = (active.data.current as { item: T } | undefined)?.item;
    if (!item) return;

    const newGroupId = over.id as string;
    const currentGroupId = groupBy(item);

    // Only trigger callback if dropped on a different group
    if (newGroupId !== currentGroupId) {
      onDragEnd(event, item, newGroupId);
    }
  };

  if (items.length === 0 && groups.every((g) => groupedItems.get(g.id)?.length === 0)) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12",
          "text-muted-foreground",
          className
        )}
      >
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "flex flex-col border rounded-lg overflow-hidden",
          "transition-all duration-200",
          className
        )}
      >
        {groupsWithCounts.map((group) => {
          const groupItems = groupedItems.get(group.id) ?? [];
          const isCollapsed = collapsedGroups.has(group.id);

          return (
            <GroupedListSection
              key={group.id}
              group={group}
              collapsed={isCollapsed}
              onToggle={onToggleGroup}
            >
              <DroppableGroup groupId={group.id}>
                {groupItems.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                ) : (
                  groupItems.map((item) => (
                    <DraggableItem
                      key={item.id}
                      item={item}
                      renderItem={renderItem}
                      disabled={dragDisabled}
                    />
                  ))
                )}
              </DroppableGroup>
            </GroupedListSection>
          );
        })}
      </div>

      {/* Drag overlay for the item being dragged */}
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-90 shadow-lg rounded-lg">
            {renderItem(activeItem, {
              isDragging: true,
              listeners: undefined,
              attributes: {} as ReturnType<typeof useDraggable>["attributes"],
              setNodeRef: () => {},
            })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

GroupedListView.displayName = "GroupedListView";
