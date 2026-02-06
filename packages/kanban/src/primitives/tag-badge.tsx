"use client";

import * as React from "react";
import { cn } from "@viben/ui";
import { X } from "lucide-react";
import type { Tag } from "./tag-config";

export interface TagBadgeProps {
  tag: Tag;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export const TagBadge = React.forwardRef<HTMLSpanElement, TagBadgeProps>(
  ({ tag, size = "md", onRemove, className }, ref) => {
    const sizeClasses = {
      sm: "text-xs px-1.5 py-0.5 gap-1",
      md: "text-sm px-2 py-0.5 gap-1.5",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium",
          "transition-all duration-200",
          sizeClasses[size],
          className
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${tag.color} 20%, transparent)`,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${tag.color} 40%, transparent)`,
          color: tag.color,
        }}
      >
        <span className="truncate max-w-[120px]">{tag.name}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "hover:bg-black/10 dark:hover:bg-white/10",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-1 focus:ring-current",
              size === "sm" ? "h-3 w-3" : "h-4 w-4"
            )}
            aria-label={`Remove ${tag.name} tag`}
          >
            <X className={size === "sm" ? "h-2 w-2" : "h-3 w-3"} />
          </button>
        )}
      </span>
    );
  }
);

TagBadge.displayName = "TagBadge";
