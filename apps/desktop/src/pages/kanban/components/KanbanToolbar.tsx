import {
  BarChart3,
  Keyboard,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@viben/ui";
import {
  KanbanFilterBar,
  SortModeSelect,
} from "@viben/kanban";
import type { UseKanbanBoardReturn } from "../hooks/useKanbanBoard";

interface KanbanToolbarProps {
  board: UseKanbanBoardReturn;
}

export function KanbanToolbar({ board }: KanbanToolbarProps) {
  const {
    t,
    filter,
    setFilter,
    sortMode,
    sortDirection,
    showStats,
    setShowStats,
    collapsedCount,
    expandAll,
    isFetchingTasks,
    handleSortChange,
    handleRefresh,
    setIsCommandPaletteOpen,
  } = board;

  return (
    <div className="px-4 py-2 border-b bg-muted/30">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Filter Bar */}
        <KanbanFilterBar
          filter={filter}
          onChange={setFilter}
          availableTags={[]}
          className="flex-1"
        />

        {/* Separator */}
        <div className="h-6 w-px bg-border" />

        {/* Sort Controls */}
        <SortModeSelect
          value={sortMode}
          direction={sortDirection}
          onChange={handleSortChange}
        />

        {/* Stats Toggle */}
        <Button
          variant={showStats ? "secondary" : "ghost"}
          size="sm"
          className="h-8"
          onClick={() => setShowStats((s) => !s)}
        >
          <BarChart3 className="h-4 w-4 mr-1" />
          {t("workspace.stats")}
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
                  onClick={expandAll}
                >
                  <Maximize2 className="h-4 w-4 mr-1" />
                  {t("workspace.expandAll", "Expand All")}
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
                onClick={() => setIsCommandPaletteOpen(true)}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="text-xs space-y-1">
                <p className="font-medium">{t("workspace.keyboardShortcuts")}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                  <span>{t("workspace.commandPalette.arrowKeys")}</span>
                  <span>{t("workspace.shortcut.navigate")}</span>
                  <span>{t("workspace.commandPalette.enter")}</span>
                  <span>{t("workspace.shortcut.open")}</span>
                  <span>{t("workspace.commandPalette.escape")}</span>
                  <span>{t("workspace.shortcut.close")}</span>
                  <span>{t("workspace.shortcut.cmdK", "Cmd/Ctrl + K")}</span>
                  <span>{t("workspace.shortcut.command")}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={handleRefresh}
          disabled={isFetchingTasks}
        >
          <RefreshCw
            className={cn("h-4 w-4", isFetchingTasks && "animate-spin")}
          />
        </Button>
      </div>
    </div>
  );
}
