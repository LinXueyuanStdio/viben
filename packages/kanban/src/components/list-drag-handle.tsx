"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@viben/ui";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

export interface ListDragHandleProps {
  /** Listeners from useDraggable hook */
  listeners?: SyntheticListenerMap;
  /** Attributes from useDraggable hook */
  attributes?: DraggableAttributes;
  /** Additional class name */
  className?: string;
  /** Whether the drag handle is disabled */
  disabled?: boolean;
}

export const ListDragHandle = React.forwardRef<HTMLButtonElement, ListDragHandleProps>(
  ({ listeners, attributes, className, disabled = false }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "shrink-0 cursor-grab touch-none rounded p-1",
          "text-muted-foreground/50",
          "hover:text-muted-foreground hover:bg-muted/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "transition-colors duration-200",
          "active:cursor-grabbing",
          disabled && "cursor-not-allowed opacity-50 pointer-events-none",
          className
        )}
        disabled={disabled}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    );
  }
);

ListDragHandle.displayName = "ListDragHandle";
