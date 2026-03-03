/**
 * History and Notifications Panel
 *
 * Combined bottom panel showing MCP request history (left) and server notifications (right).
 * Based on reference inspector implementation.
 */
import { useState, useMemo, useCallback } from "react";
import {
  History,
  Bell,
  ChevronDown,
  ChevronRight,
  Trash2,
  Info,
  Copy,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { InspectorHistoryEntry, InspectorNotification } from "@/types";

interface HistoryAndNotificationsProps {
  history: InspectorHistoryEntry[];
  notifications: InspectorNotification[];
  onClearHistory: () => void;
  onRemoveHistory?: (id: string) => void;
  onClearNotifications: () => void;
  onRemoveNotification?: (id: string) => void;
}

type HistoryFilterType = "all" | "success" | "error";
type NotificationFilterType = "all" | "info" | "progress" | "stderr";

export function HistoryAndNotifications({
  history,
  notifications,
  onClearHistory,
  onRemoveHistory,
  onClearNotifications,
  onRemoveNotification,
}: HistoryAndNotificationsProps) {
  const { t } = useTranslation();

  // History state
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterType>("all");
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  // Notifications state
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilterType>("all");
  const [expandedNotificationIds, setExpandedNotificationIds] = useState<Set<string>>(new Set());
  const [copiedNotificationId, setCopiedNotificationId] = useState<string | null>(null);

  // ==========================================================================
  // History Logic
  // ==========================================================================

  const { filteredHistory, historyCounts } = useMemo(() => {
    const counts = { all: history.length, success: 0, error: 0 };
    history.forEach((entry) => {
      if (entry.status === "success") counts.success++;
      else counts.error++;
    });

    const filtered = history.filter((entry) => {
      if (historyFilter === "all") return true;
      return entry.status === historyFilter;
    });

    return { filteredHistory: filtered, historyCounts: counts };
  }, [history, historyFilter]);

  const toggleHistoryExpand = useCallback((id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyHistoryEntry = useCallback(async (entry: InspectorHistoryEntry) => {
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
    setCopiedHistoryId(entry.id);
    setTimeout(() => setCopiedHistoryId(null), 2000);
  }, []);

  // ==========================================================================
  // Notifications Logic
  // ==========================================================================

  const { filteredNotifications, notificationCounts } = useMemo(() => {
    const counts = { all: notifications.length, info: 0, progress: 0, stderr: 0 };
    notifications.forEach((notification) => {
      if (notification.type === "stderr") counts.stderr++;
      else if (notification.method?.includes("progress")) counts.progress++;
      else counts.info++;
    });

    const filtered = notifications.filter((notification) => {
      if (notificationFilter === "all") return true;
      if (notificationFilter === "stderr") return notification.type === "stderr";
      if (notificationFilter === "progress") return notification.method?.includes("progress");
      if (notificationFilter === "info") {
        return notification.type !== "stderr" && !notification.method?.includes("progress");
      }
      return true;
    });

    return { filteredNotifications: filtered, notificationCounts: counts };
  }, [notifications, notificationFilter]);

  const toggleNotificationExpand = useCallback((id: string) => {
    setExpandedNotificationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyNotification = useCallback(async (notification: InspectorNotification) => {
    const text = JSON.stringify(
      { method: notification.method, params: notification.params },
      null,
      2
    );
    await navigator.clipboard.writeText(text);
    setCopiedNotificationId(notification.id);
    setTimeout(() => setCopiedNotificationId(null), 2000);
  }, []);

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getHistoryStatusStyle = (status: "success" | "error") => {
    if (status === "success") {
      return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" };
    }
    return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" };
  };

  const getNotificationStyle = (notification: InspectorNotification) => {
    if (notification.type === "stderr") {
      return { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" };
    }
    if (notification.method?.includes("progress")) {
      return { icon: Activity, color: "text-blue-500", bg: "bg-blue-500/10" };
    }
    return { icon: Bell, color: "text-green-500", bg: "bg-green-500/10" };
  };

  const historyFilterButtons: { key: HistoryFilterType; label: string; count: number }[] = [
    { key: "all", label: t("inspector.all", "All"), count: historyCounts.all },
    { key: "success", label: t("inspector.success", "Success"), count: historyCounts.success },
    { key: "error", label: t("inspector.error", "Error"), count: historyCounts.error },
  ];

  const notificationFilterButtons: { key: NotificationFilterType; label: string; count: number }[] = [
    { key: "all", label: t("inspector.all", "All"), count: notificationCounts.all },
    { key: "info", label: t("inspector.filterInfo", "Info"), count: notificationCounts.info },
    { key: "progress", label: t("inspector.filterProgress", "Progress"), count: notificationCounts.progress },
    { key: "stderr", label: t("inspector.filterStderr", "Stderr"), count: notificationCounts.stderr },
  ];

  return (
    <div className="h-full flex">
      {/* Left: Request History */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{t("inspector.requestHistory", "Request History")}</span>
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {historyCounts.all}
              </Badge>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-0.5 ml-2">
              {historyFilterButtons.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setHistoryFilter(key)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    historyFilter === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-0.5 ${historyFilter === key ? "opacity-80" : "opacity-60"}`}>
                      ({count})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHistory}
            disabled={history.length === 0}
            className="h-5 text-[10px] px-1.5"
          >
            <Trash2 className="h-2.5 w-2.5 mr-0.5" />
            {t("inspector.clearAll", "Clear")}
          </Button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-auto">
          {filteredHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              {t("inspector.noHistory", "No request history yet")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredHistory.map((entry) => {
                const style = getHistoryStatusStyle(entry.status);
                const Icon = style.icon;
                const isExpanded = expandedHistoryIds.has(entry.id);

                return (
                  <div key={entry.id} className="group">
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleHistoryExpand(entry.id)}
                    >
                      <button className="p-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                        )}
                      </button>

                      <div className={`p-0.5 rounded ${style.bg}`}>
                        <Icon className={`h-2.5 w-2.5 ${style.color}`} />
                      </div>

                      <code className="text-[10px] font-mono flex-1 truncate">
                        {entry.method}
                      </code>

                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDuration(entry.duration)}
                        </span>
                        <span>{entry.timestamp.toLocaleTimeString()}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyHistoryEntry(entry);
                          }}
                        >
                          {copiedHistoryId === entry.id ? (
                            <Check className="h-2.5 w-2.5 text-green-500" />
                          ) : (
                            <Copy className="h-2.5 w-2.5" />
                          )}
                        </Button>
                        {onRemoveHistory && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveHistory(entry.id);
                            }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-2 pl-9 space-y-1.5">
                        {entry.params && Object.keys(entry.params).length > 0 && (
                          <div>
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              {t("inspector.request", "Request")}:
                            </span>
                            <pre className="text-[10px] bg-muted/50 p-1.5 rounded border overflow-x-auto max-h-24 mt-0.5">
                              {JSON.stringify(entry.params, null, 2)}
                            </pre>
                          </div>
                        )}

                        {entry.response !== undefined && (
                          <div>
                            <span className={`text-[10px] font-semibold ${
                              entry.status === "success"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}>
                              {t("inspector.response", "Response")}:
                            </span>
                            <pre className="text-[10px] bg-muted/50 p-1.5 rounded border overflow-x-auto max-h-32 mt-0.5">
                              {typeof entry.response === "string"
                                ? entry.response
                                : JSON.stringify(entry.response, null, 2)}
                            </pre>
                          </div>
                        )}

                        {entry.error && (
                          <div>
                            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                              {t("inspector.errorMessage", "Error")}:
                            </span>
                            <pre className="text-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-1.5 rounded border border-red-200 dark:border-red-800 overflow-x-auto max-h-16 mt-0.5">
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
      </div>

      {/* Right: Notifications */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{t("inspector.mcpNotifications", "Notifications")}</span>
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {notificationCounts.all}
              </Badge>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-0.5 ml-2">
              {notificationFilterButtons.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setNotificationFilter(key)}
                  className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                    notificationFilter === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-0.5 ${notificationFilter === key ? "opacity-80" : "opacity-60"}`}>
                      ({count})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearNotifications}
            disabled={notifications.length === 0}
            className="h-5 text-[10px] px-1.5"
          >
            <Trash2 className="h-2.5 w-2.5 mr-0.5" />
            {t("inspector.clearAll", "Clear")}
          </Button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              {t("inspector.noNotifications", "No notifications")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => {
                const style = getNotificationStyle(notification);
                const Icon = style.icon;
                const isExpanded = expandedNotificationIds.has(notification.id);

                return (
                  <div key={notification.id} className="group">
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleNotificationExpand(notification.id)}
                    >
                      <button className="p-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                        )}
                      </button>

                      <div className={`p-0.5 rounded ${style.bg}`}>
                        <Icon className={`h-2.5 w-2.5 ${style.color}`} />
                      </div>

                      <code className="text-[10px] font-mono flex-1 truncate">
                        {notification.method || "stderr"}
                      </code>

                      <span className="text-[10px] text-muted-foreground">
                        {notification.timestamp.toLocaleTimeString()}
                      </span>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyNotification(notification);
                          }}
                        >
                          {copiedNotificationId === notification.id ? (
                            <Check className="h-2.5 w-2.5 text-green-500" />
                          ) : (
                            <Copy className="h-2.5 w-2.5" />
                          )}
                        </Button>
                        {onRemoveNotification && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveNotification(notification.id);
                            }}
                          >
                            <X className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && notification.params && (
                      <div className="px-3 pb-2 pl-9">
                        <pre className="text-[10px] bg-muted/50 p-1.5 rounded border overflow-x-auto max-h-24">
                          {JSON.stringify(notification.params, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
