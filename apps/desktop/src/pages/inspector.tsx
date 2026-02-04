import { useState, useCallback, useEffect } from "react";
import {
  SearchCode,
  ChevronDown,
  Loader2,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Inspector, NotificationsPanel } from "@/components/inspector";
import { useMcpConnection } from "@/hooks/use-mcp-connection";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import type { InspectorConnectionStatus, McpServerInstance } from "@/types";

export function InspectorPage() {
  const { t } = useTranslation();
  const {
    mcpServers,
    inspectorSelectedServerId,
    setInspectorSelectedServerId,
    inspectorNotifications,
    addInspectorNotification,
    removeInspectorNotification,
    clearInspectorNotifications,
  } = useAppStore();

  // Get the selected server
  const selectedServer = mcpServers.find((s) => s.id === inspectorSelectedServerId);

  // Build server URL for connection
  const getServerUrl = (server: McpServerInstance | undefined) => {
    if (!server || server.transport === "stdio") return "";
    const port = server.port || 3000;
    return `http://localhost:${port}`;
  };

  // Get transport type for the hook
  const getTransportType = (server: McpServerInstance | undefined): "sse" | "http" => {
    if (!server) return "sse";
    return server.transport === "http" ? "http" : "sse";
  };

  const [isConnecting, setIsConnecting] = useState(false);

  // MCP connection hook
  const {
    connectionStatus,
    serverCapabilities,
    connect,
    disconnect,
    makeRequest,
  } = useMcpConnection({
    serverUrl: getServerUrl(selectedServer),
    transportType: getTransportType(selectedServer),
    onNotification: useCallback(
      (method: string, params?: Record<string, unknown>) => {
        addInspectorNotification({
          method,
          params,
          type: "notification",
        });
      },
      [addInspectorNotification]
    ),
    onStdErrNotification: useCallback(
      (content: string) => {
        addInspectorNotification({
          method: "notifications/stderr",
          params: { content },
          type: "stderr",
        });
      },
      [addInspectorNotification]
    ),
    enabled: !!selectedServer && selectedServer.transport !== "stdio",
  });

  // Auto-disconnect when server changes
  useEffect(() => {
    if (connectionStatus === "connected") {
      disconnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectorSelectedServerId]); // Intentionally only trigger on server change

  const handleConnect = async () => {
    if (!selectedServer) return;

    if (connectionStatus === "connected") {
      // Reconnect
      await disconnect();
      setIsConnecting(true);
      try {
        await connect();
      } catch (error) {
        console.error("Reconnection failed:", error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      setIsConnecting(true);
      try {
        await connect();
      } catch (error) {
        console.error("Connection failed:", error);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const getConnectionStatusInfo = (status: InspectorConnectionStatus) => {
    switch (status) {
      case "connected":
        return { text: t("inspector.connected"), color: "text-green-600 dark:text-green-400" };
      case "connecting":
        return { text: t("inspector.connecting"), color: "text-yellow-600 dark:text-yellow-400" };
      case "error":
        return { text: t("inspector.error"), color: "text-red-600 dark:text-red-400" };
      default:
        return { text: t("inspector.disconnected"), color: "text-muted-foreground" };
    }
  };

  const connectionInfo = getConnectionStatusInfo(connectionStatus);

  // Filter servers - show all servers, but only SSE/HTTP can connect
  const availableServers = mcpServers;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <SearchCode className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t("inspector.title")}
            </h1>
            <p className="text-muted-foreground">{t("inspector.subtitle")}</p>
          </div>
        </div>

        <Separator />

        {/* MCP Server Selection - Single Row Layout */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium">
            {t("inspector.serverSelection")}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="justify-between min-w-[300px]"
              >
                <span>
                  {selectedServer
                    ? selectedServer.name
                    : t("inspector.selectServer")}
                </span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px]">
              {availableServers.length === 0 ? (
                <DropdownMenuItem disabled>
                  {t("inspector.noServersAvailable")}
                </DropdownMenuItem>
              ) : (
                availableServers.map((server) => (
                  <DropdownMenuItem
                    key={server.id}
                    onClick={() => setInspectorSelectedServerId(server.id)}
                    className="flex flex-col items-start gap-1"
                  >
                    <div className="font-medium">{server.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {server.transport.toUpperCase()}
                      {server.port && ` • Port ${server.port}`}
                      {server.status === "running" && " • Running"}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connection Status and Controls */}
          {selectedServer && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("inspector.status")}:
              </span>
              <span className={`text-sm font-medium ${connectionInfo.color}`}>
                {connectionInfo.text}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                disabled={
                  isConnecting ||
                  connectionStatus === "connecting" ||
                  selectedServer.transport === "stdio" ||
                  selectedServer.status !== "running"
                }
              >
                {isConnecting || connectionStatus === "connecting" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("inspector.connecting")}
                  </>
                ) : connectionStatus === "connected" ? (
                  t("inspector.reconnect")
                ) : (
                  t("inspector.connect")
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Warning Messages */}
        {selectedServer && selectedServer.transport === "stdio" && (
          <div className="text-sm text-orange-600 dark:text-orange-400">
            ⚠️ {t("inspector.stdioNotSupported")}
          </div>
        )}
        {selectedServer && selectedServer.status !== "running" && selectedServer.transport !== "stdio" && (
          <div className="text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ {t("inspector.serverNotRunning")}
          </div>
        )}
      </div>

      {/* Inspector Content */}
      <div className="rounded-lg border p-6">
        {selectedServer ? (
          connectionStatus === "connected" ? (
            <Inspector
              makeRequest={makeRequest}
              serverCapabilities={serverCapabilities}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {connectionStatus === "connecting"
                  ? t("inspector.connectingToServer")
                  : t("inspector.connectToStart")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {t("inspector.connectToStartDesc")}
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t("inspector.noServerSelected")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("inspector.noServerSelectedDesc")}
            </p>
          </div>
        )}
      </div>

      {/* Notifications Panel - Always visible */}
      <NotificationsPanel
        notifications={inspectorNotifications}
        onClearNotifications={clearInspectorNotifications}
        onRemoveNotification={removeInspectorNotification}
      />
    </div>
  );
}
