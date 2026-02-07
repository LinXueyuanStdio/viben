"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Command as CommandIcon } from "lucide-react";
import { Dialog, DialogContent, Input, cn } from "@viben/ui";
import { type Command, type CommandCategory, CATEGORY_LABELS } from "./command-types";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  placeholder?: string;
  /** Custom labels for i18n */
  labels?: {
    noResults?: string;
    navigation?: string;
    action?: string;
    view?: string;
    filter?: string;
  };
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder = "Search commands...",
  labels,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter((cmd) => {
      return (
        cmd.label.toLowerCase().includes(searchLower) ||
        cmd.description?.toLowerCase().includes(searchLower) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower))
      );
    });
  }, [commands, search]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};

    filteredCommands.forEach((cmd) => {
      const category = cmd.category || "action";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(cmd);
    });

    return groups;
  }, [filteredCommands]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onOpenChange(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  };

  const executeCommand = (cmd: Command) => {
    cmd.action();
    onOpenChange(false);
  };

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-12 border-0 focus-visible:ring-0 px-0"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
            <CommandIcon className="h-3 w-3" />K
          </kbd>
        </div>

        {/* Commands List */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              {labels?.noResults ?? "No matching commands"}
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => {
              // Get category label with i18n support
              const getCategoryLabel = (cat: string): string => {
                if (labels) {
                  const labelMap: Record<string, string | undefined> = {
                    navigation: labels.navigation,
                    action: labels.action,
                    view: labels.view,
                    filter: labels.filter,
                  };
                  if (labelMap[cat]) return labelMap[cat]!;
                }
                return CATEGORY_LABELS[cat as CommandCategory] || cat;
              };

              return (
              <div key={category} className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {getCategoryLabel(category)}
                </div>
                {cmds.map((cmd) => {
                  const index = flatIndex++;
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-left text-sm transition-all duration-150",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/80"
                      )}
                      onClick={() => executeCommand(cmd)}
                    >
                      {cmd.icon && (
                        <span className={cn(
                          "shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}>
                          {cmd.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0",
                          isSelected
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-muted border-border text-muted-foreground"
                        )}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );})
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

CommandPalette.displayName = "CommandPalette";
