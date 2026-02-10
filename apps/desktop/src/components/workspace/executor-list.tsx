/**
 * Executor List Component
 *
 * Displays a list of detected executors in the workspace.
 * Used in the workspace chat page's left sidebar.
 */

import { useTranslation } from "react-i18next";
import {
  Terminal,
  Bot,
  MoreHorizontal,
  Settings,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Executor, ExecutorType } from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface ExecutorListProps {
  /** List of executors to display */
  executors: Executor[];
  /** Currently selected executor ID */
  selectedExecutorId: string | null;
  /** Called when an executor is selected */
  onSelect: (executor: Executor) => void;
  /** Called when executor settings are requested */
  onSettings?: (executor: Executor) => void;
  /** Called when refresh is requested */
  onRefresh?: () => void;
  /** Whether executors are loading */
  isLoading?: boolean;
  /** Show header with title and refresh button */
  showHeader?: boolean;
  /** Additional className */
  className?: string;
}

export interface ExecutorListItemProps {
  /** The executor to display */
  executor: Executor;
  /** Whether this executor is selected */
  isSelected: boolean;
  /** Number of sessions for this executor */
  sessionCount?: number;
  /** Called when the executor is clicked */
  onSelect: () => void;
  /** Called when settings are clicked */
  onSettings?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get gradient colors for executor avatar based on type
 */
function getExecutorGradient(type: ExecutorType): string {
  const gradients: Record<ExecutorType, string> = {
    "claude-code": "from-amber-500 to-orange-400",
    codex: "from-green-500 to-emerald-400",
    cursor: "from-purple-500 to-violet-400",
    windsurf: "from-blue-500 to-cyan-400",
    vscode: "from-sky-500 to-blue-400",
    continue: "from-pink-500 to-rose-400",
    zed: "from-yellow-500 to-amber-400",
    unknown: "from-gray-500 to-slate-400",
  };
  return gradients[type] || gradients.unknown;
}

/**
 * Get display name for executor type
 */
function getExecutorDisplayName(type: ExecutorType): string {
  const names: Record<ExecutorType, string> = {
    "claude-code": "Claude Code",
    codex: "Codex",
    cursor: "Cursor",
    windsurf: "Windsurf",
    vscode: "VS Code",
    continue: "Continue",
    zed: "Zed",
    unknown: "Unknown",
  };
  return names[type] || type;
}

/**
 * Get icon for executor type
 */
function ExecutorIcon({ className }: { type?: ExecutorType; className?: string }) {
  // For now, use Terminal for all executors
  // Could be expanded to use specific icons per type
  return <Terminal className={className} />;
}

// ============================================================================
// Executor List Item Component
// ============================================================================

function ExecutorListItem({
  executor,
  isSelected,
  sessionCount = 0,
  onSelect,
  onSettings,
}: ExecutorListItemProps) {
  const { t } = useTranslation();

  const displayName = executor.name || getExecutorDisplayName(executor.type);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all rounded-lg",
        isSelected ? "bg-accent" : "hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
          getExecutorGradient(executor.type)
        )}
      >
        <ExecutorIcon type={executor.type} className="h-5 w-5 text-white" />
        {/* Online indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{displayName}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {sessionCount > 0
            ? t("executor.sessionCount", "{{count}} sessions", { count: sessionCount })
            : t("executor.noSessions", "No sessions")}
        </p>
      </div>

      {/* Hover actions */}
      {onSettings && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            "bg-background/80 backdrop-blur-sm rounded-md px-1 py-0.5"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onSettings}>
                <Settings className="h-4 w-4 mr-2" />
                {t("executor.settings", "Executor Settings")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
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
            <p className="text-xs">{t("executor.noExecutors", "No executors detected")}</p>
          </div>
        ) : (
          executors.map((executor) => (
            <ExecutorListItem
              key={executor.id}
              executor={executor}
              isSelected={executor.id === selectedExecutorId}
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
            <RefreshCcw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
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
              <p className="text-sm">{t("executor.noExecutors", "No executors detected")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("executor.noExecutorsHint", "Executors will appear when detected in your workspace")}
              </p>
            </div>
          ) : (
            executors.map((executor) => (
              <ExecutorListItem
                key={executor.id}
                executor={executor}
                isSelected={executor.id === selectedExecutorId}
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

// Export helper for external use
export { getExecutorDisplayName, getExecutorGradient };
