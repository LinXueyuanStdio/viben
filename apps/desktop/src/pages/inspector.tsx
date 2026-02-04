import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Play,
  RotateCcw,
  RefreshCwOff,
  Copy,
  Check,
  Files,
  MessageSquare,
  Wrench,
  Zap,
  FolderTree,
  Hash,
  Server,
  AlertCircle,
  Loader2,
  Shield,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inspector, NotificationsPanel } from "@/components/inspector";
import {
  useMcpConnection,
  parseMcpConfig,
  validateMcpConfig,
  isBrowserCompatible,
  type McpServerConfig,
} from "@/hooks/use-mcp-connection";
import { useMcpProxy, buildProxyUrl, buildProxyHeaders } from "@/hooks/use-mcp-proxy";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import type { InspectorConnectionStatus } from "@/types";

// Default MCP server config example - now with proxy support
const DEFAULT_CONFIG: McpServerConfig = {
  transport: "streamable-http",
  url: "http://localhost:8000/mcp",
};

export function InspectorPage() {
  const { t } = useTranslation();
  const {
    inspectorNotifications,
    addInspectorNotification,
    clearInspectorNotifications,
  } = useAppStore();

  // MCP Proxy hook
  const {
    status: proxyStatus,
    isLoading: proxyLoading,
    error: proxyError,
    isInstalled: proxyInstalled,
    startProxy,
    stopProxy,
    installProxy,
  } = useMcpProxy();

  // Use proxy mode state
  const [useProxy, setUseProxy] = useState(true);

  // JSON config state
  const [configJson, setConfigJson] = useState<string>(() => {
    const saved = localStorage.getItem("inspector_config");
    if (saved) {
      try {
        JSON.parse(saved);
        return saved;
      } catch {
        return JSON.stringify(DEFAULT_CONFIG, null, 2);
      }
    }
    return JSON.stringify(DEFAULT_CONFIG, null, 2);
  });

  // Parse config and validation
  const [parseError, setParseError] = useState<string | null>(null);
  const parsedConfig = useMemo<McpServerConfig | null>(() => {
    try {
      const config = parseMcpConfig(configJson);
      const validation = validateMcpConfig(config);
      if (!validation.valid) {
        setParseError(validation.error || "Invalid configuration");
        return null;
      }
      setParseError(null);
      return config;
    } catch (e) {
      setParseError((e as Error).message);
      return null;
    }
  }, [configJson]);

  // Build effective config for connection (with proxy if enabled)
  const effectiveConfig = useMemo<McpServerConfig | null>(() => {
    if (!parsedConfig) return null;

    // If not using proxy, use original config
    if (!useProxy || !proxyStatus?.running || !proxyStatus?.auth_token) {
      return parsedConfig;
    }

    // If using proxy, wrap the URL
    if ("url" in parsedConfig && parsedConfig.url) {
      const proxyUrl = proxyStatus.url || "http://127.0.0.1:6277";
      const targetUrl = parsedConfig.url;
      const originalTransport = parsedConfig.transport || "streamable-http";

      const effectiveUrl = buildProxyUrl(proxyUrl, targetUrl, originalTransport as "stdio" | "sse" | "streamable-http");
      const effectiveHeaders = {
        ...parsedConfig.headers,
        ...buildProxyHeaders(proxyStatus.auth_token, parsedConfig.headers),
      };

      return {
        ...parsedConfig,
        // Connection to proxy is always streamable-http, regardless of target transport
        transport: "streamable-http" as const,
        url: effectiveUrl,
        headers: effectiveHeaders,
      };
    }

    return parsedConfig;
  }, [parsedConfig, useProxy, proxyStatus]);

  // Check if config can connect
  const canConnect = useMemo(() => {
    if (!parsedConfig || parseError) return false;
    // With proxy, we can connect even without browser compatibility
    if (useProxy && proxyStatus?.running) return true;
    return isBrowserCompatible(parsedConfig);
  }, [parsedConfig, parseError, useProxy, proxyStatus]);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Examples collapsed state
  const [examplesCollapsed, setExamplesCollapsed] = useState(true);

  // Sidebar dragging
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Bottom panel dragging
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [isBottomDragging, setIsBottomDragging] = useState(false);
  const bottomDragStartY = useRef(0);
  const bottomDragStartHeight = useRef(0);

  // Connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("tools");

  // Auto-start proxy when entering page if installed
  useEffect(() => {
    if (proxyInstalled && !proxyStatus?.running && useProxy && !proxyLoading) {
      startProxy().catch(console.error);
    }
  }, [proxyInstalled, proxyStatus?.running, useProxy, proxyLoading, startProxy]);

  // Persist config to localStorage
  useEffect(() => {
    localStorage.setItem("inspector_config", configJson);
  }, [configJson]);

  // Handle sidebar drag
  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.min(Math.max(dragStartWidth.current + delta, 300), 600);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Handle bottom panel drag
  const handleBottomDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsBottomDragging(true);
    bottomDragStartY.current = e.clientY;
    bottomDragStartHeight.current = bottomPanelHeight;
  }, [bottomPanelHeight]);

  useEffect(() => {
    if (!isBottomDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = bottomDragStartY.current - e.clientY;
      const newHeight = Math.min(Math.max(bottomDragStartHeight.current + delta, 100), 500);
      setBottomPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsBottomDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isBottomDragging]);

  // MCP connection hook - uses effective config (with proxy if enabled)
  const {
    connectionStatus,
    serverCapabilities,
    connectionError,
    connect,
    disconnect,
    makeRequest,
  } = useMcpConnection({
    config: effectiveConfig,
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
    enabled: canConnect,
  });

  const handleConnect = useCallback(async () => {
    if (!canConnect) return;

    if (connectionStatus === "connected") {
      await disconnect();
    }

    setIsConnecting(true);
    try {
      await connect();
    } catch (error) {
      console.error("Connection failed:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [canConnect, connectionStatus, connect, disconnect]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleReconnect = useCallback(async () => {
    await disconnect();
    setIsConnecting(true);
    try {
      await connect();
    } catch (error) {
      console.error("Reconnection failed:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [connect, disconnect]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [configJson]);

  const getConnectionStatusInfo = (status: InspectorConnectionStatus) => {
    switch (status) {
      case "connected":
        return { text: t("inspector.connected"), color: "bg-green-500" };
      case "connecting":
        return { text: t("inspector.connecting"), color: "bg-yellow-500" };
      case "error":
        return { text: t("inspector.error"), color: "bg-red-500" };
      default:
        return { text: t("inspector.disconnected"), color: "bg-gray-500" };
    }
  };

  const connectionInfo = getConnectionStatusInfo(connectionStatus);

  // Check capabilities for tab enabling
  const hasTools = serverCapabilities?.tools !== undefined;
  const hasResources = serverCapabilities?.resources !== undefined;
  const hasPrompts = serverCapabilities?.prompts !== undefined;
  const hasRoots = serverCapabilities?.roots !== undefined;
  const hasSampling = serverCapabilities?.sampling !== undefined;

  // Check if config is STDIO (not browser compatible)
  const isStdioConfig = parsedConfig && "command" in parsedConfig;

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <div
        style={{
          width: sidebarWidth,
          minWidth: 300,
          maxWidth: 600,
          transition: isDragging ? "none" : "width 0.15s",
        }}
        className="bg-card border-r border-border flex flex-col h-full relative"
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h1 className="text-lg font-semibold">{t("inspector.title")}</h1>
        </div>

        {/* Sidebar Content */}
        <div className="p-4 flex-1 overflow-auto">
          <div className="space-y-4">
            {/* Proxy Status Section */}
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t("inspector.proxy", "Proxy")}</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProxy}
                    onChange={(e) => setUseProxy(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-xs text-muted-foreground">{t("inspector.useProxy", "Enable")}</span>
                </label>
              </div>

              {useProxy && (
                <div className="space-y-2">
                  {proxyInstalled === false && (
                    <div className="flex items-center justify-between p-2 rounded bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs">
                      <span>{t("inspector.proxyNotInstalled", "Proxy not installed")}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => installProxy()}
                        disabled={proxyLoading}
                        className="h-6 text-xs"
                      >
                        {proxyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                        {t("inspector.install", "Install")}
                      </Button>
                    </div>
                  )}

                  {proxyInstalled && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${proxyStatus?.running ? "bg-green-500" : "bg-gray-400"}`} />
                        <span className="text-xs text-muted-foreground">
                          {proxyStatus?.running
                            ? `${t("inspector.proxyRunning", "Running")} (${proxyStatus.url})`
                            : t("inspector.proxyStopped", "Stopped")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => proxyStatus?.running ? stopProxy() : startProxy()}
                        disabled={proxyLoading}
                        className="h-6 text-xs"
                      >
                        {proxyLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {proxyStatus?.running ? t("inspector.stop", "Stop") : t("inspector.start", "Start")}
                      </Button>
                    </div>
                  )}

                  {proxyError && (
                    <div className="text-xs text-red-500 dark:text-red-400">{proxyError}</div>
                  )}
                </div>
              )}
            </div>

            {/* JSON Config Label */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("inspector.serverConfig")}</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* JSON Config Textarea */}
            <div className="relative">
              <textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className={`w-full h-48 p-3 font-mono text-sm rounded-md border resize-none
                  bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring
                  ${parseError ? "border-red-500 focus:ring-red-500" : "border-input"}`}
                placeholder={JSON.stringify(DEFAULT_CONFIG, null, 2)}
                spellCheck={false}
              />
              {parseError && (
                <div className="flex items-start gap-2 mt-2 p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="break-all">{parseError}</span>
                </div>
              )}
            </div>

            {/* Config Examples - Collapsible */}
            <div className="text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setExamplesCollapsed(!examplesCollapsed)}
                className="flex items-center gap-1 font-medium hover:text-foreground transition-colors w-full text-left"
              >
                {examplesCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {t("inspector.configExamples")}
              </button>
              {!examplesCollapsed && (
                <pre className="p-2 mt-1 rounded bg-muted/50 overflow-x-auto whitespace-pre-wrap">
{`// SSE (auto-detects from /sse in URL)
{"url": "http://localhost:3000/sse"}

// Streamable HTTP
{"url": "http://localhost:3000/mcp"}

// With auth header
{
  "url": "http://localhost:3000/mcp",
  "headers": {"Authorization": "Bearer xxx"}
}

// Or use auth field
{
  "url": "http://localhost:3000/mcp",
  "auth": "your-api-key"
}`}
                </pre>
              )}
            </div>

            {/* STDIO Warning */}
            {isStdioConfig && (
              <div className="text-sm text-orange-600 dark:text-orange-400 p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                {t("inspector.stdioNotSupported")}
              </div>
            )}

            {/* Connect/Disconnect Buttons */}
            <div className="space-y-2 pt-2">
              {connectionStatus === "connected" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={handleReconnect} size="sm">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t("inspector.reconnect")}
                  </Button>
                  <Button onClick={handleDisconnect} variant="outline" size="sm">
                    <RefreshCwOff className="w-4 h-4 mr-2" />
                    {t("inspector.disconnect")}
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleConnect}
                  disabled={!canConnect || isConnecting || !!parseError}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isConnecting ? t("inspector.connecting") : t("inspector.connect")}
                </Button>
              )}

              {/* Connection Status */}
              <div className="flex items-center justify-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connectionInfo.color}`} />
                <span className="text-sm text-muted-foreground">{connectionInfo.text}</span>
              </div>

              {/* Connection Error */}
              {connectionError && connectionStatus === "error" && (
                <div className="flex items-start gap-2 p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="break-all font-mono">{connectionError}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Drag Handle */}
        <div
          onMouseDown={handleSidebarDragStart}
          style={{
            cursor: "col-resize",
            position: "absolute",
            top: 0,
            right: 0,
            width: 6,
            height: "100%",
            zIndex: 10,
            background: isDragging ? "rgba(0,0,0,0.08)" : "transparent",
          }}
          aria-label="Resize sidebar"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs Content */}
        <div className="flex-1 overflow-auto p-4">
          {connectionStatus === "connected" ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="resources" disabled={!hasResources}>
                  <Files className="w-4 h-4 mr-2" />
                  {t("inspector.resources")}
                </TabsTrigger>
                <TabsTrigger value="prompts" disabled={!hasPrompts}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t("inspector.prompts")}
                </TabsTrigger>
                <TabsTrigger value="tools" disabled={!hasTools}>
                  <Wrench className="w-4 h-4 mr-2" />
                  {t("inspector.tools")}
                </TabsTrigger>
                <TabsTrigger value="ping">
                  <Zap className="w-4 h-4 mr-2" />
                  {t("inspector.ping")}
                </TabsTrigger>
                <TabsTrigger value="sampling" disabled={!hasSampling}>
                  <Hash className="w-4 h-4 mr-2" />
                  {t("inspector.sampling")}
                </TabsTrigger>
                <TabsTrigger value="roots" disabled={!hasRoots}>
                  <FolderTree className="w-4 h-4 mr-2" />
                  {t("inspector.roots")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="resources" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="resources"
                />
              </TabsContent>
              <TabsContent value="prompts" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="prompts"
                />
              </TabsContent>
              <TabsContent value="tools" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="tools"
                />
              </TabsContent>
              <TabsContent value="ping" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="ping"
                />
              </TabsContent>
              <TabsContent value="sampling" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="sampling"
                />
              </TabsContent>
              <TabsContent value="roots" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="roots"
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Server className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg text-muted-foreground">
                {t("inspector.connectToStart")}
              </p>
              <p className="text-sm text-muted-foreground max-w-md text-center">
                {t("inspector.connectToStartDesc")}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Panel - History & Notifications */}
        <div
          className="relative border-t border-border"
          style={{ height: `${bottomPanelHeight}px` }}
        >
          {/* Drag Handle */}
          <div
            className="absolute w-full h-4 -top-2 cursor-row-resize flex items-center justify-center hover:bg-accent/50"
            onMouseDown={handleBottomDragStart}
          >
            <div className="w-8 h-1 rounded-full bg-border" />
          </div>
          <div className="h-full overflow-auto">
            <NotificationsPanel
              notifications={inspectorNotifications}
              onClearNotifications={clearInspectorNotifications}
              onRemoveNotification={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
