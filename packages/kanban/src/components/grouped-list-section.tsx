"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge, cn } from "@viben/ui";
import type { ListGroup } from "./grouped-list-types";

export interface GroupedListSectionProps {
  /** The group data */
  group: ListGroup;
  /** Whether the section is collapsed */
  collapsed?: boolean;
  /** Callback when the section is toggled */
  onToggle?: (groupId: string) => void;
  /** Children to render inside the section */
  children?: React.ReactNode;
  /** Additional class name */
  className?: string;
}

export function GroupedListSection({
  group,
  collapsed = false,
  onToggle,
  children,
  className,
}: GroupedListSectionProps) {
  const handleToggle = () => {
    onToggle?.(group.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={cn("border-b last:border-b-0", className)}>
      {/* Section Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          "bg-muted/30 hover:bg-muted/50",
          "cursor-pointer select-none",
          "transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
        )}
      >
        {/* Chevron icon */}
        <span className="shrink-0 text-muted-foreground">
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>

        {/* Color indicator dot */}
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: group.color }}
        />

        {/* Group name */}
        <span className="flex-1 text-sm font-medium truncate">{group.name}</span>

        {/* Item count badge */}
        <Badge variant="secondary" className="text-xs shrink-0">
          {group.count}
        </Badge>
      </div>

      {/* Section Content */}
      {!collapsed && (
        <div className="flex flex-col">
          {children}
        </div>
      )}
    </div>
  );
}

GroupedListSection.displayName = "GroupedListSection";
