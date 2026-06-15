import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { getGatewayClient } from "@/lib/gateway";
import {
  RefreshCw,
  Download,
  Trash2,
  Loader2,
  FileText,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Server,
  Clock,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Terminal,
  Activity,
  Filter,
  Search,
  Zap,
  Database,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUnifiedSessions, type UnifiedSession } from "@/hooks/use-unified-sessions";
import type { LogEntry } from "@/hooks/use-logs";
import type { ApiLogEntry } from "@/hooks/use-api-logs";
import { useAppStore } from "@/stores";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";

type TabType = "server" | "api";

export function LogsPage() {
  const { t } = useTranslation();
  const {
    sessions,
    selectedRunId,
    setSelectedRunId,
    selectedSession,
    loading,
    error,
    logsDirPath,
    autoRefresh,
    setAutoRefresh,
    serverLogs,
    apiLogs,
    apiLogSummary,
    apiLogFilter,
    setApiLogFilter,
    clearApiLogFilter,
    uniqueProviders,
    uniqueSources,
    uniqueMethods,
    refresh,
    clearSession,
    cleanupSessions,
    exportServerLogs,
    openLogsFolder,
  } = useUnifiedSessions();

  const { mcpServers } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>("server");
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // API logs tab state
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Track directly checked PIDs for sessions not in current server list
  const [directPidStatus, setDirectPidStatus] = useState<Record<number, boolean>>({});
  const pidCheckInProgress = useRef<Set<number>>(new Set());

  // Check PIDs directly for sessions that don't match any current server
  // NOTE: We use a ref to track already-checked PIDs to avoid re-triggering
  const checkedPidsRef = useRef<Set<number>>(new Set());

  const checkOrphanedPids = useCallback(async () => {
    const orphanedPids: number[] = [];

    for (const session of sessions) {
      // Skip if session has ended or no PID
      if (!session.isActive || !session.pid) continue;

      // Skip if this PID matches a current server
      const matchesServerPid = mcpServers.some(s => s.pid === session.pid);

      if (!matchesServerPid) {
        orphanedPids.push(session.pid);
      }
    }

    // Check each orphaned PID
    for (const pid of orphanedPids) {
      // Skip if already checking or already checked (use ref to avoid dependency cycle)
      if (pidCheckInProgress.current.has(pid) || checkedPidsRef.current.has(pid)) {
        continue;
      }

      pidCheckInProgress.current.add(pid);
      checkedPidsRef.current.add(pid);
      try {
        const isAlive = await getGatewayClient().isProcessAlive(pid);
        setDirectPidStatus(prev => ({ ...prev, [pid]: isAlive }));
      } catch {
        setDirectPidStatus(prev => ({ ...prev, [pid]: false }));
      } finally {
        pidCheckInProgress.current.delete(pid);
      }
    }
  }, [sessions, mcpServers]);

  // Check orphaned PIDs on mount and when sessions change
  useEffect(() => {
    checkOrphanedPids();
  }, [sessions, checkOrphanedPids]);

  // Map server statuses to session process status
  const processStatus = useCallback((session: UnifiedSession): boolean | undefined => {
    if (!session.isActive) return undefined;
    if (!session.pid) return undefined;

    // Check against mcpServers
    const matchingServer = mcpServers.find((s) => s.pid === session.pid);
    if (matchingServer) {
      return matchingServer.status === "running";
    }

    // Check directly checked PID status
    if (session.pid && directPidStatus[session.pid] !== undefined) {
      return directPidStatus[session.pid];
    }

    return undefined;
  }, [mcpServers, directPidStatus]);

  // Handle refresh - re-check orphaned PIDs
  const handleRefresh = useCallback(async () => {
    refresh();
    // Clear cached direct PID status to force re-check
    setDirectPidStatus({});
    checkedPidsRef.current.clear();
  }, [refresh]);

  const handleExport = async () => {
    if (!selectedSession?.serverLog) return;
    setExporting(true);
    try {
      const defaultName = `${selectedSession.displayName.replace(/\s+/g, "_")}_${selectedSession.createdAt.replace(/[:\s]/g, "-")}.log`;

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: t("logs.logFiles"), extensions: ["log", "txt"] }],
      });
      if (filePath) {
        await exportServerLogs(filePath);
      }
    } catch (err) {
      console.error("Failed to export logs:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleClearSession = async () => {
    if (!selectedRunId) return;
    if (!confirm(t("logs.deleteSession", { name: selectedSession?.displayName }))) return;
    setCleaning(true);
    try {
      await clearSession(selectedRunId);
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm(t("logs.cleanupConfirm"))) return;
    setCleaning(true);
    try {
      const deleted = await cleanupSessions(10);
      if (deleted > 0) {
        alert(t("logs.deletedSessions", { count: deleted }));
      }
    } finally {
      setCleaning(false);
    }
  };

  // Filter API logs by search query
  const filteredApiLogs = useMemo(() => {
    if (!searchQuery) return apiLogs;
    return apiLogs.filter(
      (log) =>
        log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.error && log.error.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [apiLogs, searchQuery]);

  // Determine if current session has server/api logs
  const hasServerLog = !!selectedSession?.serverLog;
  const hasApiLog = !!selectedSession?.apiLog;

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header with shared controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{t("logs.title")}</h1>
          {logsDirPath && (
            <button
              onClick={openLogsFolder}
              className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-md flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              title={t("logs.openLogsFolder")}
            >
              <FolderOpen className="h-3 w-3" />
              {logsDirPath}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {/* Shared: Auto and Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-50 dark:bg-green-950" : ""}
          >
            {autoRefresh ? (
              <ToggleRight className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 mr-2" />
            )}
            {t("common.auto")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("common.refresh")}
          </Button>

          {/* Server Tab specific: Export, Cleanup */}
          {activeTab === "server" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting || !hasServerLog}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t("common.export")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanup}
                disabled={cleaning || sessions.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("common.cleanup")}
              </Button>
            </>
          )}

          {/* API Tab specific: Filter, Open Folder */}
          {activeTab === "api" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "bg-muted" : ""}
              >
                <Filter className="h-4 w-4 mr-2" />
                {t("logs.filters")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openLogsFolder}
                title={t("logs.openLogsFolder")}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {t("logs.openFolder")}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Unified Sessions sidebar */}
        <div className="w-64 flex flex-col rounded-lg border bg-card">
          <div className="p-3 border-b">
            <h2 className="font-semibold text-sm">{t("logs.sessions")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("logs.sessionCount", { count: sessions.length })}
            </p>
          </div>
          <ScrollArea className="flex-1">
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t("logs.noSessions")}
              </div>
            ) : (
              <div className="divide-y">
                {sessions.map((session) => (
                  <UnifiedSessionItem
                    key={session.run_id}
                    session={session}
                    selected={session.run_id === selectedRunId}
                    onClick={() => setSelectedRunId(session.run_id)}
                    isAlive={processStatus(session)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main content with Tabs */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Session info header */}
          {selectedSession && (
            <div className="mb-3 p-2 rounded-lg border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{selectedSession.displayName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{selectedSession.createdAt}</span>
                    {selectedSession.pid && selectedSession.isActive && (
                      <span>({t("logs.pid", { pid: selectedSession.pid })})</span>
                    )}
                    {/* Show log type indicators */}
                    <span className="flex items-center gap-1">
                      {hasServerLog && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px]">
                          <Terminal className="h-2.5 w-2.5 inline mr-0.5" />
                          {t("logs.serverTab")}
                        </span>
                      )}
                      {hasApiLog && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-[10px]">
                          <Activity className="h-2.5 w-2.5 inline mr-0.5" />
                          {t("logs.apiTab")} ({selectedSession.apiLog?.entry_count || 0})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                disabled={cleaning}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Tabs for Server/API logs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col min-h-0">
            <TabsList>
              <TabsTrigger value="server">
                <Terminal className="h-4 w-4 mr-2" />
                {t("logs.serverLogs")}
                {hasServerLog && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({serverLogs.length})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="api">
                <Activity className="h-4 w-4 mr-2" />
                {t("logs.apiLogs")}
                {hasApiLog && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({selectedSession?.apiLog?.entry_count || 0})
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Server Logs Content */}
            <TabsContent value="server" className="flex-1 flex flex-col min-h-0 mt-0">
              <div className="flex-1 rounded-lg overflow-hidden bg-[#1e1e1e] border border-[#333]">
                {!selectedRunId ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{t("logs.selectSession")}</p>
                    <p className="text-sm">{t("logs.selectSessionDesc")}</p>
                  </div>
                ) : !hasServerLog ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Terminal className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{t("logs.noServerLogs")}</p>
                    <p className="text-sm">{t("logs.noServerLogsDesc")}</p>
                  </div>
                ) : serverLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Terminal className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{t("logs.noLogs")}</p>
                    <p className="text-sm">
                      {selectedSession?.isActive
                        ? t("logs.logsWillAppear")
                        : t("logs.noLogsEnded")}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-3 font-mono text-xs leading-relaxed">
                      {serverLogs.map((log) => (
                        <TerminalLogLine key={log.id} log={log} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Status bar */}
              <div className="mt-2 flex items-center justify-end text-xs text-muted-foreground">
                {autoRefresh && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {t("logs.autoRefreshing")}
                  </span>
                )}
              </div>
            </TabsContent>

            {/* API Logs Content */}
            <TabsContent value="api" className="flex-1 flex flex-col min-h-0 mt-0">
              {/* Filters */}
              {showFilters && (
                <div className="mb-3 p-3 rounded-lg border bg-card">
                  <div className="flex flex-wrap gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("logs.searchLogs")}
                        className="w-full pl-8 pr-3 py-1.5 rounded-md border bg-background text-sm"
                      />
                    </div>
                    <select
                      value={apiLogFilter.provider || ""}
                      onChange={(e) => setApiLogFilter({ ...apiLogFilter, provider: e.target.value || undefined })}
                      className="px-3 py-1.5 rounded-md border bg-background text-sm"
                    >
                      <option value="">{t("logs.allProviders")}</option>
                      {uniqueProviders.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      value={apiLogFilter.source || ""}
                      onChange={(e) => setApiLogFilter({ ...apiLogFilter, source: e.target.value || undefined })}
                      className="px-3 py-1.5 rounded-md border bg-background text-sm"
                    >
                      <option value="">{t("logs.allSources")}</option>
                      {uniqueSources.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={apiLogFilter.method || ""}
                      onChange={(e) => setApiLogFilter({ ...apiLogFilter, method: e.target.value as "search" | "download" | "read" | undefined })}
                      className="px-3 py-1.5 rounded-md border bg-background text-sm"
                    >
                      <option value="">{t("logs.allMethods")}</option>
                      {uniqueMethods.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={apiLogFilter.status || ""}
                      onChange={(e) => setApiLogFilter({ ...apiLogFilter, status: e.target.value as "success" | "error" | undefined })}
                      className="px-3 py-1.5 rounded-md border bg-background text-sm"
                    >
                      <option value="">{t("logs.allStatus")}</option>
                      <option value="success">{t("logs.success")}</option>
                      <option value="error">{t("logs.error")}</option>
                    </select>
                    {(apiLogFilter.provider || apiLogFilter.source || apiLogFilter.method || apiLogFilter.status || searchQuery) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          clearApiLogFilter();
                          setSearchQuery("");
                        }}
                      >
                        {t("common.clear")}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              {apiLogSummary && apiLogSummary.total_requests > 0 && (
                <div className="mb-3 grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-2xl font-bold">{apiLogSummary.total_requests}</p>
                    <p className="text-xs text-muted-foreground">{t("logs.totalRequests")}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-2xl font-bold text-green-600">{apiLogSummary.successful_requests}</p>
                    <p className="text-xs text-muted-foreground">{t("logs.successful")}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-2xl font-bold text-red-600">{apiLogSummary.failed_requests}</p>
                    <p className="text-xs text-muted-foreground">{t("logs.failed")}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-2xl font-bold">{apiLogSummary.avg_latency_ms.toFixed(0)}ms</p>
                    <p className="text-xs text-muted-foreground">{t("logs.avgLatency")}</p>
                  </div>
                </div>
              )}

              {/* Log viewer */}
              <div className="flex-1 rounded-lg overflow-hidden bg-[#1e1e1e] border border-[#333]">
                {!selectedRunId ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Activity className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{t("logs.selectSession")}</p>
                    <p className="text-sm">{t("logs.selectSessionDesc")}</p>
                  </div>
                ) : !hasApiLog ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Database className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{t("logs.noApiLogsForSession")}</p>
                    <p className="text-sm">{t("logs.apiLogsWillAppear")}</p>
                  </div>
                ) : filteredApiLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Database className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">{t("logs.noLogs")}</p>
                    <p className="text-sm">
                      {searchQuery || apiLogFilter.provider || apiLogFilter.source || apiLogFilter.method || apiLogFilter.status
                        ? t("logs.noLogsMatchFilter")
                        : t("logs.apiLogsWillAppear")}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="p-3 font-mono text-xs space-y-1">
                      {filteredApiLogs.map((log, idx) => (
                        <ApiLogLine
                          key={`${log.timestamp}-${idx}`}
                          log={log}
                          expanded={expandedLogId === `${log.timestamp}-${idx}`}
                          onToggle={() =>
                            setExpandedLogId(
                              expandedLogId === `${log.timestamp}-${idx}` ? null : `${log.timestamp}-${idx}`
                            )
                          }
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Status bar */}
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {filteredApiLogs.length} {t("logs.logEntries")}
                  {(searchQuery || apiLogFilter.provider || apiLogFilter.source || apiLogFilter.method || apiLogFilter.status) && ` (${t("logs.filtered")})`}
                </span>
                {autoRefresh && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {t("logs.autoRefreshing")}
                  </span>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

interface UnifiedSessionItemProps {
  session: UnifiedSession;
  selected: boolean;
  onClick: () => void;
  isAlive?: boolean;
}

function UnifiedSessionItem({ session, selected, onClick, isAlive }: UnifiedSessionItemProps) {
  const { t } = useTranslation();
  const hasEnded = !session.isActive;
  const isRunning = !hasEnded && isAlive === true;
  const isDead = !hasEnded && isAlive === false;
  const hasServerLog = !!session.serverLog;
  const hasApiLog = !!session.apiLog;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
        selected ? "bg-muted" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {isRunning ? (
          <span title={t("logs.processRunning")}>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </span>
        ) : isDead ? (
          <span title={t("logs.processDied")}>
            <XCircle className="h-3 w-3 text-red-500" />
          </span>
        ) : hasEnded ? (
          <span title={t("logs.endedNormally")}>
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
          </span>
        ) : (
          <span title={t("logs.unknownStatus")}>
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
          </span>
        )}
        <span className="font-medium text-sm truncate flex-1">
          {session.displayName}
        </span>
        {session.pid && !hasEnded && (
          <span className="text-xs text-muted-foreground">{t("logs.pid", { pid: session.pid })}</span>
        )}
        {selected && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{session.createdAt}</span>
        {/* Log type indicators */}
        <div className="flex-1" />
        {hasServerLog && (
          <span title={t("common.serverLogs")}>
            <Terminal className="h-3 w-3 text-blue-500" />
          </span>
        )}
        {hasApiLog && (
          <span title={t("logs.apiLogsWithCount", { count: session.apiLog?.entry_count || 0 })}>
            <Activity className="h-3 w-3 text-purple-500" />
          </span>
        )}
      </div>
    </button>
  );
}

interface TerminalLogLineProps {
  log: LogEntry;
}

function TerminalLogLine({ log }: TerminalLogLineProps) {
  const message = log.message;
  const timestamp = log.timestamp;

  // Determine color based on log content
  let textColor = "text-gray-300"; // default
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("error") || lowerMessage.includes("failed") || lowerMessage.includes("exception")) {
    textColor = "text-red-400";
  } else if (lowerMessage.includes("warning") || lowerMessage.includes("warn")) {
    textColor = "text-yellow-400";
  } else if (lowerMessage.includes("success") || lowerMessage.includes("started") || lowerMessage.includes("connected")) {
    textColor = "text-green-400";
  } else if (lowerMessage.includes("info") || lowerMessage.includes("debug")) {
    textColor = "text-blue-400";
  }

  return (
    <div className={`${textColor} whitespace-pre-wrap break-all`}>
      <span className="text-gray-500">{timestamp}</span>
      {log.source && <span className="text-cyan-400"> [{log.source}]</span>}
      <span> {message}</span>
    </div>
  );
}

interface ApiLogLineProps {
  log: ApiLogEntry;
  expanded: boolean;
  onToggle: () => void;
}

function ApiLogLine({ log, expanded, onToggle }: ApiLogLineProps) {
  const { t } = useTranslation();
  const isError = log.status === "error";
  const textColor = isError ? "text-red-400" : "text-gray-300";

  // Format timestamp for display
  const time = log.timestamp.split("T")[1]?.replace("Z", "") || log.timestamp;

  // Method icons
  const methodIcon = {
    search: <Search className="h-3 w-3" />,
    download: <Download className="h-3 w-3" />,
    read: <BookOpen className="h-3 w-3" />,
  }[log.method] || <Zap className="h-3 w-3" />;

  return (
    <div className={`${textColor}`}>
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-2 hover:bg-white/5 px-1 py-0.5 rounded"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500 flex-shrink-0" />
        )}
        <span className="text-gray-500 w-20 flex-shrink-0">{time}</span>
        <span className="text-cyan-400 flex items-center gap-1 w-20 flex-shrink-0">
          {methodIcon}
          {log.method}
        </span>
        <span className="text-purple-400 w-32 flex-shrink-0 truncate">
          {log.provider}/{log.source}
        </span>
        <span
          className={`w-14 flex-shrink-0 ${
            isError ? "text-red-400" : "text-green-400"
          }`}
        >
          {log.status}
        </span>
        <span className="text-yellow-400 w-16 flex-shrink-0">
          {log.latency_ms.toFixed(0)}ms
        </span>
        {log.error && (
          <span className="text-red-400 truncate flex-1">{log.error}</span>
        )}
      </button>

      {expanded && (
        <div className="ml-6 mt-1 mb-2 p-2 bg-black/30 rounded text-xs space-y-2">
          <div>
            <span className="text-gray-500">{t("logs.request")}:</span>
            <pre className="mt-1 text-gray-400 whitespace-pre-wrap break-all">
              {JSON.stringify(log.request, null, 2)}
            </pre>
          </div>
          <div>
            <span className="text-gray-500">{t("logs.response")}:</span>
            <pre className="mt-1 text-gray-400 whitespace-pre-wrap break-all">
              {JSON.stringify(log.response, null, 2)}
            </pre>
          </div>
          {log.api_key_hash && (
            <div>
              <span className="text-gray-500">{t("logs.apiKeyHash")}:</span>
              <span className="ml-2 text-gray-400 font-mono">{log.api_key_hash}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
