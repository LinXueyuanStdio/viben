"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import { PRIORITY_CONFIG, type IssuePriority } from "./priority-config";

export interface PriorityIconProps {
  priority: IssuePriority;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    iconClass: "h-3 w-3",
    textClass: "text-xs",
    gap: "gap-1",
  },
  md: {
    iconClass: "h-4 w-4",
    textClass: "text-sm",
    gap: "gap-1.5",
  },
  lg: {
    iconClass: "h-5 w-5",
    textClass: "text-base",
    gap: "gap-2",
  },
};

export function PriorityIcon({
  priority,
  size = "md",
  showLabel = false,
  className,
}: PriorityIconProps) {
  const { t } = useTranslation();
  const config = PRIORITY_CONFIG[priority];

  // Guard against invalid priority values
  if (!config) {
    return null;
  }

  const sizeStyles = sizeConfig[size];
  const Icon = config.Icon;

  return (
    <span
      className={cn(
        "inline-flex items-center",
        "transition-all duration-200 ease-out",
        sizeStyles.gap,
        className
      )}
    >
      <Icon
        className={cn(sizeStyles.iconClass, "shrink-0")}
        style={{ color: config.color }}
      />
      {showLabel && (
        <span className={cn(sizeStyles.textClass)} style={{ color: config.color }}>
          {t(config.labelKey)}
        </span>
      )}
    </span>
  );
}

PriorityIcon.displayName = "PriorityIcon";
