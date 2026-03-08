/**
 * CollapsedColumn - Collapsed state representation of a kanban column
 *
 * Renders a narrow vertical bar with:
 * - Column color indicator (dot)
 * - Rotated column name (vertical text)
 * - Task count badge
 * - Expand icon
 *
 * Clicking expands the column back to full width.
 */

import { ChevronsRight } from "lucide-react";
import { Badge, cn } from "@viben/ui";
import type { ColumnState } from "../types";

export interface CollapsedColumnProps {
  /** Column data (subset of ColumnState) */
  column: Pick<ColumnState, "id" | "name" | "colorVar" | "tasks">;
  /** Callback when user clicks to expand */
  onExpand: () => void;
}

/**
 * Collapsed column component
 *
 * Displays a narrow clickable strip representing a collapsed kanban column.
 * Shows column color, name (rotated vertically), task count, and expand icon.
 */
export function CollapsedColumn({ column, onExpand }: CollapsedColumnProps) {
  const taskCount = column.tasks.length;

  return (
    <div
      className={cn(
        // Layout - narrow vertical strip
        "w-12 flex flex-col items-center py-3 cursor-pointer",
        // Visual styling
        "bg-muted/30 hover:bg-muted/50 border-r",
        // Smooth transitions
        "transition-all duration-200"
      )}
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      }}
      aria-label={`Expand ${column.name} column`}
      aria-expanded={false}
    >
      {/* Column color indicator */}
      <div
        className="w-2.5 h-2.5 rounded-full mb-3 shrink-0"
        style={{ backgroundColor: `hsl(var(${column.colorVar}))` }}
        aria-hidden="true"
      />

      {/* Rotated column name */}
      <span
        className="text-xs font-medium text-muted-foreground"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
        }}
      >
        {column.name}
      </span>

      {/* Task count badge */}
      <Badge variant="secondary" className="mt-3 text-xs px-1.5 py-0.5">
        {taskCount}
      </Badge>

      {/* Expand icon */}
      <ChevronsRight
        className="h-4 w-4 mt-3 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
