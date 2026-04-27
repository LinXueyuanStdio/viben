"use client";

import * as React from "react";
import { useState, useRef, useMemo, useContext, useEffect } from "react";
import { Button, cn } from "@viben/ui";
import { Ban, CircleSlash, Link, Copy, ChevronDown, Plus, Search } from "lucide-react";
import type { RelationshipType } from "./relationship-types";
import { RELATIONSHIP_CONFIG, RELATIONSHIP_TYPES } from "./relationship-types";

const ICON_MAP = {
  Ban,
  CircleSlash,
  Link,
  Copy,
} as const;

export interface RelationshipAddProps {
  availableTasks: Array<{ id: string; title: string }>;
  onAdd: (type: RelationshipType, targetTaskId: string) => void;
  disabled?: boolean;
}

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within a Popover provider");
  }
  return context;
}

function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, onClick, ...props }, ref) => {
  const { open, setOpen } = usePopoverContext();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setOpen(!open);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
      ref,
      onClick: handleClick,
      "aria-expanded": open,
      ...props,
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={handleClick}
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end" }
>(({ className, align = "start", children, ...props }, ref) => {
  const { open, setOpen } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        const trigger = contentRef.current.parentElement?.querySelector(
          "[aria-expanded]"
        );
        if (trigger && trigger.contains(e.target as Node)) return;
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={(node) => {
        (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "absolute z-50 min-w-[280px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        "top-full mt-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
PopoverContent.displayName = "PopoverContent";

export function RelationshipAdd({
  availableTasks,
  onAdd,
  disabled = false,
}: RelationshipAddProps) {
  const [selectedType, setSelectedType] = useState<RelationshipType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableTasks;
    }
    const query = searchQuery.toLowerCase();
    return availableTasks.filter((task) =>
      task.title.toLowerCase().includes(query)
    );
  }, [availableTasks, searchQuery]);

  const handleTypeSelect = (type: RelationshipType) => {
    setSelectedType(type);
    // Focus search input after type selection
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  const handleTaskSelect = (taskId: string) => {
    if (selectedType) {
      onAdd(selectedType, taskId);
      // Reset state
      setSelectedType(null);
      setSearchQuery("");
      setIsOpen(false);
    }
  };

  const handleBack = () => {
    setSelectedType(null);
    setSearchQuery("");
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setSelectedType(null);
      setSearchQuery("");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 justify-start text-left font-normal gap-1.5",
            "text-muted-foreground"
          )}
        >
          <Plus className="h-4 w-4" />
          <span>Add relation</span>
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        {selectedType === null ? (
          // Step 1: Select relationship type
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium px-2 py-1">
              Select type
            </p>
            {RELATIONSHIP_TYPES.map((type) => {
              const config = RELATIONSHIP_CONFIG[type];
              const Icon = ICON_MAP[config.icon as keyof typeof ICON_MAP];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    "transition-colors duration-150",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus:bg-accent"
                  )}
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: config.color }}
                  />
                  <span className="flex-1 text-left">{config.labelEn}</span>
                  <span className="text-xs text-muted-foreground">
                    {config.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          // Step 2: Search and select task
          <div className="space-y-2">
            {/* Header with back button */}
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={handleBack}
                className={cn(
                  "text-xs text-muted-foreground hover:text-foreground",
                  "transition-colors duration-150"
                )}
              >
                Back
              </button>
              <span className="text-xs text-muted-foreground">/</span>
              <span
                className="text-xs font-medium"
                style={{ color: RELATIONSHIP_CONFIG[selectedType].color }}
              >
                {RELATIONSHIP_CONFIG[selectedType].labelEn}
              </span>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className={cn(
                  "w-full rounded-md border bg-transparent pl-8 pr-2 py-1.5 text-sm",
                  "focus:outline-none focus:ring-1 focus:ring-ring"
                )}
              />
            </div>

            {/* Task list */}
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tasks found
                </p>
              ) : (
                filteredTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleTaskSelect(task.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                      "transition-colors duration-150",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:outline-none focus:bg-accent"
                    )}
                  >
                    <span className="flex-1 truncate text-left">{task.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

RelationshipAdd.displayName = "RelationshipAdd";
