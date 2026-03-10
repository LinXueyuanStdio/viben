"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button, cn } from "@viben/ui";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, ClipboardList } from "lucide-react";
import type { ClientRect } from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";

export type { DragEndEvent } from "@dnd-kit/core";

export type Status = {
  id: string;
  name: string;
  color: string;
};

export type Feature = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: Status;
};

// Status indicator color mapping
export type StatusIndicator = "todo" | "in-progress" | "review" | "done" | "blocked";

export const STATUS_INDICATOR_COLORS: Record<StatusIndicator, string> = {
  todo: "bg-muted-foreground/40",
  "in-progress": "bg-blue-500",
  review: "bg-amber-500",
  done: "bg-green-500",
  blocked: "bg-red-500",
};

export type KanbanBoardProps = {
  id: Status["id"];
  children: React.ReactNode;
  className?: string;
  /** Column background color (CSS variable name like "--primary") */
  backgroundColor?: string;
  /** Whether this column is a valid drop target for the currently dragged item */
  isValidDropTarget?: boolean;
  /** Whether an item is currently being dragged (for visual feedback) */
  isDragging?: boolean;
};

export const KanbanBoard = ({ id, children, className, backgroundColor, isValidDropTarget, isDragging }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  // Determine visual state: valid target, invalid target, or neutral
  const showValidHighlight = isDragging && isValidDropTarget === true;
  const showInvalidHighlight = isDragging && isValidDropTarget === false;

  return (
    <div
      className={cn(
        "flex min-h-40 flex-col flex-1 transition-all duration-200",
        // When dragging over valid target
        isOver && isValidDropTarget !== false && "ring-2 ring-inset ring-primary/40",
        // When dragging over invalid target
        isOver && isValidDropTarget === false && "ring-2 ring-inset ring-destructive/40",
        // Valid target highlight (not hovered)
        showValidHighlight && !isOver && "ring-1 ring-inset ring-success/30",
        // Invalid target dimming
        showInvalidHighlight && "opacity-50",
        className
      )}
      style={{
        backgroundColor: backgroundColor
          ? `hsl(var(${backgroundColor}) / 0.03)`
          : undefined,
        ...(isOver && isValidDropTarget !== false && backgroundColor ? {
          backgroundColor: `hsl(var(${backgroundColor}) / 0.08)`,
        } : {}),
        ...(isOver && isValidDropTarget === false ? {
          backgroundColor: "hsl(var(--destructive) / 0.05)",
        } : {}),
      }}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps = Pick<Feature, "id" | "name"> & {
  index: number;
  parent: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  tabIndex?: number;
  forwardedRef?: React.Ref<HTMLDivElement>;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  isOpen?: boolean;
  dragDisabled?: boolean;
  /** Status indicator color (defaults to parent-based color) */
  statusIndicator?: StatusIndicator;
  /** Show more menu button on hover */
  showMoreMenu?: boolean;
  /** Callback when more menu is clicked */
  onMoreClick?: (e: React.MouseEvent) => void;
  /** Render prop for more menu content (dropdown menu). Receives onOpenChange callback to notify when menu opens/closes */
  renderMoreMenu?: (onOpenChange?: (open: boolean) => void) => React.ReactNode;
  /** Callback when menu open state changes */
  onMenuOpenChange?: (open: boolean) => void;
};

export const KanbanCard = ({
  id,
  name,
  index,
  parent,
  children,
  className,
  onClick,
  tabIndex,
  forwardedRef,
  onKeyDown,
  isOpen,
  dragDisabled = false,
  statusIndicator,
  showMoreMenu = false,
  onMoreClick,
  renderMoreMenu,
  onMenuOpenChange,
}: KanbanCardProps) => {
  const localRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Notify parent when menu open state changes
  const handleMenuOpenChange = React.useCallback((open: boolean) => {
    setIsMenuOpen(open);
    onMenuOpenChange?.(open);
  }, [onMenuOpenChange]);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: { index, parent },
      disabled: dragDisabled,
    });

  // Smooth scroll into view when selected
  useEffect(() => {
    if (!isOpen || !localRef.current) return;
    const el = localRef.current;
    requestAnimationFrame(() => {
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
    });
  }, [isOpen]);

  const combinedRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    setNodeRef(node);
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef && typeof forwardedRef === "object") {
      (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current =
        node;
    }
  };

  // When dragging with DragOverlay, we don't apply transform to the original card
  // The original card stays in place (as a placeholder) while DragOverlay follows cursor
  return (
    <div
      className={cn(
        "group relative p-3 outline-none flex flex-col gap-2",
        "rounded-lg border",
        "transition-all duration-150 ease-out",
        !dragDisabled && "cursor-grab active:cursor-grabbing",
        // When dragging: show as a subtle dashed placeholder
        isDragging
          ? "border-dashed border-muted-foreground/30 bg-muted/30"
          : "bg-card border-border/60",
        isOpen && !isDragging && "ring-2 ring-primary/60 border-primary/30 bg-accent/40",
        !isDragging && !isOpen && "hover:border-border hover:shadow-sm hover:bg-accent/20",
        className
      )}
      {...listeners}
      {...attributes}
      ref={combinedRef}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {/* Content wrapper - invisible when dragging to show placeholder */}
      <div className={cn("contents", isDragging && "[&>*]:invisible")}>
        {/* More menu button - top right corner, visible on hover or when menu is open */}
        {showMoreMenu && (
          renderMoreMenu ? (
            <div
              className={cn(
                "absolute top-2 right-2 z-10",
                // Stay visible when menu is open, otherwise show on hover
                isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                "transition-all duration-150"
              )}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {renderMoreMenu(handleMenuOpenChange)}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-2 right-2 h-6 w-6 rounded-md",
                "opacity-0 group-hover:opacity-100 focus:opacity-100",
                "transition-all duration-150",
                "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onMoreClick?.(e);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )
        )}

        {/* Card content */}
        {children ?? <p className="m-0 text-sm leading-snug">{name}</p>}
      </div>
    </div>
  );
};

