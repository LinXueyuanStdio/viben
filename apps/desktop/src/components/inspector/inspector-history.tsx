/**
 * Inspector History Panel
 *
 * Displays MCP request/response history with expandable details.
 * Tracks method name, params, response, timestamp, duration, and status.
 */
import { useState, useMemo, useCallback } from "react";
import {
  History,
  ChevronDown,
  ChevronRight,
  Trash2,
  Info,
  Copy,
  Check,
  X,
  ChevronsUpDown,
  ChevronsDownUp,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { formatDuration } from "@/lib/utils";

/**
 * Single history entry representing an MCP request/response
 */
export interface HistoryEntry {
  /** Unique identifier */
  id: string;
  /** MCP method name (e.g., "tools/list", "tools/call") */
  method: string;
  /** Request parameters */
  params?: Record<string, unknown>;
  /** Response data */
  response?: unknown;
  /** Request timestamp */
  timestamp: Date;
  /** Request duration in milliseconds */
  duration: number;
  /** Request status */
  status: "success" | "error";
  /** Error message (if status is error) */
  error?: string;
}

interface HistoryPanelProps {
  /** Array of history entries */
  history: HistoryEntry[];
  /** Callback to clear all history */
  onClearHistory: () => void;
  /** Callback to remove a single entry */
  onRemoveEntry?: (id: string) => void;
}

/** Maximum entries to display (for performance) */
const MAX_DISPLAY_ENTRIES = 100;

type HistoryFilterType = "all" | "success" | "error";

export function HistoryPanel({
  history,
  onClearHistory,
  onRemoveEntry,
}: HistoryPanelProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<HistoryFilterType>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter and count entries
  const { filteredHistory, counts } = useMemo(() => {
    // Limit to last MAX_DISPLAY_ENTRIES for performance
    const limitedHistory = history.slice(-MAX_DISPLAY_ENTRIES);

    const counts = {
      all: limitedHistory.length,
      success: 0,
      error: 0,
    };

    limitedHistory.forEach((entry) => {
      if (entry.status === "success") {
        counts.success++;
      } else {
        counts.error++;
      }
    });

    const filtered = limitedHistory.filter((entry) => {
      if (activeFilter === "all") return true;
      return entry.status === activeFilter;
    });

    // Reverse to show newest first
    return { filteredHistory: filtered.slice().reverse(), counts };
  }, [history, activeFilter]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(filteredHistory.map((entry) => entry.id)));
  }, [filteredHistory]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const copyToClipboard = useCallback(async (entry: HistoryEntry) => {
    const data = {
      method: entry.method,
      params: entry.params,
      response: entry.response,
      status: entry.status,
      duration: entry.duration,
      timestamp: entry.timestamp.toISOString(),
      ...(entry.error && { error: entry.error }),
    };
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const getStatusStyle = (status: "success" | "error") => {
    if (status === "success") {
      return {
        icon: CheckCircle2,
        color: "text-green-500",
        bg: "bg-green-500/10",
      };
    }
    return {
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    };
  };

  const filterButtons: { key: HistoryFilterType; label: string; count: number }[] = [
    { key: "all", label: t("inspector.all", "All"), count: counts.all },
    { key: "success", label: t("inspector.success", "Success"), count: counts.success },
    { key: "error", label: t("inspector.error", "Error"), count: counts.error },
  ];

  const allExpanded = expandedIds.size === filteredHistory.length && filteredHistory.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("inspector.requestHistory", "Request History")}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {counts.all}
            </Badge>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 ml-4">
            {filterButtons.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  activeFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1 ${activeFilter === key ? "opacity-80" : "opacity-60"}`}>
                    ({count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Expand/Collapse All */}
          <Button
            variant="ghost"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
            disabled={filteredHistory.length === 0}
            className="h-7 text-xs"
            title={allExpanded ? t("inspector.collapseAll", "Collapse All") : t("inspector.expandAll", "Expand All")}
          >
            {allExpanded ? (
              <ChevronsDownUp className="h-3 w-3" />
            ) : (
              <ChevronsUpDown className="h-3 w-3" />
            )}
          </Button>

          {/* Clear All */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            disabled={history.length === 0}
            className="h-7 text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {t("inspector.clearAll", "Clear")}
          </Button>
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-auto">
        {filteredHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            <Info className="h-4 w-4 mr-2" />
            {t("inspector.noHistory", "No request history yet")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredHistory.map((entry) => {
              const style = getStatusStyle(entry.status);
              const Icon = style.icon;
              const isExpanded = expandedIds.has(entry.id);

              return (
                <div key={entry.id} className="group">
                  {/* Entry Header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <button className="p-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>

                    <div className={`p-1 rounded ${style.bg}`}>
                      <Icon className={`h-3 w-3 ${style.color}`} />
                    </div>

                    <code className="text-xs font-mono flex-1 truncate">
                      {entry.method}
                    </code>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(entry.duration)}
                      </span>
                      <span>{entry.timestamp.toLocaleTimeString()}</span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(entry);
                        }}
                      >
                        {copiedId === entry.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      {onRemoveEntry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveEntry(entry.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-12 space-y-2">
                      {/* Request Params */}
                      {entry.params && Object.keys(entry.params).length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {t("inspector.request", "Request")}:
                          </span>
                          <pre className="text-xs bg-muted/50 p-2 rounded border overflow-x-auto max-h-32 mt-1">
                            {JSON.stringify(entry.params, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Response */}
                      {entry.response !== undefined && (
                        <div>
                          <span className={`text-xs font-semibold ${
                            entry.status === "success"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}>
                            {t("inspector.response", "Response")}:
                          </span>
                          <pre className="text-xs bg-muted/50 p-2 rounded border overflow-x-auto max-h-48 mt-1">
                            {typeof entry.response === "string"
                              ? entry.response
                              : JSON.stringify(entry.response, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Error */}
                      {entry.error && (
                        <div>
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                            {t("inspector.errorMessage", "Error")}:
                          </span>
                          <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-2 rounded border border-red-200 dark:border-red-800 overflow-x-auto max-h-24 mt-1">
                            {entry.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Show truncation warning if needed */}
      {history.length > MAX_DISPLAY_ENTRIES && (
        <div className="px-4 py-1 border-t border-border bg-muted/20 text-xs text-muted-foreground text-center">
          {t("inspector.historyTruncated", "Showing last {{count}} entries", { count: MAX_DISPLAY_ENTRIES })}
        </div>
      )}
    </div>
  );
}
