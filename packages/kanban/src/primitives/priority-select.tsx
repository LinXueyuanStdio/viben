"use client";

import { useState, useCallback, useEffect } from "react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Button,
} from "@viben/ui";
import { Check, ChevronDown } from "lucide-react";
import {
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  type IssuePriority,
} from "./priority-config";
import { PriorityIcon } from "./priority-icon";

export interface PrioritySelectProps {
  value?: IssuePriority;
  onValueChange?: (value: IssuePriority) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  /** Show keyboard shortcut hints */
  showShortcuts?: boolean;
  /** Custom labels for priorities (for i18n) */
  labels?: {
    setPriority?: string;
    urgent?: string;
    high?: string;
    medium?: string;
    low?: string;
    none?: string;
  };
}

const triggerSizeConfig = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-9 px-4 text-base",
};

// Keyboard shortcuts for quick priority selection
const PRIORITY_SHORTCUTS: Record<IssuePriority, string> = {
  urgent: "1",
  high: "2",
  medium: "3",
  low: "4",
  none: "0",
};

// Priority label lookup with i18n support
const getPriorityLabel = (
  priority: IssuePriority,
  labels?: PrioritySelectProps["labels"]
): string => {
  if (labels) {
    const labelMap: Record<IssuePriority, string | undefined> = {
      urgent: labels.urgent,
      high: labels.high,
      medium: labels.medium,
      low: labels.low,
      none: labels.none,
    };
    if (labelMap[priority]) return labelMap[priority]!;
  }
  return PRIORITY_CONFIG[priority].label;
};

export function PrioritySelect({
  value,
  onValueChange,
  disabled = false,
  className,
  triggerClassName,
  placeholder = "Priority",
  showLabel = true,
  size = "md",
  showShortcuts = false,
  labels,
}: PrioritySelectProps) {
  const [open, setOpen] = useState(false);

  const selectedConfig = value ? PRIORITY_CONFIG[value] : null;

  const handleSelect = useCallback(
    (priority: IssuePriority) => {
      onValueChange?.(priority);
      setOpen(false);
    },
    [onValueChange]
  );

  // Handle keyboard shortcuts when dropdown is open
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const priority = PRIORITY_ORDER.find(
        (p) => PRIORITY_SHORTCUTS[p] === e.key
      );
      if (priority) {
        e.preventDefault();
        handleSelect(priority);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleSelect]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-between gap-2",
            "border border-transparent rounded-md",
            "transition-all duration-200 ease-out",
            "hover:border-border hover:bg-accent/50",
            "focus-visible:ring-1 focus-visible:ring-ring",
            triggerSizeConfig[size],
            triggerClassName
          )}
        >
          {selectedConfig ? (
            <PriorityIcon
              priority={value!}
              size={size === "lg" ? "md" : "sm"}
              showLabel={showLabel}
            />
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground",
              "transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("min-w-[160px]", className)}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2">
          {labels?.setPriority ?? "Set priority"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRIORITY_ORDER.map((priority) => {
          const config = PRIORITY_CONFIG[priority];
          const isSelected = value === priority;
          const label = getPriorityLabel(priority, labels);

          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => handleSelect(priority)}
              className={cn(
                "flex items-center gap-2.5 cursor-pointer py-2 px-2",
                "transition-colors duration-150",
                isSelected && "bg-accent"
              )}
            >
              {/* Priority icon with colored background pill */}
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded"
                style={{
                  backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
                }}
              >
                <config.Icon
                  className="h-3.5 w-3.5"
                  style={{ color: config.color }}
                />
              </span>
              <span className="flex-1 text-sm">{label}</span>
              {showShortcuts && (
                <DropdownMenuShortcut className="text-[10px] opacity-60">
                  {PRIORITY_SHORTCUTS[priority]}
                </DropdownMenuShortcut>
              )}
              {isSelected && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

PrioritySelect.displayName = "PrioritySelect";
