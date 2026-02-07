"use client";

import * as React from "react";
import { Card, Badge, cn } from "@viben/ui";
import { Move } from "lucide-react";

export interface DragPreviewProps {
  children: React.ReactNode;
  count?: number;
  className?: string;
}

/**
 * DragPreview renders a styled preview during drag operations.
 * Shows single card content or multi-select count badge.
 */
export function DragPreview({
  children,
  count = 1,
  className,
}: DragPreviewProps) {
  const isMultiSelect = count > 1;

  return (
    <div className={cn("relative", className)}>
      {/* Shadow layers for depth effect */}
      {isMultiSelect && (
        <>
          <div
            className="absolute inset-0 rounded-lg bg-muted/60 border border-border"
            style={{ transform: "translate(8px, 8px)" }}
          />
          <div
            className="absolute inset-0 rounded-lg bg-muted/80 border border-border"
            style={{ transform: "translate(4px, 4px)" }}
          />
        </>
      )}

      {/* Main preview card */}
      <Card
        className={cn(
          "relative p-3 border shadow-lg",
          "opacity-90 bg-background",
          "cursor-grabbing"
        )}
        interactive={false}
      >
        <div className="flex items-start gap-2">
          <Move className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </Card>

      {/* Multi-select count badge */}
      {isMultiSelect && (
        <Badge
          variant="default"
          className={cn(
            "absolute -top-2 -right-2 z-10",
            "min-w-[1.5rem] h-6 px-2",
            "flex items-center justify-center",
            "text-xs font-semibold",
            "shadow-md"
          )}
        >
          {count}
        </Badge>
      )}
    </div>
  );
}

DragPreview.displayName = "DragPreview";
