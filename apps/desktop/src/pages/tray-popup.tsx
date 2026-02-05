import { Play, Square, Loader2, AlertCircle, Server, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMcp } from "@/hooks/use-mcp";
import { usePython } from "@/hooks/use-python";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useMcpStatusMonitor, useOnPageEnter } from "@/hooks/use-mcp-status-monitor";
import { useTrayWindowStoreSync } from "@/hooks/use-store-sync";
import { useAppStore } from "@/stores";
import type { McpServerInstance, McpServerStatus } from "@/types";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Tray Popup Page
 *
 * A compact view of server status shown when clicking the tray icon.
 * Allows quick start/stop of servers without opening the main window.
 */
export function TrayPopupPage() {
  const { t } = useTranslation();
  const { mcpServers, setMcpServerStatus, setupStatus } = useAppStore();
  const { getStats } = useMcpStatusMonitor();

  // Initialize store synchronization to receive updates from main window
  useTrayWindowStoreSync();

  // Enable status monitoring with force check to get fresh status when popup opens
  useOnPageEnter({ enabled: mcpServers.length > 0, forceCheck: true });

  const stats = getStats();
  const isSetupComplete = setupStatus?.isComplete === true;

  // Handle opening main window
  const handleOpenMain = async () => {
    try {
      await invoke("show_main_window");
    } catch (err) {
      console.error("Failed to show main window:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{t("tray.serverStatus")}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleOpenMain} className="h-7 px-2 text-xs">
          <ExternalLink className="h-3 w-3 mr-1" />
          {t("tray.openApp")}
        </Button>
      </div>

      {/* Status Summary */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <StatusSummary stats={stats} />
      </div>

      {/* Server List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {mcpServers.length === 0 ? (
            <EmptyState onOpenMain={handleOpenMain} />
          ) : (
            mcpServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                onStatusChange={(status, pid, error) =>
                  setMcpServerStatus(server.id, status, pid, error)
                }
                canStart={isSetupComplete ?? false}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer - Quick Actions */}
      {mcpServers.length > 0 && (
        <div className="px-4 py-2 border-t bg-card/50">
          <QuickActions servers={mcpServers} canStart={isSetupComplete ?? false} />
        </div>
      )}
    </div>
  );
}

interface StatusSummaryProps {
  stats: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
}

function StatusSummary({ stats }: StatusSummaryProps) {
  const { t } = useTranslation();

  if (stats.total === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        {t("tray.noServers")}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>{stats.running} {t("tray.running")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span>{stats.stopped} {t("tray.stopped")}</span>
        </div>
        {stats.error > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span>{stats.error} {t("tray.errors")}</span>
          </div>
        )}
      </div>
      <span className="text-muted-foreground">
        {stats.running}/{stats.total}
      </span>
    </div>
  );
}

interface EmptyStateProps {
  onOpenMain: () => void;
}

function EmptyState({ onOpenMain }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Server className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium mb-1">{t("tray.noServersTitle")}</p>
      <p className="text-xs text-muted-foreground mb-4">{t("tray.noServersDesc")}</p>
      <Button size="sm" onClick={onOpenMain}>
        {t("tray.createServer")}
      </Button>
    </div>
  );
}

interface ServerCardProps {
  server: McpServerInstance;
  onStatusChange: (status: McpServerStatus, pid?: number, error?: string) => void;
  canStart: boolean;
}

function ServerCard({ server, onStatusChange, canStart }: ServerCardProps) {
  const { startServer, stopServer, loading } = useMcp();
  const { selectedPython } = usePython();
  const { getAllApiKeys } = useApiKeys();
  const { mcpServerStatuses } = useAppStore();

  // Get status from monitor (more accurate)
  const statusInfo = mcpServerStatuses[server.id];
  const effectiveStatus = statusInfo?.status ?? server.status;
  const isRunning = effectiveStatus === "running";
  const isError = effectiveStatus === "error";

  const handleStart = async () => {
    if (!selectedPython?.path) return;

    const apiKeys = await getAllApiKeys();
    const port = server.port ?? 3000;

    try {
      await startServer({
        python_path: selectedPython.path,
        transport: server.transport,
        port,
        download_path: server.downloadPath,
        enabled_sources: server.enabledSources,
        api_keys: apiKeys,
        server_id: server.id,
        server_name: server.name,
      });
      onStatusChange("running");
    } catch (err) {
      console.error("Failed to start server:", err);
    }
  };

  const handleStop = async () => {
    try {
      await stopServer();
      onStatusChange("stopped");
    } catch (err) {
      console.error("Failed to stop server:", err);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border bg-card",
        isError && "border-red-200 dark:border-red-900"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-2.5 w-2.5 rounded-full shrink-0",
            isRunning && "bg-green-500 animate-pulse",
            isError && "bg-red-500",
            !isRunning && !isError && "bg-muted-foreground"
          )}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{server.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{server.transport.toUpperCase()}</span>
            <span>:{server.port || 3000}</span>
            {isError && statusInfo?.error && (
              <span className="text-red-500 truncate" title={statusInfo.error}>
                <AlertCircle className="h-3 w-3 inline mr-0.5" />
                {statusInfo.error.slice(0, 20)}...
              </span>
            )}
          </div>
        </div>
      </div>

      <Button
        variant={isRunning ? "destructive" : "default"}
        size="sm"
        onClick={isRunning ? handleStop : handleStart}
        disabled={loading || (!canStart && !isRunning)}
        className="h-8 px-3"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isRunning ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

interface QuickActionsProps {
  servers: McpServerInstance[];
  canStart: boolean;
}

function QuickActions({ servers, canStart }: QuickActionsProps) {
  const { t } = useTranslation();
  const { startServer, stopServer, loading } = useMcp();
  const { selectedPython } = usePython();
  const { getAllApiKeys } = useApiKeys();
  const { setMcpServerStatus, mcpServerStatuses } = useAppStore();

  const runningServers = servers.filter((s) => {
    const status = mcpServerStatuses[s.id]?.status ?? s.status;
    return status === "running";
  });

  const stoppedServers = servers.filter((s) => {
    const status = mcpServerStatuses[s.id]?.status ?? s.status;
    return status !== "running";
  });

  const handleStartAll = async () => {
    if (!selectedPython?.path) return;
    const apiKeys = await getAllApiKeys();

    for (const server of stoppedServers) {
      try {
        await startServer({
          python_path: selectedPython.path,
          transport: server.transport,
          port: server.port ?? 3000,
          download_path: server.downloadPath,
          enabled_sources: server.enabledSources,
          api_keys: apiKeys,
          server_id: server.id,
          server_name: server.name,
        });
        setMcpServerStatus(server.id, "running");
      } catch (err) {
        console.error(`Failed to start ${server.name}:`, err);
      }
    }
  };

  const handleStopAll = async () => {
    for (const server of runningServers) {
      try {
        await stopServer();
        setMcpServerStatus(server.id, "stopped");
      } catch (err) {
        console.error(`Failed to stop ${server.name}:`, err);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleStartAll}
        disabled={loading || !canStart || stoppedServers.length === 0}
        className="flex-1 h-8 text-xs"
      >
        <Play className="h-3 w-3 mr-1" />
        {t("tray.startAll")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleStopAll}
        disabled={loading || runningServers.length === 0}
        className="flex-1 h-8 text-xs"
      >
        <Square className="h-3 w-3 mr-1" />
        {t("tray.stopAll")}
      </Button>
    </div>
  );
}