export type KanbanCardsProps = {
  children: React.ReactNode;
  className?: string;
  /** Show empty state when no children */
  emptyMessage?: string;
  /** Secondary empty state message */
  emptyHint?: string;
};

export const KanbanCards = ({
  children,
  className,
  emptyMessage = "No tasks",
  emptyHint = "Drag tasks here or click + to create",
}: KanbanCardsProps) => {
  // Check if children is empty (no actual tasks)
  const isEmpty = React.Children.count(children) === 0;

  return (
    <div className={cn("flex flex-1 flex-col gap-2 p-2", className)}>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[120px] text-center px-4 py-6 mx-1 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 transition-colors hover:border-muted-foreground/30 hover:bg-muted/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/70">
            {emptyMessage}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1 max-w-[180px]">
            {emptyHint}
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
};

export type KanbanHeaderProps =
  | {
      children: React.ReactNode;
    }
  | {
      name: Status["name"];
      color: Status["color"];
      className?: string;
      onAddTask?: () => void;
      addTaskLabel?: string;
      /** Number of tasks in this column */
      taskCount?: number;
      /** Work-in-progress limit for this column */
      wipLimit?: number;
      /** Show warning style when WIP limit is exceeded */
      showWipWarning?: boolean;
    };

export const KanbanHeader = (props: KanbanHeaderProps) => {
  if ("children" in props) {
    return props.children;
  }

  const addTaskLabel = props.addTaskLabel ?? "Add task";
  const taskCount = props.taskCount;
  const wipLimit = props.wipLimit;
  const isOverWip = wipLimit !== undefined && taskCount !== undefined && taskCount > wipLimit;
  const showWarning = props.showWipWarning !== false && isOverWip;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex shrink-0 items-center gap-2.5 px-3 py-2.5",
        "backdrop-blur-sm border-b",
        props.className
      )}
      style={{
        backgroundColor: `hsl(var(${props.color}) / 0.08)`,
        borderColor: `hsl(var(${props.color}) / 0.15)`,
      }}
    >
      <span className="flex-1 flex items-center gap-2.5 min-w-0">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{
            backgroundColor: `hsl(var(${props.color}))`,
            boxShadow: `0 0 0 3px hsl(var(${props.color}) / 0.25)`,
          }}
        />
        <p className="m-0 text-sm font-semibold truncate" style={{ color: `hsl(var(${props.color}))` }}>{props.name}</p>
        {taskCount !== undefined && (
          <span
            className={cn(
              "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-full tabular-nums",
              showWarning && "bg-destructive/20 text-destructive"
            )}
            style={showWarning ? undefined : {
              backgroundColor: `hsl(var(${props.color}) / 0.15)`,
              color: `hsl(var(${props.color}))`,
            }}
          >
            {taskCount}
            {wipLimit !== undefined && `/${wipLimit}`}
          </span>
        )}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md transition-colors"
              style={{
                color: `hsl(var(${props.color}) / 0.7)`,
              }}
              onClick={props.onAddTask}
              aria-label={addTaskLabel}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{addTaskLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

function restrictToBoundingRectWithRightPadding(
  transform: Transform,
  rect: ClientRect,
  boundingRect: ClientRect,
  rightPadding: number
): Transform {
  const value = { ...transform };

  if (rect.top + transform.y <= boundingRect.top) {
    value.y = boundingRect.top - rect.top;
  } else if (
    rect.bottom + transform.y >=
    boundingRect.top + boundingRect.height
  ) {
    value.y = boundingRect.top + boundingRect.height - rect.bottom;
  }

  if (rect.left + transform.x <= boundingRect.left) {
    value.x = boundingRect.left - rect.left;
  } else if (
    rect.right + transform.x + rightPadding >=
    boundingRect.left + boundingRect.width
  ) {
    value.x =
      boundingRect.left + boundingRect.width - rect.right - rightPadding;
  }

  return { ...value, x: value.x };
}

const restrictToFirstScrollableAncestorCustom: Modifier = (args) => {
  const { draggingNodeRect, transform, scrollableAncestorRects } = args;
  const firstScrollableAncestorRect = scrollableAncestorRects[0];

  if (!draggingNodeRect || !firstScrollableAncestorRect) {
    return transform;
  }

  const rightPadding = 16;
  return restrictToBoundingRectWithRightPadding(
    transform,
    draggingNodeRect,
    firstScrollableAncestorRect,
    rightPadding
  );
};

export type KanbanProviderProps = {
  children: React.ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  /** Callback when drag starts, provides the active item ID */
  onDragStart?: (activeId: string) => void;
  /** Callback when drag is cancelled */
  onDragCancel?: () => void;
  className?: string;
  /** Render function for drag overlay */
  renderDragOverlay?: (activeId: string | null) => React.ReactNode;
};

export const KanbanProvider = ({
  children,
  onDragEnd,
  onDragStart,
  onDragCancel,
  className,
  renderDragOverlay,
}: KanbanProviderProps) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      collisionDetection={rectIntersection}
      onDragStart={(event) => {
        const id = String(event.active.id);
        setActiveId(id);
        onDragStart?.(id);
      }}
      onDragEnd={(event) => {
        setActiveId(null);
        onDragEnd(event);
      }}
      onDragCancel={() => {
        setActiveId(null);
        onDragCancel?.();
      }}
      sensors={sensors}
      modifiers={[restrictToFirstScrollableAncestorCustom]}
    >
      <div
        className={cn(
          "flex flex-row divide-x border-x items-stretch h-full",
          className
        )}
      >
        {children}
      </div>
      {renderDragOverlay && (
        <DragOverlay
          dropAnimation={null}
          className="cursor-grabbing"
          style={{ zIndex: 9999 }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {activeId ? (renderDragOverlay(activeId) as any) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
};
