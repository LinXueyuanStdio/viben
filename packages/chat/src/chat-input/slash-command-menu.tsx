/**
 * Slash Command Menu Component
 *
 * Autocomplete menu for slash commands that appears above the textarea.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import type { SlashCommand } from "../types";

export interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
  isOpen: boolean;
  query: string;
  className?: string;
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
  onHover,
  isOpen,
  query,
  className,
}: SlashCommandMenuProps) {
  const { t } = useTranslation();
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  React.useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const selectedElement = menuRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) {
    return null;
  }

  // No commands found
  if (commands.length === 0 && query) {
    return (
      <div
        className={cn(
          "absolute left-3 right-3 bottom-full mb-1 z-[100] rounded-lg border border-border bg-popover shadow-lg p-3",
          className
        )}
      >
        <div className="text-sm text-muted-foreground text-center">
          {t("chat.noCommandsFound", "No commands found")}
        </div>
      </div>
    );
  }

  // Commands list
  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute left-3 right-3 bottom-full mb-1 z-[100] rounded-lg border border-border bg-popover shadow-lg overflow-hidden",
        className
      )}
    >
      <div className="py-1 max-h-64 overflow-y-auto">
        {commands.map((command, index) => (
          <button
            key={command.id}
            type="button"
            data-index={index}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-muted/50"
            )}
            onClick={() => onSelect(command)}
            onMouseEnter={() => onHover(index)}
          >
            {command.icon && (
              <span className="shrink-0 text-muted-foreground">
                {command.icon}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium">/{command.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {command.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
