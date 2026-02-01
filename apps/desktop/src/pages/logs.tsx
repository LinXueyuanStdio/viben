import { useState, useEffect, useCallback } from "react";
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
  FolderOpen,
  CheckCircle2,
  XCircle,
  Terminal,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLogs, type LogEntry, type LogSession } from "@/hooks/use-logs";
import { save } from "@tauri-apps/plugin-dialog";

type TabType = "server" | "api";

export function LogsPage() {
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
    checkProcessAlive,
  } = useLogs();

  const [activeTab, setActiveTab] = useState<TabType>("server");
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [processStatus, setProcessStatus] = useState<Record<string, boolean>>({});

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // Check process status for sessions with PIDs
  const checkAllProcessStatus = useCallback(async () => {
    const newStatus: Record<string, boolean> = {};
    for (const session of sessions) {
      if (session.pid && !session.ended_at) {
        const alive = await checkProcessAlive(session.pid);
        newStatus[session.id] = alive;
      }
    }
    setProcessStatus(newStatus);
  }, [sessions, checkProcessAlive]);

  useEffect(() => {
    checkAllProcessStatus();
  }, [checkAllProcessStatus]);

  // Handle refresh - also check process status
  const handleRefresh = useCallback(async () => {
    refresh();
    await checkAllProcessStatus();
  }, [refresh, checkAllProcessStatus]);

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
    if (!confirm(`Delete logs for "${session?.server_name}" session?`)) return;
    setCleaning(true);
    try {
      await clearSession(selectedSessionId);
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Delete old log sessions (keep last 10 per server)?")) return;
    setCleaning(true);
    try {
      const deleted = await cleanupSessions(10);
      if (deleted > 0) {
        alert(`Deleted ${deleted} old session(s)`);
      }
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
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
            Auto
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
            Refresh
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
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanup}
            disabled={cleaning || sessions.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
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
          Server Logs
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
          API Logs
        </button>
      </div>

      {activeTab === "server" ? (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Sessions sidebar */}
          <div className="w-64 flex flex-col rounded-lg border bg-card">
            <div className="p-3 border-b">
              <h2 className="font-semibold text-sm">Sessions</h2>
              <p className="text-xs text-muted-foreground">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ScrollArea className="flex-1">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No log sessions yet
                </div>
              ) : (
                <div className="divide-y">
                  {sessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      selected={session.id === selectedSessionId}
                      onClick={() => setSelectedSessionId(session.id)}
                      isAlive={processStatus[session.id]}
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
                        ? ` (PID: ${selectedSession.pid})`
                        : " (running)"}
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
                  <p className="text-lg font-medium">Select a session</p>
                  <p className="text-sm">Choose a log session from the sidebar</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <Terminal className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No logs yet</p>
                  <p className="text-sm">
                    {selectedSession?.ended_at
                      ? "This session has no log entries"
                      : "Logs will appear as the server runs"}
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
                  Auto-refreshing every 3s
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
          <span title="Running">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </span>
        ) : isDead ? (
          <span title="Process died">
            <XCircle className="h-3 w-3 text-red-500" />
          </span>
        ) : hasEnded ? (
          <span title="Ended normally">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
          </span>
        ) : (
          <span title="Unknown status">
            <div className="h-2 w-2 rounded-full bg-yellow-500" />
          </span>
        )}
        <span className="font-medium text-sm truncate flex-1">
          {session.server_name}
        </span>
        {session.pid && !hasEnded && (
          <span className="text-xs text-muted-foreground">PID: {session.pid}</span>
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

// API Logs Tab - placeholder for now, will be implemented with JSONL logging
function ApiLogsTab() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Activity className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">API Logs</h2>
        <p className="text-sm max-w-md">
          API request logs will appear here when the MCP server handles requests.
          <br />
          <span className="text-xs mt-2 block">
            Logs are stored in JSONL format for analysis.
          </span>
        </p>
      </div>
    </div>
  );
}
