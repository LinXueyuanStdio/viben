"use client";

import * as React from "react";
import {
  GripVertical,
  Signal,
  Calendar,
  Clock,
  RefreshCw,
  ArrowDownAZ,
  ArrowUp,
  ArrowDown,
  ChevronDown,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@viben/ui";
import { SORT_OPTIONS, type SortMode, type SortDirection } from "./sort-types";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  GripVertical,
  Signal,
  Calendar,
  Clock,
  RefreshCw,
  ArrowDownAZ,
};

export interface SortModeSelectProps {
  value: SortMode;
  direction: SortDirection;
  onChange: (mode: SortMode, direction: SortDirection) => void;
  className?: string;
}

export function SortModeSelect({
  value,
  direction,
  onChange,
  className,
}: SortModeSelectProps) {
  const currentOption = SORT_OPTIONS.find((o) => o.value === value);
  const Icon = currentOption ? ICONS[currentOption.icon] : GripVertical;

  const handleModeChange = (mode: SortMode) => {
    // If selecting the same mode, toggle direction; otherwise use default direction
    if (mode === value) {
      onChange(mode, direction === "asc" ? "desc" : "asc");
    } else {
      // Default direction
      const defaultDir: SortDirection = mode === "title" ? "asc" : "desc";
      onChange(mode, defaultDir);
    }
  };

  const toggleDirection = () => {
    onChange(value, direction === "asc" ? "desc" : "asc");
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentOption?.label}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {SORT_OPTIONS.map((option) => {
            const OptionIcon = ICONS[option.icon];
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleModeChange(option.value)}
                className={cn(value === option.value && "bg-accent")}
              >
                <OptionIcon className="h-4 w-4 mr-2" />
                {option.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={toggleDirection}
        title={direction === "asc" ? "升序" : "降序"}
      >
        {direction === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

SortModeSelect.displayName = "SortModeSelect";
