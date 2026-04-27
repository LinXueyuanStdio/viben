"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, Command as CommandIcon, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, Input, cn } from "@viben/ui";
import { useTranslation } from "react-i18next";
import { type Command, type CommandCategory, CATEGORY_LABEL_KEYS } from "./command-types";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  placeholder?: string;
  /** Show loading state */
  loading?: boolean;
  /** Custom labels for i18n */
  labels?: {
    noResults?: string;
    navigation?: string;
    action?: string;
    view?: string;
    filter?: string;
    sort?: string;
    settings?: string;
    resultsCount?: string; // e.g., "{{count}} commands"
    // Footer hints
    navigate?: string;
    select?: string;
    close?: string;
  };
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder,
  loading = false,
  labels,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("kanban.commandPalette.searchPlaceholder");
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      const item = selectedItemRef.current;
      const container = listRef.current;
      const itemRect = item.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (itemRect.bottom > containerRect.bottom) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (itemRect.top < containerRect.top) {
        item.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearch("");
    inputRef.current?.focus();
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        if (search) {
          // First Escape clears search, second closes dialog
          setSearch("");
        } else {
          onOpenChange(false);
        }
        break;
      case "Tab":
        // Prevent tab from leaving the dialog
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex((i) => Math.max(i - 1, 0));
        } else {
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        }
        break;
    }
  }, [filteredCommands, selectedIndex, onOpenChange, search]);

  const executeCommand = (cmd: Command) => {
    cmd.action();
    onOpenChange(false);
  };

  let flatIndex = 0;

  // Results count text
  const resultsCountText = useMemo(() => {
    if (!search.trim()) return null;
    const count = filteredCommands.length;
    if (labels?.resultsCount) {
      return labels.resultsCount.replace("{{count}}", String(count));
    }
    return t("kanban.commandPalette.resultsCount", { count });
  }, [search, filteredCommands.length, labels?.resultsCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {loading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={resolvedPlaceholder}
            className="h-12 border-0 focus-visible:ring-0 px-0 bg-transparent"
            autoFocus
          />
          {/* Results count */}
          {resultsCountText && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {resultsCountText}
            </span>
          )}
          {/* Clear button */}
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className={cn(
                "shrink-0 p-1 rounded-md",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/80 transition-colors"
              )}
              aria-label={t("kanban.commandPalette.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded shrink-0">
            <CommandIcon className="h-3 w-3" />K
          </kbd>
        </div>

        {/* Commands List */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              {labels?.noResults ?? t("kanban.commandPalette.noResults")}
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
                    sort: labels.sort,
                    settings: labels.settings,
                  };
                  if (labelMap[cat]) return labelMap[cat]!;
                }
                const key = CATEGORY_LABEL_KEYS[cat as CommandCategory];
                return key ? t(key) : cat;
              };

              return (
              <div key={category} className="mb-3 last:mb-0">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                  {getCategoryLabel(category)}
                </div>
                {cmds.map((cmd) => {
                  const index = flatIndex++;
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      ref={isSelected ? selectedItemRef : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-left text-sm transition-all duration-150",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        isSelected
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "hover:bg-muted/80"
                      )}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      {cmd.icon && (
                        <span className={cn(
                          "shrink-0 transition-colors",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}>
                          {cmd.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div className={cn(
                            "text-xs truncate mt-0.5 transition-colors",
                            isSelected ? "text-primary/70" : "text-muted-foreground"
                          )}>
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 transition-colors",
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

        {/* Footer with keyboard hints */}
        {filteredCommands.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border">↑</kbd>
                <kbd className="px-1 py-0.5 rounded bg-muted border border-border">↓</kbd>
                <span className="ml-1">{labels?.navigate ?? t("kanban.commandPalette.navigate")}</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border">↵</kbd>
                <span className="ml-1">{labels?.select ?? t("kanban.commandPalette.select")}</span>
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border">esc</kbd>
              <span className="ml-1">{labels?.close ?? t("kanban.commandPalette.close")}</span>
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

CommandPalette.displayName = "CommandPalette";
