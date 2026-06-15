import { useState, useEffect } from "react";
import {
  Camera,
  Keyboard,
  Copy,
  Check,
  AlertTriangle,
  Bug,
  Terminal,
  MousePointer,
  Navigation,
  Search,
  AppWindow,
  Clock,
  RefreshCw,
  ExternalLink,
  CircleAlert,
  Server,
  MonitorSmartphone,
  Activity,
  Eye,
  Hand,
  FileCode,
  Crosshair,
  Pointer,
  Paintbrush,
  ScrollText,
  Radio,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getGatewayClient } from "@/lib/gateway";

const MCP_BRIDGE_WS_PORT = 9223;
const GATEWAY_PORT = 18790;
const isDev = import.meta.env.DEV;

const MCP_TOOLS_CATEGORIES = [
  {
    categoryKey: "pageDebug.toolCategories.setup",
    tools: [
      { icon: Server, toolKey: "driver_session", descKey: "pageDebug.tools.driver_session" },
      { icon: FileCode, toolKey: "get_setup_instructions", descKey: "pageDebug.tools.get_setup_instructions" },
    ],
  },
  {
    categoryKey: "pageDebug.toolCategories.uiAutomation",
    tools: [
      { icon: Camera, toolKey: "webview_screenshot", descKey: "pageDebug.tools.webview_screenshot" },
      { icon: Eye, toolKey: "webview_dom_snapshot", descKey: "pageDebug.tools.webview_dom_snapshot" },
      { icon: Search, toolKey: "webview_find_element", descKey: "pageDebug.tools.webview_find_element" },
      { icon: Crosshair, toolKey: "webview_select_element", descKey: "pageDebug.tools.webview_select_element" },
      { icon: Pointer, toolKey: "webview_get_pointed_element", descKey: "pageDebug.tools.webview_get_pointed_element" },
      { icon: MousePointer, toolKey: "webview_interact", descKey: "pageDebug.tools.webview_interact" },
      { icon: Keyboard, toolKey: "webview_keyboard", descKey: "pageDebug.tools.webview_keyboard" },
      { icon: Terminal, toolKey: "webview_execute_js", descKey: "pageDebug.tools.webview_execute_js" },
      { icon: Paintbrush, toolKey: "webview_get_styles", descKey: "pageDebug.tools.webview_get_styles" },
      { icon: Clock, toolKey: "webview_wait_for", descKey: "pageDebug.tools.webview_wait_for" },
      { icon: AppWindow, toolKey: "manage_window", descKey: "pageDebug.tools.manage_window" },
      { icon: ScrollText, toolKey: "read_logs", descKey: "pageDebug.tools.read_logs" },
    ],
  },
  {
    categoryKey: "pageDebug.toolCategories.ipc",
    tools: [
      { icon: Zap, toolKey: "ipc_execute_command", descKey: "pageDebug.tools.ipc_execute_command" },
      { icon: Activity, toolKey: "ipc_get_backend_state", descKey: "pageDebug.tools.ipc_get_backend_state" },
      { icon: Radio, toolKey: "ipc_monitor", descKey: "pageDebug.tools.ipc_monitor" },
      { icon: Hand, toolKey: "ipc_get_captured", descKey: "pageDebug.tools.ipc_get_captured" },
      { icon: Navigation, toolKey: "ipc_emit_event", descKey: "pageDebug.tools.ipc_emit_event" },
    ],
  },
  {
    categoryKey: "pageDebug.toolCategories.mobile",
    tools: [
      { icon: MonitorSmartphone, toolKey: "list_devices", descKey: "pageDebug.tools.list_devices" },
    ],
  },
];

type SocketStatus = "checking" | "connected" | "disconnected";

