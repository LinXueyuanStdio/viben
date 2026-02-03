import { useState, useCallback } from "react";
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
import { useLogs, type LogEntry, type LogSession } from "@/hooks/use-logs";
import { useApiLogs, type ApiLogEntry, type ApiLogSession } from "@/hooks/use-api-logs";
import { useMcpStatusMonitor, useOnPageEnter } from "@/hooks/use-mcp-status-monitor";
import { useAppStore } from "@/stores";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";

type TabType = "server" | "api";

export function LogsPage() {
  const { t } = useTranslation();
  const {
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    clearSession,
    cleanupSessions,
    logs,
    loading,
    error,
    autoRefresh,
    setAutoRefresh,
    logsDirPath,
    refresh,
    exportLogs,
  } = useLogs();

  // Use the MCP status monitor for server process status
  const { mcpServers } = useAppStore();
  const { statuses: mcpServerStatuses, checkAllServers } = useMcpStatusMonitor();

  // Trigger status check on page enter
  useOnPageEnter({ enabled: mcpServers.length > 0 });

  const [activeTab, setActiveTab] = useState<TabType>("server");
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // Map server statuses from the monitor to session process status
  // This uses the global status monitor instead of per-session checks
  const processStatus = useCallback((_sessionId: string, serverId: string | undefined, pid: number | null, endedAt: string | null): boolean | undefined => {
    // If session has ended, don't show as alive
    if (endedAt) return undefined;
    // If no PID, can't determine
    if (!pid) return undefined;

    // Try to find the server by matching session's server_id
    // Sessions store server_id in their metadata
    if (serverId && mcpServerStatuses[serverId]) {
      return mcpServerStatuses[serverId].status === "running";
    }

    // Fallback: can't determine from monitor
    return undefined;
  }, [mcpServerStatuses]);

  // Handle refresh - also trigger status check
  const handleRefresh = useCallback(async () => {
    refresh();
    await checkAllServers(true);
  }, [refresh, checkAllServers]);

  const handleExport = async () => {
    if (!selectedSessionId) return;
    setExporting(true);
    try {
      const session = sessions.find(s => s.id === selectedSessionId);
      const defaultName = session
        ? `${session.server_name.replace(/\s+/g, "_")}_${session.created_at.replace(/[:\s]/g, "-")}.log`
        : "browse-mcp-logs.txt";

      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
      });
      if (filePath) {
        await exportLogs(filePath);
      }
    } catch (err) {
      console.error("Failed to export logs:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleClearSession = async () => {
    if (!selectedSessionId) return;
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!confirm(t("logs.deleteSession", { name: session?.server_name }))) return;
    setCleaning(true);
    try {
      await clearSession(selectedSessionId);
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

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{t("logs.title")}</h1>
          {logsDirPath && (
            <p className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-md flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              {logsDirPath}
            </p>
          )}
        </div>
        <div className="flex gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting || !selectedSessionId}
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
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => setActiveTab("server")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "server"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Terminal className="h-4 w-4 inline mr-2" />
          {t("logs.serverLogs")}
        </button>
        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "api"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4 inline mr-2" />
          {t("logs.apiLogs")}
        </button>
      </div>

      {activeTab === "server" ? (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sessions sidebar */}
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
                    <SessionItem
                      key={session.id}
                      session={session}
                      selected={session.id === selectedSessionId}
                      onClick={() => setSelectedSessionId(session.id)}
                      isAlive={processStatus(session.id, session.server_id, session.pid, session.ended_at)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Terminal-style log viewer */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Selected session info */}
            {selectedSession && (
              <div className="mb-3 p-2 rounded-lg border bg-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{selectedSession.server_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedSession.created_at}
                      {selectedSession.ended_at
                        ? ` - ${selectedSession.ended_at}`
                        : selectedSession.pid
                        ? ` (${t("logs.pid", { pid: selectedSession.pid })})`
                        : ` (${t("common.running")})`}
                    </p>
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

            {/* Terminal Log Viewer */}
            <div className="flex-1 rounded-lg overflow-hidden bg-[#1e1e1e] border border-[#333]">
              {!selectedSessionId ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">{t("logs.selectSession")}</p>
                  <p className="text-sm">{t("logs.selectSessionDesc")}</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <Terminal className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">{t("logs.noLogs")}</p>
                  <p className="text-sm">
                    {selectedSession?.ended_at
                      ? t("logs.noLogsEnded")
                      : t("logs.logsWillAppear")}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-3 font-mono text-xs leading-relaxed">
                    {logs.map((log) => (
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
          </div>
        </div>
      ) : (
        <ApiLogsTab />
      )}
    </div>
  );
}

interface SessionItemProps {
  session: LogSession;
  selected: boolean;
  onClick: () => void;
  isAlive?: boolean;
}

function SessionItem({ session, selected, onClick, isAlive }: SessionItemProps) {
  const { t } = useTranslation();
  const hasEnded = !!session.ended_at;
  const isRunning = !hasEnded && isAlive === true;
  const isDead = !hasEnded && isAlive === false;

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
          {session.server_name}
        </span>
        {session.pid && !hasEnded && (
          <span className="text-xs text-muted-foreground">{t("logs.pid", { pid: session.pid })}</span>
        )}
        {selected && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{session.created_at}</span>
      </div>
    </button>
  );
}

interface TerminalLogLineProps {
  log: LogEntry;
}

function TerminalLogLine({ log }: TerminalLogLineProps) {
  // Parse the raw log line and colorize based on content
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

// API Logs Tab - Full implementation with JSONL logging
function ApiLogsTab() {
  const { t } = useTranslation();
  const {
    sessions,
    selectedRunId,
    setSelectedRunId,
    logs,
    summary,
    loading,
    error,
    logsDirPath,
    autoRefresh,
    setAutoRefresh,
    filter,
    setFilter,
    clearFilter,
    clearLogs,
    refresh,
    uniqueProviders,
    uniqueSources,
    uniqueMethods,
  } = useApiLogs();

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filter logs by search query
  const filteredLogs = searchQuery
    ? logs.filter(
        (log) =>
          log.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (log.error && log.error.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : logs;

  const handleClearSession = async () => {
    if (!selectedRunId) return;
    if (!confirm(t("logs.deleteApiSession"))) return;
    await clearLogs(selectedRunId);
  };

  return (
    <div className="flex-1 flex gap-4 min-h-0">
      {/* Sessions sidebar */}
      <div className="w-64 flex flex-col rounded-lg border bg-card">
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm">{t("logs.apiSessions")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("logs.sessionCount", { count: sessions.length })}
          </p>
          {logsDirPath && (
            <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate flex items-center gap-1">
              <FolderOpen className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{logsDirPath}</span>
            </p>
          )}
        </div>
        <ScrollArea className="flex-1">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t("logs.noApiLogs")}</p>
              <p className="text-xs mt-1">{t("logs.apiLogsWillAppear")}</p>
            </div>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => (
                <ApiSessionItem
                  key={session.run_id}
                  session={session}
                  selected={session.run_id === selectedRunId}
                  onClick={() => setSelectedRunId(session.run_id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Controls */}
        <div className="mb-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-50 dark:bg-green-950" : ""}
          >
            {autoRefresh ? (
              <ToggleRight className="h-4 w-4 mr-1 text-green-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 mr-1" />
            )}
            {t("common.auto")}
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {t("common.refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-muted" : ""}
          >
            <Filter className="h-4 w-4 mr-1" />
            {t("logs.filters")}
          </Button>
          <div className="flex-1" />
          {selectedRunId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSession}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("common.clear")}
            </Button>
          )}
        </div>

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
                value={filter.provider || ""}
                onChange={(e) => setFilter({ ...filter, provider: e.target.value || undefined })}
                className="px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="">{t("logs.allProviders")}</option>
                {uniqueProviders.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={filter.source || ""}
                onChange={(e) => setFilter({ ...filter, source: e.target.value || undefined })}
                className="px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="">{t("logs.allSources")}</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={filter.method || ""}
                onChange={(e) => setFilter({ ...filter, method: e.target.value as "search" | "download" | "read" | undefined })}
                className="px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="">{t("logs.allMethods")}</option>
                {uniqueMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={filter.status || ""}
                onChange={(e) => setFilter({ ...filter, status: e.target.value as "success" | "error" | undefined })}
                className="px-3 py-1.5 rounded-md border bg-background text-sm"
              >
                <option value="">{t("logs.allStatus")}</option>
                <option value="success">{t("logs.success")}</option>
                <option value="error">{t("logs.error")}</option>
              </select>
              {(filter.provider || filter.source || filter.method || filter.status || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearFilter();
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
        {summary && summary.total_requests > 0 && (
          <div className="mb-3 grid grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-2xl font-bold">{summary.total_requests}</p>
              <p className="text-xs text-muted-foreground">{t("logs.totalRequests")}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-2xl font-bold text-green-600">{summary.successful_requests}</p>
              <p className="text-xs text-muted-foreground">{t("logs.successful")}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-2xl font-bold text-red-600">{summary.failed_requests}</p>
              <p className="text-xs text-muted-foreground">{t("logs.failed")}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-2xl font-bold">{summary.avg_latency_ms.toFixed(0)}ms</p>
              <p className="text-xs text-muted-foreground">{t("logs.avgLatency")}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Log viewer */}
        <div className="flex-1 rounded-lg overflow-hidden bg-[#1e1e1e] border border-[#333]">
          {!selectedRunId ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Activity className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t("logs.selectApiSession")}</p>
              <p className="text-sm">{t("logs.selectApiSessionDesc")}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Database className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t("logs.noLogs")}</p>
              <p className="text-sm">
                {searchQuery || Object.keys(filter).length > 0
                  ? t("logs.noLogsMatchFilter")
                  : t("logs.apiLogsWillAppear")}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-3 font-mono text-xs space-y-1">
                {filteredLogs.map((log, idx) => (
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
            {filteredLogs.length} {t("logs.logEntries")}
            {(searchQuery || Object.keys(filter).length > 0) && ` (${t("logs.filtered")})`}
          </span>
          {autoRefresh && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {t("logs.autoRefreshing5s")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ApiSessionItemProps {
  session: ApiLogSession;
  selected: boolean;
  onClick: () => void;
}

function ApiSessionItem({ session, selected, onClick }: ApiSessionItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
        selected ? "bg-muted" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium text-sm truncate flex-1 font-mono">
          {session.run_id}
        </span>
        <span className="text-xs text-muted-foreground">{session.entry_count}</span>
        {selected && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      {session.created_at && (
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{session.created_at}</span>
        </div>
      )}
    </button>
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
