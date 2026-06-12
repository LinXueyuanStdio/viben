import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AppWindow,
  Play,
  Loader2,
  Search,
  AlertTriangle,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import type { McpTool } from "@/types";
import DynamicJsonForm, {
  type DynamicJsonFormRef,
  type JsonValue,
  type JsonSchemaType,
  generateDefaultValue,
} from "./dynamic-json-form";
import { cn } from "@/lib/utils";
import {
  type SandboxSecurityResult,
  type SandboxToInspectorMessage,
  getSandboxProxyUrl,
  isSandboxMessage,
  isAppMessage,
  isAllowedOrigin,
  DEFAULT_ALLOWED_ORIGINS,
} from "./sandbox-security";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

interface InspectorAppsProps {
  makeRequest: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  enabled?: boolean;
}

interface ExtendedMcpTool extends McpTool {
  _meta?: {
    ui?: {
      resourceUri?: string;
      icon?: string;
      title?: string;
    };
    [key: string]: unknown;
  };
}

interface ToolCallResult {
  content?: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      uri?: string;
      text?: string;
      blob?: string;
      mimeType?: string;
    };
  }>;
  isError?: boolean;
  _meta?: {
    ui?: {
      resourceUri?: string;
    };
    [key: string]: unknown;
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a tool has UI metadata (can be rendered as an app)
 */
function hasUIMetadata(tool: ExtendedMcpTool): boolean {
  return !!(tool._meta?.ui?.resourceUri);
}

/**
 * Get UI resource URI from tool metadata
 */
function getToolUiResourceUri(tool: ExtendedMcpTool): string | undefined {
  return tool._meta?.ui?.resourceUri;
}

/**
 * Get UI resource URI from tool result
 */
function getResultUiResourceUri(result: ToolCallResult): string | undefined {
  return result._meta?.ui?.resourceUri;
}

/**
 * Clone tool params safely
 */
function cloneToolParams(source: Record<string, unknown>): Record<string, unknown> {
  try {
    return structuredClone(source);
  } catch {
    return { ...source };
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function InspectorApps({ makeRequest, enabled = true }: InspectorAppsProps) {
  const { t } = useTranslation();

  // Tool list state
  const [allTools, setAllTools] = useState<ExtendedMcpTool[]>([]);
  const [appTools, setAppTools] = useState<ExtendedMcpTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected app state
  const [selectedTool, setSelectedTool] = useState<ExtendedMcpTool | null>(null);
  const [params, setParams] = useState<Record<string, JsonValue>>({});
  const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const formRefs = useRef<Record<string, DynamicJsonFormRef | null>>({});

  // App execution state
  const [isAppOpen, setIsAppOpen] = useState(false);
  const [isOpeningApp, setIsOpeningApp] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Submitted state
  const [submittedParams, setSubmittedParams] = useState<Record<string, unknown> | undefined>();
  const [submittedToolResult, setSubmittedToolResult] = useState<ToolCallResult | null>(null);
  const [appResourceUri, setAppResourceUri] = useState<string | null>(null);

  // Ref for tracking current execution
  const openAppRunIdRef = useRef(0);

  // ==========================================================================
  // Filter app tools from all tools
  // ==========================================================================

  useEffect(() => {
    const filtered = allTools.filter(hasUIMetadata);
    console.log("[InspectorApps] Filtered app tools:", {
      totalTools: allTools.length,
      appTools: filtered.length,
      appToolNames: filtered.map((t) => t.name),
    });
    setAppTools(filtered);

    // If current selected tool is no longer available, reset selection
    if (selectedTool && !filtered.find((t) => t.name === selectedTool.name)) {
      handleDeselectTool();
    }
  }, [allTools, selectedTool]);

  // ==========================================================================
  // Initialize params when tool changes
  // ==========================================================================

  useEffect(() => {
    if (!selectedTool) {
      setParams({});
      setHasValidationErrors(false);
      formRefs.current = {};
      return;
    }

    const initialParams = buildInitialParams(selectedTool);
    setParams(initialParams);
    setHasValidationErrors(false);
    formRefs.current = {};
    setIsAppOpen(false);
    setSubmittedParams(undefined);
    setSubmittedToolResult(null);
    setAppResourceUri(null);
    setExecutionError(null);
  }, [selectedTool]);

  // ==========================================================================
  // Build initial params from tool schema
  // ==========================================================================

  const buildInitialParams = useCallback((tool: ExtendedMcpTool): Record<string, JsonValue> => {
    const properties = (tool.inputSchema?.properties as Record<string, JsonSchemaType>) || {};
    const initialParams: Record<string, JsonValue> = {};

    for (const [key, schema] of Object.entries(properties)) {
      initialParams[key] = generateDefaultValue(schema);
    }

    return initialParams;
  }, []);

  // ==========================================================================
  // Filter tools by search
  // ==========================================================================

  const filteredAppTools = useMemo(() => {
    if (!searchQuery.trim()) return appTools;
    const query = searchQuery.toLowerCase();
    return appTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
    );
  }, [appTools, searchQuery]);

  // ==========================================================================
  // Fetch tools from MCP server
  // ==========================================================================

  const fetchTools = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    try {
      const response = await makeRequest<{ tools: ExtendedMcpTool[] }>("tools/list", {});
      setAllTools(response.tools || []);
    } catch (error) {
      console.error("Error listing tools:", error);
      setAllTools([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, makeRequest]);

  // ==========================================================================
  // Check validation errors
  // ==========================================================================

  const checkValidationErrors = useCallback((): boolean => {
    const errors = Object.values(formRefs.current).some(
      (ref) => ref && !ref.validateJson().isValid
    );
    setHasValidationErrors(errors);
    return errors;
  }, []);

  // ==========================================================================
  // Execute tool and open app
  // ==========================================================================

  const executeToolAndOpenApp = useCallback(
    async (tool: ExtendedMcpTool, toolParams: Record<string, unknown>) => {
      const runId = ++openAppRunIdRef.current;
      const runParams = cloneToolParams(toolParams);

      setIsOpeningApp(true);
      setSubmittedParams(runParams);
      setSubmittedToolResult(null);
      setAppResourceUri(null);
      setExecutionError(null);

      try {
        const result = await makeRequest<ToolCallResult>("tools/call", {
          name: tool.name,
          arguments: runParams,
        });

        // Check if this is still the current execution
        if (runId !== openAppRunIdRef.current) {
          return;
        }

        setSubmittedParams(runParams);
        setSubmittedToolResult(result);

        // Get resource URI from result or tool metadata
        const resultUri = getResultUiResourceUri(result);
        const toolUri = getToolUiResourceUri(tool);
        const resourceUri = resultUri || toolUri;

        if (resourceUri) {
          setAppResourceUri(resourceUri);
          setIsAppOpen(true);
        } else {
          // No UI resource, show result as JSON
          setIsAppOpen(true);
        }
      } catch (error) {
        if (runId !== openAppRunIdRef.current) {
          return;
        }

        const errorMsg = error instanceof Error ? error.message : String(error);
        setExecutionError(errorMsg);
        setSubmittedToolResult(null);
        setIsAppOpen(false);
      } finally {
        if (runId === openAppRunIdRef.current) {
          setIsOpeningApp(false);
        }
      }
    },
    [makeRequest]
  );

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSelectTool = useCallback(
    (tool: ExtendedMcpTool) => {
      openAppRunIdRef.current += 1;
      setIsOpeningApp(false);
      setSelectedTool(tool);
      setSubmittedParams(undefined);
      setSubmittedToolResult(null);
      setAppResourceUri(null);
      setExecutionError(null);

      // Check if tool has no required params, auto-execute
      const hasFields =
        tool.inputSchema?.properties &&
        Object.keys(tool.inputSchema.properties).length > 0;

      if (!hasFields) {
        const initialParams = buildInitialParams(tool);
        void executeToolAndOpenApp(tool, initialParams);
      } else {
        setIsAppOpen(false);
      }
    },
    [buildInitialParams, executeToolAndOpenApp]
  );

  const handleDeselectTool = useCallback(() => {
    openAppRunIdRef.current += 1;
    setIsOpeningApp(false);
    setSelectedTool(null);
    setIsAppOpen(false);
    setIsMaximized(false);
    setSubmittedParams(undefined);
    setSubmittedToolResult(null);
    setAppResourceUri(null);
    setExecutionError(null);
  }, []);

  const handleOpenApp = useCallback(async () => {
    if (!selectedTool || checkValidationErrors()) {
      return;
    }

    await executeToolAndOpenApp(selectedTool, params as Record<string, unknown>);
  }, [checkValidationErrors, executeToolAndOpenApp, params, selectedTool]);

  const handleCloseApp = useCallback(() => {
    openAppRunIdRef.current += 1;
    setIsOpeningApp(false);
    setIsAppOpen(false);
    setSubmittedToolResult(null);
    setAppResourceUri(null);
  }, []);

  // ==========================================================================
  // Render helpers
  // ==========================================================================

  const hasFields = selectedTool?.inputSchema?.properties &&
    Object.keys(selectedTool.inputSchema.properties).length > 0;

  // ==========================================================================
  // Render - Disabled state
  // ==========================================================================

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
        <h4 className="text-sm font-medium">{t("inspector.appsNotSupported")}</h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t("inspector.appsNotSupportedDesc")}
        </p>
      </div>
    );
  }

  // ==========================================================================
  // Render - Main layout
  // ==========================================================================

  return (
    <div className={cn(
      "flex h-full gap-4",
      isMaximized && "flex-col"
    )}>
      {/* Left Panel - App List */}
      {!isMaximized && (
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-border pr-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AppWindow className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">{t("inspector.mcpApps")}</span>
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {appTools.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={fetchTools}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t("inspector.searchApps")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* App List */}
          <div className="flex-1 overflow-auto space-y-1">
            {appTools.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AppWindow className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {t("inspector.noAppsFound")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("inspector.appsHint")}
                </p>
                <Button size="sm" className="mt-3" onClick={fetchTools} disabled={loading}>
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  {t("inspector.refreshApps")}
                </Button>
              </div>
            ) : filteredAppTools.length === 0 ? (
              <div className="text-center p-4 text-xs text-muted-foreground">
                {t("inspector.noAppsMatching", { query: searchQuery })}
              </div>
            ) : (
              filteredAppTools.map((tool) => (
                <div
                  key={tool.name}
                  onClick={() => handleSelectTool(tool)}
                  className={cn(
                    "p-2.5 rounded-lg cursor-pointer transition-colors",
                    selectedTool?.name === tool.name
                      ? "bg-purple-500/10 border border-purple-500/30"
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <AppWindow className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-medium truncate">{tool.name}</div>
                      {tool.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {tool.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Right Panel - App Details & Viewer */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            {selectedTool && (
              <AppWindow className="h-4 w-4 text-purple-500" />
            )}
            <h3 className="font-semibold text-sm">
              {selectedTool ? selectedTool.name : t("inspector.selectApp")}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {selectedTool && isAppOpen && (
              <Button
                onClick={() => setIsMaximized(!isMaximized)}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={isMaximized ? t("inspector.minimize") : t("inspector.maximize")}
              >
                {isMaximized ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            )}
            {selectedTool && (
              <Button
                onClick={handleDeselectTool}
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={t("inspector.closeApp")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {executionError && (
          <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{executionError}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {selectedTool ? (
            <div className="space-y-4">
              {!isAppOpen ? (
                // Parameter Form
                <div className="space-y-4">
                  {selectedTool.description && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedTool.description}
                    </p>
                  )}

                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <h4 className="font-medium text-sm">{t("inspector.appInput")}</h4>

                    {hasFields ? (
                      Object.entries(
                        (selectedTool.inputSchema?.properties as Record<string, JsonSchemaType>) || {}
                      ).map(([key, schema]) => {
                        const required = (selectedTool.inputSchema?.required as string[])?.includes(key) ?? false;
                        return (
                          <div key={key} className="space-y-1.5">
                            <Label className="flex items-center gap-1.5 text-sm font-medium">
                              {schema.title ?? key}
                              {required && <span className="text-red-500">*</span>}
                            </Label>
                            {schema.description && (
                              <p className="text-xs text-muted-foreground">{schema.description}</p>
                            )}
                            <DynamicJsonForm
                              ref={(ref) => {
                                formRefs.current[key] = ref;
                              }}
                              schema={schema}
                              value={params[key] ?? generateDefaultValue(schema)}
                              onChange={(newValue) => {
                                setParams((prev) => ({ ...prev, [key]: newValue }));
                                setTimeout(checkValidationErrors, 100);
                              }}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("inspector.noInputRequired")}
                      </p>
                    )}

                    <Button
                      onClick={() => void handleOpenApp()}
                      className="w-full"
                      disabled={hasValidationErrors || isOpeningApp}
                    >
                      {isOpeningApp ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      {isOpeningApp
                        ? t("inspector.openingApp")
                        : t("inspector.openApp")}
                    </Button>
                  </div>
                </div>
              ) : (
                // App Viewer
                <div className="space-y-4">
                  {hasFields && (
                    <div className="flex justify-end">
                      <Button onClick={handleCloseApp} variant="outline" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t("inspector.backToInput")}
                      </Button>
                    </div>
                  )}

                  {/* App Iframe or Result Display */}
                  <div className={cn(
                    "border rounded-lg overflow-hidden bg-background",
                    isMaximized ? "h-[calc(100vh-200px)]" : "h-[500px]"
                  )}>
                    {appResourceUri ? (
                      // Render app in iframe
                      <AppViewer
                        resourceUri={appResourceUri}
                        toolInput={submittedParams}
                        toolResult={submittedToolResult}
                      />
                    ) : (
                      // Show raw result
                      <div className="p-4 h-full overflow-auto">
                        <h4 className="font-medium text-sm mb-2">{t("inspector.toolResult")}</h4>
                        <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto">
                          {JSON.stringify(submittedToolResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Empty state
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <AppWindow className="w-12 h-12 opacity-20 mb-4" />
              <p className="text-muted-foreground">
                {t("inspector.selectAppToStart")}
              </p>
              {appTools.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
                  {t("inspector.noAppsAvailable")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// App Viewer Component with Dual-Layer Sandbox Architecture
// =============================================================================

interface AppViewerProps {
  resourceUri: string;
  toolInput?: Record<string, unknown>;
  toolResult?: ToolCallResult | null;
  /** Callback when security test results are received */
  onSecurityResult?: (result: SandboxSecurityResult) => void;
}

function AppViewer({ resourceUri, toolInput, toolResult, onSecurityResult }: AppViewerProps) {
  const { t } = useTranslation();
  const sandboxRef = useRef<HTMLIFrameElement>(null);

  // Sandbox state
  const [sandboxReady, setSandboxReady] = useState(false);
  const [appLoaded, setAppLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityResult, setSecurityResult] = useState<SandboxSecurityResult | null>(null);

  // Sandbox proxy URL
  const sandboxProxyUrl = useMemo(() => getSandboxProxyUrl(), []);

  // ==========================================================================
  // Message handling
  // ==========================================================================

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const { data, origin, source } = event;

      // Only accept messages from our sandbox iframe
      if (source !== sandboxRef.current?.contentWindow) {
        return;
      }

      // Validate origin (allow null for sandboxed iframes)
      if (!isAllowedOrigin(origin, DEFAULT_ALLOWED_ORIGINS)) {
        console.warn("[AppViewer] Message from untrusted origin:", origin);
        return;
      }

      console.log("[AppViewer] Message from sandbox:", data?.type);

      // Handle sandbox messages
      if (isSandboxMessage(data)) {
        handleSandboxMessage(data);
        return;
      }

      // Handle app messages (relayed through sandbox)
      if (isAppMessage(data)) {
        handleAppMessage(data);
        return;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onSecurityResult]);

  const handleSandboxMessage = useCallback((message: SandboxToInspectorMessage) => {
    switch (message.type) {
      case "mcp-sandbox-ready":
        console.log("[AppViewer] Sandbox ready, initializing app");
        setSandboxReady(true);
        // Send init message with app URL
        sandboxRef.current?.contentWindow?.postMessage(
          { type: "mcp-sandbox-init", appUrl: resourceUri },
          "*"
        );
        break;

      case "mcp-sandbox-security-result":
        console.log("[AppViewer] Security test results:", message.results);
        setSecurityResult(message.results);
        onSecurityResult?.(message.results);
        break;

      case "mcp-sandbox-app-loaded":
        console.log("[AppViewer] App loaded:", message.url);
        setAppLoaded(true);
        setError(null);
        // Send tool data to app
        if (toolInput || toolResult) {
          sandboxRef.current?.contentWindow?.postMessage(
            { type: "mcp-ui-init", toolInput, toolResult },
            "*"
          );
        }
        break;

      case "mcp-sandbox-app-error":
        console.error("[AppViewer] App error:", message.error);
        setError(message.error);
        setAppLoaded(false);
        break;
    }
  }, [resourceUri, toolInput, toolResult, onSecurityResult]);

  const handleAppMessage = useCallback((message: { type: string; [key: string]: unknown }) => {
    // Handle messages from the app (relayed through sandbox)
    console.log("[AppViewer] App message:", message.type);

    switch (message.type) {
      case "mcp-ui-result":
        // App sent a result (e.g., user action completed)
        console.log("[AppViewer] App result:", message.result);
        break;

      case "mcp-ui-error":
        // App encountered an error
        console.error("[AppViewer] App error:", message.error);
        break;
    }
  }, []);

  // ==========================================================================
  // Send tool data when it changes
  // ==========================================================================

  useEffect(() => {
    if (!appLoaded || !sandboxRef.current) return;

    sandboxRef.current.contentWindow?.postMessage(
      { type: "mcp-ui-init", toolInput, toolResult },
      "*"
    );
  }, [appLoaded, toolInput, toolResult]);

  // ==========================================================================
  // Open in new tab
  // ==========================================================================

  const handleOpenExternal = useCallback(() => {
    window.open(resourceUri, "_blank");
  }, [resourceUri]);

  // ==========================================================================
  // Render security badge
  // ==========================================================================

  const renderSecurityBadge = () => {
    if (!securityResult) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted">
              <Shield className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">{t("inspector.checking")}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {t("inspector.securityCheckPending")}
          </TooltipContent>
        </Tooltip>
      );
    }

    if (securityResult.passed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/10">
              <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
              <span className="text-green-600 dark:text-green-400">{t("inspector.secure")}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {t("inspector.securityPassed")}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/10">
            <ShieldAlert className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-600 dark:text-amber-400">{t("inspector.warning")}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {t("inspector.securityWarning")}
        </TooltipContent>
      </Tooltip>
    );
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
          {renderSecurityBadge()}
          <span className="truncate font-mono">{resourceUri}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={handleOpenExternal}
          title={t("inspector.openInNewTab")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Sandbox iframe (outer layer) */}
      <div className="flex-1 relative">
        {/* Loading state */}
        {(!sandboxReady || !appLoaded) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {!sandboxReady
                  ? t("inspector.initializingSandbox")
                  : t("inspector.loadingApp")}
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleOpenExternal}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("inspector.openInNewTab")}
            </Button>
          </div>
        )}

        {/* Dual-layer iframe: outer sandbox proxy, inner app iframe */}
        <iframe
          ref={sandboxRef}
          src={sandboxProxyUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          title={t("inspector.mcpAppSandbox")}
        />
      </div>
    </div>
  );
}

export default InspectorApps;
