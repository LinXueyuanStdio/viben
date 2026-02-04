import { useState, useCallback, useEffect } from "react";
import {
  SearchCode,
  ChevronDown,
  Plug,
  Unplug,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
      await disconnect();
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

  const getStatusIcon = (status: InspectorConnectionStatus) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: InspectorConnectionStatus) => {
    switch (status) {
      case "connected":
        return <Badge variant="success">{t("inspector.connected")}</Badge>;
      case "connecting":
        return <Badge variant="secondary">{t("inspector.connecting")}</Badge>;
      case "error":
        return <Badge variant="destructive">{t("inspector.error")}</Badge>;
      default:
        return <Badge variant="outline">{t("inspector.disconnected")}</Badge>;
    }
  };

  const getServerStatusDot = (server: McpServerInstance) => {
    if (server.status === "running") {
      return <div className="h-2 w-2 rounded-full bg-green-500" />;
    } else if (server.status === "error") {
      return <div className="h-2 w-2 rounded-full bg-red-500" />;
    }
    return <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />;
  };

  // Filter servers to only show SSE/HTTP (stdio not supported for inspection)
  const availableServers = mcpServers.filter((s) => s.transport !== "stdio");

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <SearchCode className="h-6 w-6" />
          {t("inspector.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("inspector.subtitle")}
        </p>
      </div>

      {/* Server Selection Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("inspector.serverConnection")}</CardTitle>
              <CardDescription>{t("inspector.serverConnectionDesc")}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {getStatusIcon(connectionStatus)}
              {getStatusBadge(connectionStatus)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {/* Server Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-between">
                  {selectedServer ? (
                    <div className="flex items-center gap-2">
                      {getServerStatusDot(selectedServer)}
                      <span>{selectedServer.name}</span>
                      <Badge variant="outline" className="ml-1 text-xs">
                        {selectedServer.transport.toUpperCase()}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{t("inspector.selectServer")}</span>
                  )}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[280px]">
                <DropdownMenuLabel>{t("inspector.availableServers")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableServers.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {t("inspector.noServersAvailable")}
                  </div>
                ) : (
                  availableServers.map((server) => (
                    <DropdownMenuItem
                      key={server.id}
                      onClick={() => setInspectorSelectedServerId(server.id)}
                      className="flex items-center gap-2"
                    >
                      {getServerStatusDot(server)}
                      <div className="flex-1">
                        <div className="font-medium">{server.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {server.transport.toUpperCase()} - Port {server.port || 3000}
                        </div>
                      </div>
                      {server.status === "running" && (
                        <Badge variant="success" className="text-xs">
                          {t("common.running")}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Connect Button */}
            <Button
              onClick={handleConnect}
              disabled={!selectedServer || selectedServer.status !== "running" || isConnecting}
              variant={connectionStatus === "connected" ? "outline" : "default"}
            >
              {isConnecting || connectionStatus === "connecting" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("inspector.connecting")}
                </>
              ) : connectionStatus === "connected" ? (
                <>
                  <Unplug className="h-4 w-4 mr-2" />
                  {t("inspector.disconnect")}
                </>
              ) : (
                <>
                  <Plug className="h-4 w-4 mr-2" />
                  {t("inspector.connect")}
                </>
              )}
            </Button>
          </div>

          {/* Connection Info */}
          {selectedServer && selectedServer.status !== "running" && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-sm">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                {t("inspector.serverNotRunning")}
              </div>
            </div>
          )}

          {selectedServer && selectedServer.transport === "stdio" && (
            <div className="mt-4 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-sm">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                <AlertCircle className="h-4 w-4" />
                {t("inspector.stdioNotSupported")}
              </div>
            </div>
          )}

          {/* Server Capabilities */}
          {connectionStatus === "connected" && serverCapabilities && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {t("inspector.serverCapabilities")}
              </div>
              <div className="flex flex-wrap gap-2">
                {serverCapabilities.tools && (
                  <Badge variant="outline">{t("inspector.tools")}</Badge>
                )}
                {serverCapabilities.resources && (
                  <Badge variant="outline">{t("inspector.resources")}</Badge>
                )}
                {serverCapabilities.prompts && (
                  <Badge variant="outline">{t("inspector.prompts")}</Badge>
                )}
                {serverCapabilities.roots && (
                  <Badge variant="outline">{t("inspector.roots")}</Badge>
                )}
                {serverCapabilities.sampling && (
                  <Badge variant="outline">{t("inspector.sampling")}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications Panel */}
      {inspectorNotifications.length > 0 && (
        <NotificationsPanel
          notifications={inspectorNotifications}
          onClearNotifications={clearInspectorNotifications}
          onRemoveNotification={removeInspectorNotification}
        />
      )}

      {/* Inspector Tabs */}
      {connectionStatus === "connected" ? (
        <Card>
          <CardContent className="pt-6">
            <Inspector makeRequest={makeRequest} serverCapabilities={serverCapabilities} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <SearchCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("inspector.notConnected")}</h3>
              <p className="text-sm">{t("inspector.notConnectedDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
