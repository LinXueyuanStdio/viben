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
  Database,
  AppWindow,
  Clock,
  Mouse,
  RefreshCw,
  ExternalLink,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const SOCKET_PATH = "/tmp/viben-mcp.sock";
const isDev = import.meta.env.DEV;

// List of 10 tools provided by tauri-plugin-mcp-server
// Reference: https://www.npmjs.com/package/tauri-plugin-mcp-server
const MCP_TOOLS = [
  { icon: Camera, toolKey: "take_screenshot" },
  { icon: Search, toolKey: "query_page" },
  { icon: MousePointer, toolKey: "click" },
  { icon: Keyboard, toolKey: "type_text" },
  { icon: Mouse, toolKey: "mouse_action" },
  { icon: Navigation, toolKey: "navigate" },
  { icon: Terminal, toolKey: "execute_js" },
  { icon: Database, toolKey: "manage_storage" },
  { icon: AppWindow, toolKey: "manage_window" },
  { icon: Clock, toolKey: "wait_for" },
].map((tool) => ({ ...tool, descKey: `pageDebug.tools.${tool.toolKey}` }));

type SocketStatus = "checking" | "connected" | "disconnected";

export function PageDebugPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("checking");
  const [isChecking, setIsChecking] = useState(false);

  // Check if the MCP socket server is running
  const checkSocketStatus = async () => {
    setIsChecking(true);
    try {
      // Try to check if the socket file exists using Tauri's fs plugin
      const { exists } = await import("@tauri-apps/plugin-fs");
      const socketExists = await exists(SOCKET_PATH);
      setSocketStatus(socketExists ? "connected" : "disconnected");
    } catch {
      // If we can't check, assume disconnected
      setSocketStatus("disconnected");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isDev) {
      checkSocketStatus();
      // Poll every 5 seconds
      const interval = setInterval(checkSocketStatus, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  // MCP client configuration for AI tools (Claude Code, Cursor, etc.)
  // Note: Using "node" instead of "npx" due to missing shebang in the package
  const mcpConfig = {
    mcpServers: {
      "tauri-mcp": {
        command: "node",
        args: ["node_modules/tauri-plugin-mcp-server/build/index.js"],
        env: {
          TAURI_MCP_IPC_PATH: SOCKET_PATH,
        },
      },
    },
  };

  // Test command to verify MCP server connection
  const testCommand = `TAURI_MCP_IPC_PATH=${SOCKET_PATH} node node_modules/tauri-plugin-mcp-server/build/index.js`;

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

  // Show disabled message in production
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
        <div className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium">{t("pageDebug.socketPath")}: </span>
          <code className="bg-muted px-2 py-0.5 rounded text-xs">{SOCKET_PATH}</code>
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
                href="https://github.com/ArtificialDynasty/tauri-plugin-mcp"
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
      <div>
        <h3 className="text-sm font-medium mb-3">{t("pageDebug.features")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {MCP_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.toolKey}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{t(tool.descKey)}</p>
                  <code className="text-xs text-muted-foreground">
                    {tool.toolKey}
                  </code>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Client Configuration */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">{t("pageDebug.aiInstructions")}</h3>
          <Button variant="ghost" size="sm" onClick={copyConfig}>
            {copied ? (
              <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {t("pageDebug.copyConfig")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {t("pageDebug.configHint")}
        </p>
        <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
          {JSON.stringify(mcpConfig, null, 2)}
        </pre>
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
