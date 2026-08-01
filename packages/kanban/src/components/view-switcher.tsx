"use client";

import * as React from "react";
import { cn, Button } from "@viben/ui";
import { LayoutGrid, List, Table2 } from "lucide-react";
import type { ViewMode } from "./view-types";

export interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  /** Custom labels for i18n */
  labels?: {
    kanban?: string;
    list?: string;
    table?: string;
  };
}

export function ViewSwitcher({ value, onChange, className, labels }: ViewSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg bg-muted p-1",
        "transition-all duration-200",
        className
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 px-3 gap-1.5",
          "transition-all duration-200",
          value === "kanban"
            ? "bg-background shadow-sm hover:bg-background"
            : "hover:bg-transparent"
        )}
        onClick={() => onChange("kanban")}
        aria-pressed={value === "kanban"}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="text-sm">{labels?.kanban ?? "Kanban"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 px-3 gap-1.5",
          "transition-all duration-200",
          value === "list"
            ? "bg-background shadow-sm hover:bg-background"
            : "hover:bg-transparent"
        )}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <List className="h-3.5 w-3.5" />
        <span className="text-sm">{labels?.list ?? "List"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 px-3 gap-1.5",
          "transition-all duration-200",
          value === "table"
            ? "bg-background shadow-sm hover:bg-background"
            : "hover:bg-transparent"
        )}
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
      >
        <Table2 className="h-3.5 w-3.5" />
        <span className="text-sm">{labels?.table ?? "Table"}</span>
      </Button>
    </div>
  );
}

ViewSwitcher.displayName = "ViewSwitcher";
