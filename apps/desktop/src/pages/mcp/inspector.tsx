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
  ChevronDown,
  ChevronRight,
  ListTodo,
  MessageCircleQuestion,
  KeyRound,
  Settings2,
  WrapText,
  AlignJustify,
  AppWindow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inspector, HistoryAndNotifications, ConfigManager, LoggingLevelControl, type InspectorConfig } from "@/components/inspector";
import {
  useMcpConnection,
  parseMcpConfig,
  validateMcpConfig,
  isBrowserCompatible,
  type McpServerConfig,
} from "@/hooks/use-mcp-connection";
import {
  useGatewayInspector,
  buildGatewayInspectorUrl,
  buildGatewayInspectorHeaders,
  type GatewayInspectorStatus,
} from "@/hooks/use-gateway-inspector";
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
    removeInspectorNotification,
    clearInspectorNotifications,
    inspectorHistory,
    addInspectorHistory,
    removeInspectorHistory,
    clearInspectorHistory,
  } = useAppStore();

  // Gateway Inspector hook (built-in proxy)
  const {
    status: inspectorStatus,
    isLoading: inspectorLoading,
    error: inspectorError,
    refreshStatus: refreshInspectorStatus,
  } = useGatewayInspector();

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
        setParseError(validation.error || t("inspector.invalidConfiguration"));
        return null;
      }
      setParseError(null);
      return config;
    } catch (e) {
      setParseError((e as Error).message);
      return null;
    }
  }, [configJson]);

  // Helper function to build effective config with given inspector status
  const buildEffectiveConfig = useCallback(
    (status: GatewayInspectorStatus | null): McpServerConfig | null => {
      if (!parsedConfig) return null;

      // If not using proxy, use original config
      if (!useProxy || !status?.available) {
        return parsedConfig;
      }

      // If using proxy, wrap the URL
      if ("url" in parsedConfig && parsedConfig.url) {
        const proxyUrl = status.proxyUrl;
        const targetUrl = parsedConfig.url;
        const originalTransport = parsedConfig.transport || "streamable-http";

        const effectiveUrl = buildGatewayInspectorUrl(
          proxyUrl,
          targetUrl,
          originalTransport as "stdio" | "sse" | "streamable-http"
        );
        const effectiveHeaders = {
          ...parsedConfig.headers,
          ...buildGatewayInspectorHeaders(status.authToken, parsedConfig.headers),
        };

        console.log("[Inspector] effectiveConfig:", {
          proxyUrl,
          targetUrl,
          originalTransport,
          effectiveUrl,
          effectiveHeaders,
          authToken: status.authToken ? "present" : "missing",
        });

        return {
          ...parsedConfig,
          // Connection to proxy is always streamable-http, regardless of target transport
          transport: "streamable-http" as const,
          url: effectiveUrl,
          headers: effectiveHeaders,
        };
      }

      return parsedConfig;
    },
    [parsedConfig, useProxy]
  );

  // Build effective config for connection (with Gateway Inspector proxy if enabled)
  const effectiveConfig = useMemo<McpServerConfig | null>(
    () => buildEffectiveConfig(inspectorStatus),
    [buildEffectiveConfig, inspectorStatus]
  );

  // Check if config can connect
  const canConnect = useMemo(() => {
    if (!parsedConfig || parseError) return false;
    // With Gateway Inspector proxy, we can connect even without browser compatibility
    if (useProxy && inspectorStatus?.available) return true;
    return isBrowserCompatible(parsedConfig);
  }, [parsedConfig, parseError, useProxy, inspectorStatus]);

  // Copy state
  const [copied, setCopied] = useState(false);

  // JSON wrap mode state
  const [jsonWrap, setJsonWrap] = useState(true);

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

  // Initialize activeTab from URL hash
  const [activeTab, setActiveTab] = useState<string>(() => {
    const hash = window.location.hash.slice(1);
    return hash || "tools";
  });

  // Auto-refresh Inspector status when proxy mode changes
  useEffect(() => {
    if (useProxy) {
      refreshInspectorStatus();
    }
  }, [useProxy, refreshInspectorStatus]);

  // Listen for browser back/forward navigation (hash change)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && hash !== activeTab) {
        setActiveTab(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeTab]);

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
    makeRequest: rawMakeRequest,
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

  // Validate hash against available tabs when connection status changes
  useEffect(() => {
    if (connectionStatus === "connected" && serverCapabilities) {
      const hash = window.location.hash.slice(1);
      const validTabs = [
        "tools",
        "resources",
        "prompts",
        "ping",
        "sampling",
        "roots",
        "tasks",
        "elicitations",
        "auth",
        "metadata",
        "apps",
      ];

      const isValidTab = validTabs.includes(hash);

      if (!isValidTab) {
        // Default to tools if hash is invalid
        const defaultTab = "tools";
        setActiveTab(defaultTab);
        window.location.hash = defaultTab;
      }
    }
  }, [connectionStatus, serverCapabilities]);

  // Wrap makeRequest to record history
  const makeRequest = useCallback(
    async <T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> => {
      const startTime = Date.now();
      try {
        const response = await rawMakeRequest<T>(method, params);
        const duration = Date.now() - startTime;
        addInspectorHistory({
          method,
          params,
          response,
          duration,
          status: "success",
        });
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        addInspectorHistory({
          method,
          params,
          duration,
          status: "error",
          error: errorMessage,
        });
        throw error;
      }
    },
    [rawMakeRequest, addInspectorHistory]
  );

  const handleConnect = useCallback(async () => {
    console.log("[Inspector] handleConnect called", {
      canConnect,
      connectionStatus,
      useProxy,
      currentInspectorStatus: inspectorStatus,
    });

    if (!canConnect) {
      console.log("[Inspector] Cannot connect - canConnect is false");
      return;
    }

    if (connectionStatus === "connected") {
      console.log("[Inspector] Already connected, disconnecting first...");
      await disconnect();
    }

    setIsConnecting(true);
    try {
      // When using proxy, refresh status to get fresh auth token before connecting
      // This handles the case where gateway was restarted and token changed
      if (useProxy) {
        console.log("[Inspector] Using proxy mode, refreshing status for fresh token...");
        const freshStatus = await refreshInspectorStatus();
        console.log("[Inspector] Fresh status received:", {
          available: freshStatus?.available,
          authToken: freshStatus?.authToken ? `${freshStatus.authToken.slice(0, 8)}...` : null,
          authDisabled: freshStatus?.authDisabled,
          proxyUrl: freshStatus?.proxyUrl,
        });

        // Build config with fresh status and pass it to connect
        const freshConfig = buildEffectiveConfig(freshStatus);
        console.log("[Inspector] Fresh config built:", {
          url: freshConfig && "url" in freshConfig ? freshConfig.url : undefined,
          transport: freshConfig?.transport,
          headers: freshConfig && "headers" in freshConfig && freshConfig.headers ? Object.keys(freshConfig.headers) : [],
          hasXMcpProxyAuth: freshConfig && "headers" in freshConfig && freshConfig.headers?.["X-MCP-Proxy-Auth"] ? "yes" : "no",
        });

        if (freshConfig) {
          console.log("[Inspector] Connecting with fresh config...");
          await connect(freshConfig);
        } else {
          console.error("[Inspector] Failed to build config with fresh status");
        }
      } else {
        console.log("[Inspector] Direct mode (no proxy), connecting with effectiveConfig...");
        await connect();
      }
    } catch (error) {
      console.error("[Inspector] Connection failed:", error);
    } finally {
      setIsConnecting(false);
    }
  }, [canConnect, connectionStatus, connect, disconnect, useProxy, refreshInspectorStatus, buildEffectiveConfig, inspectorStatus]);

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

  // Handle config JSON change with auto-format on valid JSON
  const handleConfigJsonChange = useCallback((value: string) => {
    // Try to parse and format if valid JSON
    try {
      const parsed = JSON.parse(value);
      // Only auto-format if the JSON is complete (not while typing)
      // Check if the value ends with a complete JSON structure
      const trimmed = value.trim();
      if (trimmed.endsWith('}') || trimmed.endsWith(']')) {
        setConfigJson(JSON.stringify(parsed, null, 2));
        return;
      }
    } catch {
      // Not valid JSON yet, keep as-is
    }
    setConfigJson(value);
  }, []);

  // Convert InspectorConfig to McpServerConfig JSON string
  const convertInspectorConfigToJson = useCallback((importedConfig: InspectorConfig): string => {
    const mcpConfig: Record<string, unknown> = {};

    // Set transport type
    if (importedConfig.transport.type) {
      mcpConfig.transport = importedConfig.transport.type;
    }

    // Handle remote config (url-based)
    if (importedConfig.transport.url) {
      mcpConfig.url = importedConfig.transport.url;
    }

    // Handle STDIO config
    if (importedConfig.transport.command) {
      mcpConfig.command = importedConfig.transport.command;
      if (importedConfig.transport.args) {
        mcpConfig.args = importedConfig.transport.args;
      }
      if (importedConfig.transport.env) {
        mcpConfig.env = importedConfig.transport.env;
      }
      if (importedConfig.transport.cwd) {
        mcpConfig.cwd = importedConfig.transport.cwd;
      }
    }

    // Handle headers
    if (importedConfig.transport.headers) {
      mcpConfig.headers = importedConfig.transport.headers;
    }

    // Handle auth
    if (importedConfig.auth?.token) {
      mcpConfig.auth = importedConfig.auth.token;
    }

    // Handle timeout
    if (importedConfig.transport.timeout) {
      mcpConfig.timeout = importedConfig.transport.timeout;
    }

    return JSON.stringify(mcpConfig, null, 2);
  }, []);

  // Handle config import from ConfigManager
  const handleConfigImport = useCallback((importedConfig: InspectorConfig) => {
    // Update proxy setting
    if (importedConfig.proxy?.enabled !== undefined) {
      setUseProxy(importedConfig.proxy.enabled);
    }

    // Set the new config JSON
    setConfigJson(convertInspectorConfigToJson(importedConfig));
  }, [convertInspectorConfigToJson]);

  // Handle loading saved config
  const handleLoadSavedConfig = useCallback((config: InspectorConfig, savedUseProxy: boolean) => {
    // Update proxy setting from saved config
    setUseProxy(savedUseProxy);
    // Set the config JSON
    setConfigJson(convertInspectorConfigToJson(config));
  }, [convertInspectorConfigToJson]);

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
  const hasLogging = serverCapabilities?.logging !== undefined;
  // Tasks capability check - MCP 2024-11-05 added tasks support
  const hasTasks = (serverCapabilities as Record<string, unknown>)?.tasks !== undefined;

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
                  {inspectorLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>{t("inspector.checkingProxy", "Checking...")}</span>
                    </div>
                  )}

                  {!inspectorLoading && inspectorStatus && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${inspectorStatus.available ? "bg-green-500" : "bg-gray-400"}`} />
                        <span className="text-xs text-muted-foreground">
                          {inspectorStatus.available
                            ? `${t("inspector.proxyBuiltIn", "Built-in")} (${inspectorStatus.sessions} ${t("inspector.sessions", "sessions")})`
                            : t("inspector.proxyUnavailable", "Unavailable")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => refreshInspectorStatus()}
                        disabled={inspectorLoading}
                        className="h-6 text-xs"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {!inspectorLoading && inspectorStatus?.available && (
                    <div className="text-xs text-muted-foreground">
                      {inspectorStatus.authDisabled
                        ? t("inspector.authDisabled", "Auth: disabled")
                        : t("inspector.authEnabled", "Auth: enabled")}
                    </div>
                  )}

                  {inspectorError && (
                    <div className="text-xs text-red-500 dark:text-red-400">{inspectorError}</div>
                  )}
                </div>
              )}
            </div>

            {/* JSON Config Label */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("inspector.serverConfig")}</label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setJsonWrap(!jsonWrap)}
                  className={`h-7 px-2 ${jsonWrap ? "text-primary" : "text-muted-foreground"}`}
                  title={jsonWrap ? t("inspector.nowrap", "No Wrap") : t("inspector.wrap", "Wrap")}
                >
                  {jsonWrap ? (
                    <WrapText className="h-3.5 w-3.5" />
                  ) : (
                    <AlignJustify className="h-3.5 w-3.5" />
                  )}
                </Button>
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
            </div>

            {/* JSON Config Textarea */}
            <div className="relative">
              <textarea
                value={configJson}
                onChange={(e) => handleConfigJsonChange(e.target.value)}
                className={`w-full h-48 p-3 font-mono text-sm rounded-md border resize-none
                  bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring
                  ${parseError ? "border-red-500 focus:ring-red-500" : "border-input"}
                  ${jsonWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"}`}
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

            {/* Config Export/Import */}
            <ConfigManager
              config={parsedConfig}
              configJson={configJson}
              useProxy={useProxy}
              onImport={handleConfigImport}
              onLoadSavedConfig={handleLoadSavedConfig}
            />

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

            {/* Logging Level Control - only shown when connected and logging is supported */}
            <LoggingLevelControl
              enabled={hasLogging}
              connectionStatus={connectionStatus}
              makeRequest={makeRequest}
            />
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
          aria-label={t("common.resizeSidebar")}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs Content */}
        <div className="flex-1 overflow-auto p-4">
          {connectionStatus === "connected" ? (
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value);
                window.location.hash = value;
              }}
              className="w-full"
            >
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="tools" disabled={!hasTools}>
                  <Wrench className="w-4 h-4 mr-2" />
                  {t("inspector.tools")}
                </TabsTrigger>
                <TabsTrigger value="resources" disabled={!hasResources}>
                  <Files className="w-4 h-4 mr-2" />
                  {t("inspector.resources")}
                </TabsTrigger>
                <TabsTrigger value="prompts" disabled={!hasPrompts}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {t("inspector.prompts")}
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
                <TabsTrigger value="tasks" disabled={!hasTasks}>
                  <ListTodo className="w-4 h-4 mr-2" />
                  {t("inspector.tasks")}
                </TabsTrigger>
                <TabsTrigger value="elicitations">
                  <MessageCircleQuestion className="w-4 h-4 mr-2" />
                  {t("inspector.elicitations")}
                </TabsTrigger>
                <TabsTrigger value="auth">
                  <KeyRound className="w-4 h-4 mr-2" />
                  {t("inspector.auth")}
                </TabsTrigger>
                <TabsTrigger value="metadata">
                  <Settings2 className="w-4 h-4 mr-2" />
                  {t("inspector.metadata")}
                </TabsTrigger>
                <TabsTrigger value="apps" disabled={!hasTools}>
                  <AppWindow className="w-4 h-4 mr-2" />
                  {t("inspector.apps", "Apps")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tools" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="tools"
                />
              </TabsContent>
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
              <TabsContent value="tasks" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="tasks"
                />
              </TabsContent>
              <TabsContent value="elicitations" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="elicitations"
                />
              </TabsContent>
              <TabsContent value="auth" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="auth"
                />
              </TabsContent>
              <TabsContent value="metadata" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="metadata"
                />
              </TabsContent>
              <TabsContent value="apps" className="mt-0">
                <Inspector
                  makeRequest={makeRequest}
                  serverCapabilities={serverCapabilities}
                  activeTab="apps"
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Server className="h-10 w-10 text-muted-foreground/50" />
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
            className="absolute w-full h-4 -top-2 cursor-row-resize flex items-center justify-center hover:bg-accent/50 z-10"
            onMouseDown={handleBottomDragStart}
          >
            <div className="w-8 h-1 rounded-full bg-border" />
          </div>
          <div className="h-full overflow-hidden">
            <HistoryAndNotifications
              history={inspectorHistory}
              notifications={inspectorNotifications}
              onClearHistory={clearInspectorHistory}
              onRemoveHistory={removeInspectorHistory}
              onClearNotifications={clearInspectorNotifications}
              onRemoveNotification={removeInspectorNotification}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