export function TauriMcpPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);

  const [socketStatus, setSocketStatus] = useState<SocketStatus>("checking");
  const [isChecking, setIsChecking] = useState(false);

  const checkSocketStatus = async () => {
    setIsChecking(true);
    try {
      const response = await getGatewayClient().request<Response>("/api/mcp-server/tauri/status", {
        method: "GET",
        responseType: "response",
      });
      if (response.ok) {
        const data = await response.json();
        setSocketStatus(data.available && data.connected ? "connected" : "disconnected");
        setIsChecking(false);
        return;
      }
    } catch {
      // Gateway not available
    }
    setSocketStatus("disconnected");
    setIsChecking(false);
  };

  useEffect(() => {
    if (isDev) {
      checkSocketStatus();
      const interval = setInterval(checkSocketStatus, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const mcpConfig = {
    mcpServers: {
      "viben-tauri-mcp": {
        type: "streamable-http",
        url: `http://127.0.0.1:${GATEWAY_PORT}/api/mcp-server/tauri`,
      },
    },
  };

  const testCommand = `curl -X GET http://127.0.0.1:${GATEWAY_PORT}/api/mcp-server/tauri/status`;

  const handleCopy = (
    textToCopy: string,
    setCopiedState: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const copyConfig = () => handleCopy(JSON.stringify(mcpConfig, null, 2), setCopied);
  const copyTestCommand = () => handleCopy(testCommand, setCopiedTest);

  if (!isDev) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950 p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-600 dark:text-yellow-500" />
          <h2 className="text-lg font-semibold mb-2">{t("pageDebug.devOnly")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("pageDebug.productionDisabled")}
          </p>
        </div>
      </div>
    );
  }

  const StatusIndicator = () => {
    if (socketStatus === "checking" || isChecking) {
      return (
        <>
          <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
          <span className="font-medium">{t("pageDebug.status")}</span>
          <span className="text-sm text-yellow-600 dark:text-yellow-400 ml-auto">
            {t("pageDebug.checking")}
          </span>
        </>
      );
    }
    if (socketStatus === "connected") {
      return (
        <>
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
          <span className="font-medium">{t("pageDebug.status")}</span>
          <span className="text-sm text-green-600 dark:text-green-400 ml-auto">
            {t("pageDebug.running")}
          </span>
        </>
      );
    }
    return (
      <>
        <div className="h-3 w-3 rounded-full bg-red-500" />
        <span className="font-medium">{t("pageDebug.status")}</span>
        <span className="text-sm text-red-600 dark:text-red-400 ml-auto">
          {t("pageDebug.stopped")}
        </span>
      </>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="h-6 w-6" />
          {t("pageDebug.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pageDebug.subtitle")}
        </p>
      </div>

      {/* Status Card */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <StatusIndicator />
          <Button
            variant="ghost"
            size="icon"
            onClick={checkSocketStatus}
            disabled={isChecking}
            className="ml-2 h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">{t("pageDebug.bridgeWs")}: </span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs">ws://127.0.0.1:{MCP_BRIDGE_WS_PORT}</code>
          </div>
          <div>
            <span className="font-medium">{t("pageDebug.gatewayEndpoint")}: </span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs">
              http://127.0.0.1:{GATEWAY_PORT}/api/mcp-server/tauri
            </code>
          </div>
        </div>
      </div>

      {/* Setup Required Warning */}
      {socketStatus === "disconnected" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
          <div className="flex items-start gap-3">
            <CircleAlert className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                {t("pageDebug.setupRequired")}
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("pageDebug.setupDescription")}
              </p>
              <a
                href="https://github.com/hypothesi/mcp-server-tauri"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300 hover:underline"
              >
                {t("pageDebug.viewSetupGuide")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Available Tools */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t("pageDebug.features")} (20)</h3>
        {MCP_TOOLS_CATEGORIES.map((category) => (
          <div key={category.categoryKey}>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t(category.categoryKey)}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {category.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.toolKey}
                    className="flex items-center gap-3 p-2.5 rounded-lg border bg-card"
                  >
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <code className="text-xs font-medium">{tool.toolKey}</code>
                      <p className="text-xs text-muted-foreground truncate">{t(tool.descKey)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* AI Client Configuration */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t("pageDebug.aiInstructions")}</h3>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Streamable HTTP</p>
            <Button variant="ghost" size="sm" onClick={copyConfig}>
              {copied ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {t("pageDebug.copyConfig")}
            </Button>
          </div>
          <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
            {JSON.stringify(mcpConfig, null, 2)}
          </pre>
          <p className="text-xs text-muted-foreground">
            {t("pageDebug.manualConfigHint")}
          </p>
        </div>
      </div>

      {/* Architecture Note */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>{t("pageDebug.architectureNote")}:</strong> {t("pageDebug.architectureDescription")}
        </p>
      </div>

      {/* Test Command */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">{t("pageDebug.testCommand")}</h3>
          <Button variant="ghost" size="sm" onClick={copyTestCommand}>
            {copiedTest ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {t("common.copy")}
          </Button>
        </div>
        <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap break-all">
          {testCommand}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          {t("pageDebug.testCommandHint")}
        </p>
      </div>
    </div>
  );
}
