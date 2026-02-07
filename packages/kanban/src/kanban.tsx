"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Button, cn } from "@viben/ui";
import type { DragEndEvent, Modifier } from "@dnd-kit/core";
import {
  DndContext,
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
        "flex min-h-40 flex-col",
        isOver ? "outline-primary" : "outline-black",
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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: { index, parent },
      disabled: dragDisabled,
    });

  const combinedRef = (node: HTMLDivElement | null) => {
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
        "group relative p-3 outline-none flex flex-col space-y-2",
        "bg-card rounded-lg border border-border",
        "transition-all duration-200 ease-out cursor-grab",
        isDragging && "cursor-grabbing opacity-90 rotate-1 scale-[1.02] shadow-lg z-50",
        isOpen && "ring-2 ring-secondary-foreground ring-inset",
        !isDragging && !isOpen && "hover:bg-card/80",
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
          ? `translateX(${transform.x}px) translateY(${transform.y}px)`
          : "none",
      }}
    >
      {/* More menu button - top right corner, visible on hover */}
      {showMoreMenu && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute top-1.5 right-1.5 h-6 w-6",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-muted"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onMoreClick?.(e);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="More actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Card content */}
      {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
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
    <div className={cn("flex flex-1 flex-col", className)}>
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-32 text-center px-4">
          <ClipboardList className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground/70 font-medium">
            {emptyMessage}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
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
        "sticky top-0 z-20 flex shrink-0 items-center gap-2 p-3",
        "bg-background border-b border-dashed border-border",
        props.className
      )}
      style={{
        backgroundImage: `linear-gradient(hsl(var(${props.color}) / 0.03), hsl(var(${props.color}) / 0.03))`,
      }}
    >
      <span className="flex-1 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: `hsl(var(${props.color}))` }}
        />
        <p className="m-0 text-sm font-medium">{props.name}</p>
        {taskCount !== undefined && (
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-xs font-medium rounded bg-muted text-muted-foreground">
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
              className="h-6 w-6 text-foreground/50 hover:text-foreground hover:bg-muted"
              onClick={props.onAddTask}
              aria-label={addTaskLabel}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{addTaskLabel}</TooltipContent>
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
};

export const KanbanProvider = ({
  children,
  onDragEnd,
  className,
}: KanbanProviderProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  return (
    <DndContext
      collisionDetection={rectIntersection}
      onDragEnd={onDragEnd}
      sensors={sensors}
      modifiers={[restrictToFirstScrollableAncestorCustom]}
    >
      <div
        className={cn(
          "inline-grid grid-flow-col auto-cols-[280px] divide-x border-x items-stretch min-h-full",
          className
        )}
      >
        {children}
      </div>
    </DndContext>
  );
};
