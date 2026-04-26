/**
 * Executor List Component
 *
 * Displays a list of detected executors in the workspace.
 * Used in the workspace chat page's left sidebar.
 */

import { useTranslation } from "react-i18next";
import { Terminal, Bot, RefreshCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ExecutorListItem,
  getExecutorDisplayName,
  getExecutorGradient,
  type ExecutorItemData,
} from "@/pages/conversation/components/executor-list-item";
import type { ListItemSource } from "@/pages/conversation/components/list-item";

// ============================================================================
// Types
// ============================================================================

export interface ExecutorListProps {
  /** List of executors to display (ChatListItem or legacy Executor type) */
  executors: ExecutorItemData[];
  /** Currently selected executor ID */
  selectedExecutorId: string | null;
  /** Called when an executor is selected */
  onSelect: (executor: ExecutorItemData) => void;
  /** Called when executor settings are requested */
  onSettings?: (executor: ExecutorItemData) => void;
  /** Called when refresh is requested */
  onRefresh?: () => void;
  /** Whether executors are loading */
  isLoading?: boolean;
  /** Show header with title and refresh button */
  showHeader?: boolean;
  /** Source info for workspace badge */
  source?: ListItemSource;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Executor List Component
// ============================================================================

export function ExecutorList({
  executors,
  selectedExecutorId,
  onSelect,
  onSettings,
  onRefresh,
  isLoading,
  showHeader = false,
  source,
  className,
}: ExecutorListProps) {
  const { t } = useTranslation();

  // Inline list (no header, no scroll - used inside parent scroll)
  if (!showHeader) {
    return (
      <div className={cn("space-y-1", className)}>
        {isLoading && executors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2 opacity-50" />
            <p className="text-sm">{t("common.loading", "Loading...")}</p>
          </div>
        ) : executors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Terminal className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">
              {t("executor.noExecutors", "No executors detected")}
            </p>
          </div>
        ) : (
          executors.map((executor) => (
            <ExecutorListItem
              key={executor.id}
              executor={executor}
              isSelected={executor.id === selectedExecutorId}
              source={source}
              onSelect={() => onSelect(executor)}
              onSettings={onSettings ? () => onSettings(executor) : undefined}
            />
          ))
        )}
      </div>
    );
  }

  // Standalone component with header and scroll
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("executor.executors", "Executors")}
        </h3>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={isLoading}
            title={t("common.refresh", "Refresh")}
          >
            <RefreshCcw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
          </Button>
        )}
      </div>

      {/* Executor list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && executors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3 opacity-50" />
              <p className="text-sm">{t("common.loading", "Loading...")}</p>
            </div>
          ) : executors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">
                {t("executor.noExecutors", "No executors detected")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "executor.noExecutorsHint",
                  "Executors will appear when detected in your workspace"
                )}
              </p>
            </div>
          ) : (
            executors.map((executor) => (
              <ExecutorListItem
                key={executor.id}
                executor={executor}
                isSelected={executor.id === selectedExecutorId}
                source={source}
                onSelect={() => onSelect(executor)}
                onSettings={onSettings ? () => onSettings(executor) : undefined}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Re-export helpers for external use
export { getExecutorDisplayName, getExecutorGradient };
