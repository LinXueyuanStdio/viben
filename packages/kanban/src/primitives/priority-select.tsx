"use client";

import * as React from "react";
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
}

const triggerSizeConfig = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-9 px-4 text-base",
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
}: PrioritySelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedConfig = value ? PRIORITY_CONFIG[value] : null;

  const handleSelect = React.useCallback(
    (priority: IssuePriority) => {
      onValueChange?.(priority);
      setOpen(false);
    },
    [onValueChange]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-between gap-2",
            "border border-transparent",
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
      <DropdownMenuContent align="start" className={cn("min-w-[140px]", className)}>
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Set priority
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRIORITY_ORDER.map((priority) => {
          const config = PRIORITY_CONFIG[priority];
          const isSelected = value === priority;

          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => handleSelect(priority)}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                "transition-colors duration-150",
                isSelected && "bg-accent"
              )}
            >
              <PriorityIcon priority={priority} size="sm" showLabel />
              {isSelected && (
                <Check className="ml-auto h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

PrioritySelect.displayName = "PrioritySelect";
