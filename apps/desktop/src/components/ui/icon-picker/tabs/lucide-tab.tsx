/**
 * LucideTab — Full Lucide icon browser
 *
 * Features:
 * - 1500+ icons via async dynamic imports
 * - Keyword search with debounced filtering
 * - Category grouping with quick-jump navigation
 * - Virtual scrolling via @tanstack/react-virtual
 */

import { useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useLucideIcons } from "../hooks/use-lucide-icons";
import { LUCIDE_ICON_MAP } from "../constants";
import { DynamicLucideIcon } from "../dynamic-lucide-icon";
import type { VirtualRow } from "../types";

const HEADER_HEIGHT = 28;
const ROW_HEIGHT = 36;

export interface LucideTabProps {
  value?: string;
  onSelect: (iconName: string) => void;
}

export function LucideTab({ value, onSelect }: LucideTabProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    virtualRows,
    isSearching,
    getIcon,
    requestLoad,
    search,
    setSearch,
    categoryGroups,
    categoryRowIndex,
  } = useLucideIcons();

  // Virtual scroll setup
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      virtualRows[index].type === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
    overscan: 2,
  });

  // Preload icons for visible rows
  const visibleItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const names: string[] = [];
    for (const item of visibleItems) {
      const row = virtualRows[item.index];
      if (row.type === "icons") {
        names.push(...row.names);
      }
    }
    if (names.length > 0) {
      requestLoad(names);
    }
  }, [visibleItems, virtualRows, requestLoad]);

  // Scroll to category
  const scrollToCategory = useCallback(
    (categoryId: string) => {
      const rowIndex = categoryRowIndex.get(categoryId);
      if (rowIndex !== undefined) {
        virtualizer.scrollToIndex(rowIndex, { align: "start" });
      }
    },
    [categoryRowIndex, virtualizer]
  );

  // Render a single icon cell
  const renderIcon = (iconName: string) => {
    const isSelected = value === iconName;
    const StaticIcon = LUCIDE_ICON_MAP[iconName];

    return (
      <button
        key={iconName}
        type="button"
        onClick={() => onSelect(iconName)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-primary/10 text-primary ring-1 ring-primary/30"
        )}
        title={iconName}
      >
        {StaticIcon ? (
          <StaticIcon className="h-4 w-4" />
        ) : (
          <DynamicLucideIcon name={iconName} size={16} />
        )}
      </button>
    );
  };

  // Render a virtual row
  const renderRow = (row: VirtualRow) => {
    if (row.type === "header") {
      return (
        <div className="flex items-center h-7 px-2 text-xs font-medium text-muted-foreground">
          {t(row.label, row.categoryId)}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-8 gap-0.5 px-2">
        {row.names.map(renderIcon)}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Search input */}
      <div className="relative px-2 pt-2 pb-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground mt-0.5" />
        <Input
          placeholder={t("iconPicker.searchIcons", "Search icons...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Category quick-jump bar (hidden during search) */}
      {!isSearching && (
        <div className="flex gap-0.5 px-2 py-1 overflow-x-auto border-b border-border">
          {categoryGroups.map((group) => {
            const firstIconName = group.icons[0];
            const FirstIcon = LUCIDE_ICON_MAP[firstIconName];
            return (
              <button
                key={group.id}
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => scrollToCategory(group.id)}
                title={t(group.labelKey, group.id)}
              >
                {FirstIcon ? (
                  <FirstIcon className="h-3.5 w-3.5" />
                ) : (
                  <DynamicLucideIcon name={firstIconName} size={14} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Virtual scroll area */}
      <div ref={scrollRef} className="h-[280px] overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderRow(virtualRows[virtualItem.index])}
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {isSearching && virtualRows.length === 0 && (
        <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
          {t("iconPicker.noResults", "No icons found")}
        </div>
      )}
    </div>
  );
}

export default LucideTab;
