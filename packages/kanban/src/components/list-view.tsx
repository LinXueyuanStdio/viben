"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";

export interface ListViewProps<T extends { id: string }> {
  items: T[];
  onItemClick?: (item: T) => void;
  selectedId?: string;
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  showHeader?: boolean;
  headerContent?: React.ReactNode;
}

export function ListView<T extends { id: string }>({
  items,
  onItemClick,
  selectedId,
  renderItem,
  emptyMessage,
  className,
  showHeader = false,
  headerContent,
}: ListViewProps<T>) {
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage ?? t("kanban.table.noItemsFound");

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12",
          "text-muted-foreground",
          className
        )}
      >
        <p className="text-sm">{resolvedEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col border rounded-lg overflow-hidden",
        "transition-all duration-200",
        className
      )}
    >
      {/* Optional header */}
      {showHeader && headerContent && (
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-2",
            "bg-muted/50 border-b",
            "text-sm font-medium text-muted-foreground"
          )}
        >
          {headerContent}
        </div>
      )}

      {/* List items */}
      <div className="flex flex-col">
        {items.map((item) => {
          const isSelected = selectedId === item.id;

          if (renderItem) {
            return (
              <div
                key={item.id}
                onClick={() => onItemClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onItemClick?.(item);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  "hover:bg-muted/50",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
                  isSelected && "bg-accent"
                )}
              >
                {renderItem(item, isSelected)}
              </div>
            );
          }

          // Default rendering when no renderItem provided
          return (
            <div
              key={item.id}
              onClick={() => onItemClick?.(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onItemClick?.(item);
                }
              }}
              role="button"
              tabIndex={0}
              className={cn(
                "flex items-center gap-3 px-4 py-3 border-b last:border-b-0",
                "cursor-pointer transition-all duration-200",
                "hover:bg-muted/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
                isSelected && "bg-accent"
              )}
            >
              <span className="text-sm truncate">{item.id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

ListView.displayName = "ListView";
