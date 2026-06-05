/**
 * Slash Command Menu Component
 *
 * Telegram-style autocomplete menu for slash commands.
 * - Appears directly above the input with no gap
 * - Bottom corners not rounded (connects seamlessly to input)
 * - Initially shows compact height (~4 items)
 * - Expands when user scrolls up to see more commands
 * - Search query highlighting in command names
 * - Keyboard shortcut hints
 */

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import type { SlashCommand } from "../types";

/** Height of a single command item in pixels */
const ITEM_HEIGHT = 52;
/** Number of items to show initially (compact mode) */
const INITIAL_VISIBLE_ITEMS = 4;
/** Maximum number of items to show when expanded */
const MAX_VISIBLE_ITEMS = 8;
/** Height of the keyboard hints footer */
const FOOTER_HEIGHT = 32;

export interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
  isOpen: boolean;
  query: string;
  className?: string;
  /** Reference to the container element for positioning */
  anchorRef?: React.RefObject<HTMLElement>;
}

/**
 * Highlight matching text in a string
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) {
    return <>{text}</>;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return <>{text}</>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <span className="text-primary font-semibold">{match}</span>
      {after}
    </>
  );
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
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset expanded state when menu closes or commands change
  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false);
    }
  }, [isOpen]);

  // Handle scroll to expand menu (Telegram-style)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    // Expand when user scrolls up (trying to see more items)
    if (container.scrollTop > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;

    const selectedElement = scrollContainerRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen]);

  // Expand when navigating with keyboard to items outside initial view
  useEffect(() => {
    if (selectedIndex >= INITIAL_VISIBLE_ITEMS && !isExpanded) {
      setIsExpanded(true);
    }
  }, [selectedIndex, isExpanded]);

  if (!isOpen) {
    return null;
  }

  // Calculate visible items and height
  const visibleItemCount = isExpanded ? MAX_VISIBLE_ITEMS : INITIAL_VISIBLE_ITEMS;
  const itemsHeight = Math.min(commands.length, visibleItemCount) * ITEM_HEIGHT + 8; // +8 for padding
  const maxHeight = itemsHeight + FOOTER_HEIGHT;

  return (
    <div
      ref={menuRef}
      className={cn(
        // Telegram style: top corners rounded, bottom corners flat (connects to input)
        "rounded-t-lg rounded-b-none border border-b-0 border-border bg-popover overflow-hidden",
        "absolute left-0 right-0 bottom-full z-[9999]",
        // Smooth height transition
        "transition-[max-height] duration-200 ease-out",
        className
      )}
      style={{
        // Shadow on top and sides only (no bottom shadow for seamless connection)
        boxShadow: '0 -4px 6px -1px rgb(0 0 0 / 0.1), -4px 0 6px -1px rgb(0 0 0 / 0.1), 4px 0 6px -1px rgb(0 0 0 / 0.1)',
        maxHeight: `${maxHeight}px`,
      }}
    >
      {commands.length === 0 && query ? (
        <div className="p-3">
          <div className="text-sm text-muted-foreground text-center">
            {t("chat.noCommandsFound", "No commands found")}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={scrollContainerRef}
            className="py-1 overflow-y-auto"
            style={{ maxHeight: `${itemsHeight - 8}px` }}
            onScroll={handleScroll}
          >
            {commands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                data-index={index}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                  command.disabled && "cursor-not-allowed opacity-50",
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                )}
                disabled={command.disabled}
                onClick={() => {
                  if (!command.disabled) onSelect(command);
                }}
                onMouseEnter={() => onHover(index)}
              >
                {command.icon && (
                  <span className="shrink-0 text-muted-foreground">
                    {command.icon}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">
                    /<HighlightedText text={command.name} query={query} />
                  </div>
                  {command.description && (
                    <div className="truncate text-xs text-muted-foreground">
                      <HighlightedText text={command.description} query={query} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          {/* Keyboard shortcuts hint */}
          <div className="flex items-center justify-center gap-4 px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↓</kbd>
              <span>{t("chat.slashMenu.navigate", "navigate")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↵</kbd>
              <span>{t("chat.slashMenu.select", "select")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">esc</kbd>
              <span>{t("chat.slashMenu.close", "close")}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
