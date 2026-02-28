import { useState } from "react";
import {
  Camera,
  Layers,
  Keyboard,
  Copy,
  Check,
  AlertTriangle,
  Bug,
  Terminal,
  MousePointer,
  Play,
  LayoutList,
  MonitorStop,
  FileSearch,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const SOCKET_PATH = "/tmp/viben-mcp.sock";
const isDev = import.meta.env.DEV;

// List of 10 tools provided by tauri-plugin-mcp
const MCP_TOOLS = [
  { icon: Camera, toolKey: "take_screenshot", descKey: "pageDebug.tools.takeScreenshot" },
  { icon: Search, toolKey: "query_page", descKey: "pageDebug.tools.queryPage" },
  { icon: MousePointer, toolKey: "click", descKey: "pageDebug.tools.click" },
  { icon: Keyboard, toolKey: "type_text", descKey: "pageDebug.tools.typeText" },
  { icon: Layers, toolKey: "get_page_content", descKey: "pageDebug.tools.getPageContent" },
  { icon: Terminal, toolKey: "execute_js", descKey: "pageDebug.tools.executeJs" },
  { icon: FileSearch, toolKey: "get_tauri_state", descKey: "pageDebug.tools.getTauriState" },
  { icon: LayoutList, toolKey: "get_windows", descKey: "pageDebug.tools.getWindows" },
  { icon: Play, toolKey: "launch_app", descKey: "pageDebug.tools.launchApp" },
  { icon: MonitorStop, toolKey: "stop_app", descKey: "pageDebug.tools.stopApp" },
];

export function PageDebugPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copiedTest, setCopiedTest] = useState(false);

  // MCP client configuration for AI tools (Claude Code, Cursor, etc.)
  const mcpConfig = {
    mcpServers: {
      "tauri-mcp": {
        command: "npx",
        args: ["tauri-plugin-mcp-server"],
        env: {
          TAURI_MCP_IPC_PATH: SOCKET_PATH,
        },
      },
    },
  };

  // Test command to verify MCP server connection
  const testCommand = `npx @anthropic-ai/mcp-inspector --cli npx tauri-plugin-mcp-server`;

  const copyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTestCommand = () => {
    navigator.clipboard.writeText(testCommand);
    setCopiedTest(true);
    setTimeout(() => setCopiedTest(false), 2000);
  };

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

  return (
    <div className="p-6 space-y-6">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium">{t("pageDebug.status")}</span>
          </div>
          <span className="text-sm text-green-600 dark:text-green-400">
            {t("pageDebug.running")}
          </span>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium">{t("pageDebug.socketPath")}: </span>
          <code className="bg-muted px-2 py-0.5 rounded">{SOCKET_PATH}</code>
        </div>
      </div>

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
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t(tool.descKey)}</p>
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
        <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
          {testCommand}
        </pre>
        <p className="text-xs text-muted-foreground mt-2">
          {t("pageDebug.testCommandHint")}
        </p>
      </div>
    </div>
  );
}
