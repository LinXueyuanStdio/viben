"use client";

import * as React from "react";
import {
  cn,
  ScrollArea,
  Badge,
  Button,
  Skeleton,
} from "@viben/ui";
import * as Collapsible from "@radix-ui/react-collapsible";
import {
  ChevronRight,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
  Clock,
  Play,
  Square,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Log entry types for different log messages
 */
export type LogEntryType =
  | "tool_start"
  | "tool_end"
  | "error"
  | "success"
  | "info"
  | "text"
  | "warning";

/**
 * Individual log entry
 */
export interface LogEntry {
  id: string;
  type: LogEntryType;
  message: string;
  timestamp: string;
  details?: string;
  toolName?: string;
  duration?: number; // milliseconds
}

/**
 * Phase status for grouped logs
 */
export type PhaseStatus = "pending" | "running" | "complete" | "failed";

/**
 * Task log phase (group)
 */
export interface TaskLogPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  entries: LogEntry[];
  startTime?: string;
  endTime?: string;
}

/**
 * Complete task logs data
 */
export interface TaskLog {
  taskId: string;
  phases: TaskLogPhase[];
}

export interface TaskLogsTabProps {
  taskId: string;
  logs?: TaskLog | null;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  onRefresh?: () => void;
  autoScroll?: boolean;
}

/**
 * Get icon for log entry type
 */
function getLogIcon(type: LogEntryType) {
  switch (type) {
    case "tool_start":
      return <Play className="h-3.5 w-3.5 text-blue-500" />;
    case "tool_end":
      return <Square className="h-3.5 w-3.5 text-blue-500" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "success":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
    case "info":
      return <Info className="h-3.5 w-3.5 text-blue-400" />;
    case "text":
    default:
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

/**
 * Get status icon for phase
 */
function getPhaseStatusIcon(status: PhaseStatus) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "pending":
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * LogEntryItem - Single log entry display
 */
function LogEntryItem({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasDetails = !!entry.details;

  return (
    <div
      className={cn(
        "group flex items-start gap-2 py-1.5 px-2 rounded text-sm",
        "hover:bg-muted/50 transition-colors",
        entry.type === "error" && "bg-red-500/5",
        entry.type === "success" && "bg-green-500/5"
      )}
    >
      <div className="shrink-0 mt-0.5">{getLogIcon(entry.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {entry.toolName && (
              <Badge variant="outline" className="text-xs font-mono mr-2 py-0">
                {entry.toolName}
              </Badge>
            )}
            <span
              className={cn(
                "break-words",
                entry.type === "error" && "text-red-600 dark:text-red-400"
              )}
            >
              {entry.message}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {entry.duration !== undefined && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(entry.duration)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>
        </div>
        {hasDetails && (
          <Collapsible.Root open={isExpanded} onOpenChange={onToggle}>
            <Collapsible.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 mt-1 text-xs text-muted-foreground"
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 mr-1 transition-transform",
                    isExpanded && "rotate-90"
                  )}
                />
                {isExpanded ? "Hide details" : "Show details"}
              </Button>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <pre className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {entry.details}
              </pre>
            </Collapsible.Content>
          </Collapsible.Root>
        )}
      </div>
    </div>
  );
}

/**
 * PhaseSection - Collapsible phase group
 */
function PhaseSection({
  phase,
  defaultOpen = true,
}: {
  phase: TaskLogPhase;
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [expandedEntries, setExpandedEntries] = React.useState<Set<string>>(new Set());

  const toggleEntry = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const phaseLabels: Record<string, string> = {
    planning: t("workspace.logsTab.planning", "Planning"),
    coding: t("workspace.logsTab.coding", "Coding"),
    validation: t("workspace.logsTab.validation", "Validation"),
  };

  const statusLabels: Record<PhaseStatus, string> = {
    pending: t("workspace.logsTab.pending", "Pending"),
    running: t("workspace.logsTab.running", "Running"),
    complete: t("workspace.logsTab.complete", "Complete"),
    failed: t("workspace.logsTab.failed", "Failed"),
  };

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
      <Collapsible.Trigger asChild>
        <div
          className={cn(
            "flex items-center justify-between p-3 rounded-lg cursor-pointer",
            "bg-muted/30 hover:bg-muted/50 transition-colors"
          )}
        >
          <div className="flex items-center gap-3">
            {getPhaseStatusIcon(phase.status)}
            <span className="font-medium">
              {phaseLabels[phase.name.toLowerCase()] || phase.name}
            </span>
            <Badge variant="secondary" className="text-xs">
              {phase.entries.length}{" "}
              {t("workspace.logsTab.entries", "entries", { count: phase.entries.length })}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={phase.status === "failed" ? "destructive" : "outline"}
              className="text-xs"
            >
              {statusLabels[phase.status]}
            </Badge>
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </div>
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="mt-2 ml-2 border-l-2 border-muted pl-3 space-y-0.5">
          {phase.entries.map((entry) => (
            <LogEntryItem
              key={entry.id}
              entry={entry}
              isExpanded={expandedEntries.has(entry.id)}
              onToggle={() => toggleEntry(entry.id)}
            />
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/**
 * TaskLogsTab - Displays execution logs grouped by phase
 *
 * Features:
 * - Logs grouped by phase (Planning, Coding, Validation)
 * - Collapsible phase sections
 * - Different icons/colors for log types
 * - Expandable details for each log entry
 * - Auto-scroll to latest logs
 */
export function TaskLogsTab({
  taskId: _taskId,
  logs,
  isLoading = false,
  error,
  className,
  onRefresh,
  autoScroll = true,
}: TaskLogsTabProps) {
  void _taskId; // Reserved for future use
  const { t } = useTranslation();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  React.useEffect(() => {
    if (autoScroll && scrollRef.current && logs?.phases.length) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs?.phases, autoScroll]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("p-4 space-y-4", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="ml-5 space-y-1">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <Terminal className="h-12 w-12 text-destructive/30 mb-4" />
        <h3 className="text-lg font-medium text-destructive mb-2">
          {t("workspace.logsTab.loadError", "Failed to load logs")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs mb-4">
          {error}
        </p>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            {t("common.retry", "Retry")}
          </Button>
        )}
      </div>
    );
  }

  // Empty state - No logs yet
  if (!logs || logs.phases.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-12", className)}>
        <Terminal className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {t("workspace.logsTab.noLogs", "No logs yet")}
        </h3>
        <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
          {t(
            "workspace.logsTab.logsWillAppear",
            "Logs will appear here when the task runs"
          )}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)} ref={scrollRef}>
      <div className="p-4 space-y-3">
        {logs.phases.map((phase, index) => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            defaultOpen={index === logs.phases.length - 1 || phase.status === "running"}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
