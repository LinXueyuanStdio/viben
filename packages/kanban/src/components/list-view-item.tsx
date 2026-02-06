"use client";

import * as React from "react";
import { cn } from "@viben/ui";

export interface ListViewItemProps<T> {
  item: T;
  onClick?: () => void;
  isSelected?: boolean;
  renderStatus?: (item: T) => React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function ListViewItem<T>({
  item,
  onClick,
  isSelected = false,
  renderStatus,
  className,
  children,
}: ListViewItemProps<T>) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        "cursor-pointer transition-all duration-200",
        "hover:bg-muted/50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
        isSelected && "bg-accent",
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Status indicator */}
      {renderStatus && (
        <div className="shrink-0">{renderStatus(item)}</div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

ListViewItem.displayName = "ListViewItem";
