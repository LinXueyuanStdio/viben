"use client";

import * as React from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button, Badge, cn } from "@viben/ui";

export interface CollapsibleColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  wipLimit?: number;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleColumn({
  id,
  title,
  color,
  count,
  wipLimit,
  collapsed = false,
  onToggleCollapse,
  children,
  className,
}: CollapsibleColumnProps) {
  const isOverWip = wipLimit !== undefined && count > wipLimit;

  if (collapsed) {
    return (
      <div
        className={cn(
          "w-12 flex flex-col items-center py-3 cursor-pointer",
          "bg-muted/30 hover:bg-muted/50 border-r",
          "transition-all duration-200",
          className
        )}
        onClick={() => onToggleCollapse?.(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onToggleCollapse?.(false);
          }
        }}
      >
        <div
          className="w-2 h-2 rounded-full mb-3 shrink-0"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-xs font-medium text-muted-foreground"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          {title}
        </span>
        <Badge
          variant={isOverWip ? "destructive" : "secondary"}
          className="mt-3 text-xs px-1.5 py-0.5"
        >
          {count}
        </Badge>
        <ChevronsRight className="h-4 w-4 mt-3 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-background sticky top-0 z-10">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 text-sm font-medium truncate">{title}</span>
        <Badge
          variant={isOverWip ? "destructive" : "secondary"}
          className="text-xs"
        >
          {count}
          {wipLimit !== undefined && `/${wipLimit}`}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onToggleCollapse?.(true)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

CollapsibleColumn.displayName = "CollapsibleColumn";
