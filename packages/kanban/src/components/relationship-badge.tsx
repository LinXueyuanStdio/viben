"use client";

import * as React from "react";
import { cn } from "@viben/ui";
import { Ban, CircleSlash, Link, Copy, X } from "lucide-react";
import type { TaskRelationship, RelationshipType } from "./relationship-types";
import { RELATIONSHIP_CONFIG } from "./relationship-types";

const ICON_MAP = {
  Ban,
  CircleSlash,
  Link,
  Copy,
} as const;

export interface RelationshipBadgeProps {
  relationship: TaskRelationship;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

function getIconComponent(type: RelationshipType) {
  const iconName = RELATIONSHIP_CONFIG[type].icon;
  return ICON_MAP[iconName as keyof typeof ICON_MAP];
}

export const RelationshipBadge = React.forwardRef<HTMLSpanElement, RelationshipBadgeProps>(
  ({ relationship, onClick, onRemove, className }, ref) => {
    const config = RELATIONSHIP_CONFIG[relationship.type];
    const Icon = getIconComponent(relationship.type);

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium",
          "text-xs px-2 py-0.5 gap-1.5",
          "transition-all duration-200",
          onClick && "cursor-pointer hover:opacity-80",
          className
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${config.color} 30%, transparent)`,
          color: config.color,
        }}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate max-w-[100px]">{relationship.targetTaskTitle}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-full",
              "h-3.5 w-3.5",
              "hover:bg-black/10 dark:hover:bg-white/10",
              "transition-colors duration-150",
              "focus:outline-none focus:ring-1 focus:ring-current"
            )}
            aria-label={`Remove relationship to ${relationship.targetTaskTitle}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </span>
    );
  }
);

RelationshipBadge.displayName = "RelationshipBadge";
