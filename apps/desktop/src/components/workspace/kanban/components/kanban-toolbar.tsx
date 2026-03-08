/**
 * KanbanToolbar - Toolbar component for workspace kanban
 *
 * Provides filter, sort, and view controls for the kanban board.
 * Includes:
 * - Filter controls (search, status, priority, tags)
 * - Sort controls (mode selector, direction toggle)
 * - View controls (stats toggle, expand all, command palette, refresh)
 *
 * Responsive layout adapts to available width.
 */

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  BarChart3,
  Maximize2,
  Keyboard,
  RefreshCw,
  X,
  Filter,
  ChevronDown,
  Tag,
} from "lucide-react";
import {
  Button,
  Badge,
  Input,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@viben/ui";
import {
  SortModeSelect,
  countActiveFilters,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  type IssuePriority,
} from "@viben/kanban";
import type { KanbanFilter, SortMode, SortDirection, Tag as TagType } from "../types";

// ============================================
// Types
// ============================================

export interface KanbanToolbarProps {
  /** Current filter state */
  filter: KanbanFilter;
  /** Callback when filter changes */
  onFilterChange: (filter: KanbanFilter) => void;
  /** Available tags for filtering */
  availableTags: TagType[];
  /** Current sort mode */
  sortMode: SortMode;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Callback when sort changes */
  onSortChange: (mode: SortMode, direction: SortDirection) => void;
  /** Whether stats panel is visible */
  showStats: boolean;
  /** Callback to toggle stats panel */
  onToggleStats: () => void;
  /** Number of collapsed columns */
  collapsedCount: number;
  /** Callback to expand all columns */
  onExpandAll: () => void;
  /** Callback to open command palette */
  onOpenCommandPalette: () => void;
  /** Callback to refresh tasks */
  onRefresh: () => void;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
  /** Optional className for custom styling */
  className?: string;
}

// ============================================
// Component
// ============================================

/**
 * KanbanToolbar component
 *
 * Renders the filter/sort/view toolbar above the kanban board.
 * Responsive layout with flex-wrap for smaller screens.
 */
export const KanbanToolbar = memo(function KanbanToolbar({
  filter,
  onFilterChange,
  availableTags,
  sortMode,
  sortDirection,
  onSortChange,
  showStats,
  onToggleStats,
  collapsedCount,
  onExpandAll,
  onOpenCommandPalette,
  onRefresh,
  isRefreshing,
  className,
}: KanbanToolbarProps) {
  const { t } = useTranslation();
  const activeFilterCount = countActiveFilters(filter);

  // ----------------------------------------
  // Filter handlers
  // ----------------------------------------

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filter, search: e.target.value || undefined });
    },
    [filter, onFilterChange]
  );

  const handleClearSearch = useCallback(() => {
    onFilterChange({ ...filter, search: undefined });
  }, [filter, onFilterChange]);

  const handlePriorityToggle = useCallback(
    (priority: IssuePriority) => {
      const currentPriorities = filter.priorities || [];
      const newPriorities = currentPriorities.includes(priority)
        ? currentPriorities.filter((p) => p !== priority)
        : [...currentPriorities, priority];
      onFilterChange({
        ...filter,
        priorities: newPriorities.length > 0 ? newPriorities : undefined,
      });
    },
    [filter, onFilterChange]
  );

  const handleTagToggle = useCallback(
    (tagId: string) => {
      const currentTagIds = filter.tagIds || [];
      const newTagIds = currentTagIds.includes(tagId)
        ? currentTagIds.filter((id) => id !== tagId)
        : [...currentTagIds, tagId];
      onFilterChange({
        ...filter,
        tagIds: newTagIds.length > 0 ? newTagIds : undefined,
      });
    },
    [filter, onFilterChange]
  );

  const handleClearFilters = useCallback(() => {
    onFilterChange({});
  }, [onFilterChange]);

  // ----------------------------------------
  // Render
  // ----------------------------------------

  return (
    <div
      className={cn(
        "px-4 py-2 border-b bg-muted/30",
        className
      )}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* ========================================
         * Filter Controls Section
         * ======================================== */}
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("workspace.filter.searchPlaceholder", "Search...")}
              value={filter.search || ""}
              onChange={handleSearchChange}
              className="pl-9 pr-8 h-8"
            />
            {filter.search && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Priority Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {t("workspace.filter.priority", "Priority")}
                </span>
                {filter.priorities?.length ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {filter.priorities.length}
                  </Badge>
                ) : null}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>
                {t("workspace.filter.byPriority", "Filter by Priority")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PRIORITY_ORDER.map((priority) => {
                const config = PRIORITY_CONFIG[priority];
                const Icon = config.Icon;
                const isChecked = filter.priorities?.includes(priority) || false;
                return (
                  <DropdownMenuCheckboxItem
                    key={priority}
                    checked={isChecked}
                    onCheckedChange={() => handlePriorityToggle(priority)}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                      {t(`workspace.priority.${priority}`, config.label)}
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <Tag className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("workspace.filter.tags", "Tags")}
                  </span>
                  {filter.tagIds?.length ? (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {filter.tagIds.length}
                    </Badge>
                  ) : null}
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>
                  {t("workspace.filter.byTag", "Filter by Tag")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableTags.map((tag) => {
                  const isChecked = filter.tagIds?.includes(tag.id) || false;
                  return (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={isChecked}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Active Filter Count & Clear Button */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Filter className="h-3 w-3" />
                {activeFilterCount} {t("workspace.filter.active", "active")}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                {t("workspace.filter.clear", "Clear")}
              </Button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border hidden lg:block" />

        {/* ========================================
         * Sort Controls Section
         * ======================================== */}
        <SortModeSelect
          value={sortMode}
          direction={sortDirection}
          onChange={onSortChange}
        />

        {/* ========================================
         * View Controls Section
         * ======================================== */}

        {/* Stats Toggle */}
        <Button
          variant={showStats ? "secondary" : "ghost"}
          size="sm"
          className="h-8"
          onClick={onToggleStats}
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">
            {t("workspace.stats", "Stats")}
          </span>
        </Button>

        {/* Expand All Button - shown when 3+ columns are collapsed */}
        {collapsedCount >= 3 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={onExpandAll}
                >
                  <Maximize2 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">
                    {t("workspace.expandAll", "Expand All")}
                  </span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {collapsedCount}
                  </Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t("workspace.expandAllHint", "Expand all collapsed columns")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Keyboard Shortcuts Help */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={onOpenCommandPalette}
              >
                <Keyboard className="h-4 w-4" />
                <span className="ml-1 text-xs text-muted-foreground hidden md:inline">
                  {t("workspace.shortcut.cmdK", "Cmd/Ctrl + K")}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="text-xs space-y-1">
                <p className="font-medium">
                  {t("workspace.keyboardShortcuts", "Keyboard Shortcuts")}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                  <span>{t("workspace.commandPalette.arrowKeys", "Arrow keys")}</span>
                  <span>{t("workspace.shortcut.navigate", "Navigate")}</span>
                  <span>{t("workspace.commandPalette.enter", "Enter")}</span>
                  <span>{t("workspace.shortcut.open", "Open")}</span>
                  <span>{t("workspace.commandPalette.escape", "Escape")}</span>
                  <span>{t("workspace.shortcut.close", "Close")}</span>
                  <span>{t("workspace.shortcut.cmdK", "Cmd/Ctrl + K")}</span>
                  <span>{t("workspace.shortcut.command", "Commands")}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Refresh Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("common.refresh", "Refresh")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
});

KanbanToolbar.displayName = "KanbanToolbar";
