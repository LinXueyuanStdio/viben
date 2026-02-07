"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button, cn } from "@viben/ui";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      className={cn(
        "flex min-h-40 flex-col transition-all duration-200",
        isOver && "bg-accent/20 ring-1 ring-inset ring-primary/20",
        className
      )}
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
}: KanbanCardProps) => {
  const localRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <div
      className={cn(
        "group relative p-3 outline-none flex flex-col gap-2",
        "bg-card rounded-lg border border-border/60",
        "transition-all duration-200 ease-out",
        !dragDisabled && "cursor-grab active:cursor-grabbing",
        isDragging && "shadow-2xl scale-[1.02] rotate-1 border-border bg-card z-50",
        isOpen && "ring-2 ring-primary/60 border-primary/30 bg-accent/40",
        !isDragging && !isOpen && "hover:border-border hover:shadow-sm hover:bg-accent/20",
        className
      )}
      {...listeners}
      {...attributes}
      ref={combinedRef}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{
        zIndex: isDragging ? 1000 : 1,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition: isDragging
          ? "box-shadow 200ms, transform 0ms"
          : "all 200ms cubic-bezier(0.2, 0, 0, 1)",
      }}
    >
      {/* More menu button - top right corner, visible on hover */}
      {showMoreMenu && (
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
      )}

      {/* Card content */}
      {children ?? <p className="m-0 text-sm leading-snug">{name}</p>}
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
        <div className="flex flex-col items-center justify-center h-32 text-center px-4 rounded-lg border border-dashed border-border/40">
          <ClipboardList className="h-6 w-6 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground/60">
            {emptyMessage}
          </p>
          <p className="text-xs text-muted-foreground/40 mt-0.5">
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
    };

export const KanbanHeader = (props: KanbanHeaderProps) => {
  if ("children" in props) {
    return props.children;
  }

  const addTaskLabel = props.addTaskLabel ?? "Add task";
  const taskCount = props.taskCount;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex shrink-0 items-center gap-2.5 px-3 py-2.5",
        "backdrop-blur-sm border-b border-border/40",
        props.className
      )}
      style={{
        backgroundColor: `hsl(var(${props.color}) / 0.08)`,
        backgroundImage: `linear-gradient(to bottom, hsl(var(${props.color}) / 0.12), hsl(var(${props.color}) / 0.06))`,
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
        <p className="m-0 text-sm font-medium truncate">{props.name}</p>
        {taskCount !== undefined && (
          <span
            className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[11px] font-medium rounded-md tabular-nums"
            style={{
              backgroundColor: `hsl(var(${props.color}) / 0.15)`,
              color: `hsl(var(${props.color}))`,
            }}
          >
            {taskCount}
          </span>
        )}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors"
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
  className?: string;
  /** Render function for drag overlay */
  renderDragOverlay?: (activeId: string | null) => React.ReactNode;
};

export const KanbanProvider = ({
  children,
  onDragEnd,
  className,
  renderDragOverlay,
}: KanbanProviderProps) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  return (
    <DndContext
      collisionDetection={rectIntersection}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={(event) => {
        setActiveId(null);
        onDragEnd(event);
      }}
      onDragCancel={() => setActiveId(null)}
      sensors={sensors}
      modifiers={[restrictToFirstScrollableAncestorCustom]}
    >
      <div
        className={cn(
          "inline-grid grid-flow-col auto-cols-[280px] gap-0 items-stretch min-h-full",
          "divide-x divide-border/30",
          className
        )}
      >
        {children}
      </div>
      {renderDragOverlay && (
        <DragOverlay
          dropAnimation={{
            duration: 200,
            easing: "cubic-bezier(0.2, 0, 0, 1)",
          }}
        >
          {activeId ? renderDragOverlay(activeId) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
};
