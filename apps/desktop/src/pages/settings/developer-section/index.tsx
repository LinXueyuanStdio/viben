import { useState } from "react";
import {
  Check,
  FolderOpen,
  RefreshCw,
  Loader2,
  Copy,
  CheckCircle2,
  Bug,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { platform } from "@tauri-apps/plugin-os";
import { homeDir } from "@tauri-apps/api/path";
import { SettingsItem, SectionHeader } from "../components";
import type { DebugInfo } from "./constants";
import { getIDEIcon, IDE_OPTIONS, getTerminalIcon, TERMINAL_OPTIONS } from "./constants";

export function DeveloperSection() {
  const { t } = useTranslation();
  const {
    preferredIDE,
    setPreferredIDE,
    preferredTerminal,
    setPreferredTerminal,
    dangerouslySkipPermissions,
    setDangerouslySkipPermissions,
  } = useAppStore();

  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load debug info
  const loadDebugInfo = async () => {
    setIsLoadingDebug(true);
    try {
      const osType = platform();
      const info: DebugInfo = {
        os: osType,
        osVersion: t("common.unknown", "Unknown"),
        arch: t("common.unknown", "Unknown"),
        appVersion: "0.1.0",
        logsPath: "~/.viben/logs",
        configPath: "~/.viben",
      };
      setDebugInfo(info);
    } catch (err) {
      console.error("Failed to load debug info:", err);
    } finally {
      setIsLoadingDebug(false);
    }
  };

  // Copy debug info to clipboard
  const handleCopyDebugInfo = async () => {
    if (!debugInfo) {
      await loadDebugInfo();
    }
    const info = debugInfo || {
      os: platform(),
      osVersion: t("common.unknown", "Unknown"),
      arch: t("common.unknown", "Unknown"),
      appVersion: "0.1.0",
      logsPath: "~/.viben/logs",
      configPath: "~/.viben",
    };

    const debugText = [
      t("settings.developer.debugTextTitle", "Viben Debug Info"),
      "================",
      t("settings.developer.debugTextOs", "OS: {{os}}", { os: info.os }),
      t("settings.developer.debugTextOsVersion", "OS Version: {{version}}", { version: info.osVersion }),
      t("settings.developer.debugTextArch", "Architecture: {{arch}}", { arch: info.arch }),
      t("settings.developer.debugTextAppVersion", "App Version: {{version}}", { version: info.appVersion }),
      t("settings.developer.debugTextLogsPath", "Logs Path: {{path}}", { path: info.logsPath }),
      t("settings.developer.debugTextConfigPath", "Config Path: {{path}}", { path: info.configPath }),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(debugText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      console.error("Failed to copy debug info");
    }
  };

  // Open logs folder
  const handleOpenLogsFolder = async () => {
    try {
      const homeDirPath = await homeDir();
      const logsPath = `${homeDirPath}.viben/logs`;
      await openUrl(logsPath);
    } catch (error) {
      console.error("Failed to open logs folder:", error);
    }
  };

  // Open config folder
  const handleOpenConfigFolder = async () => {
    try {
      const homeDirPath = await homeDir();
      const configPath = `${homeDirPath}.viben`;
      await openUrl(configPath);
    } catch (error) {
      console.error("Failed to open config folder:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.developer")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.developerDescription")}
        </p>
      </div>

      {/* IDE Selection */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.developer.devtools")} />

        <SettingsItem
          title={t("settings.developer.preferredIDE")}
          description={t("settings.developer.preferredIDEDescription")}
        >
          <Select value={preferredIDE || "vscode"} onValueChange={setPreferredIDE}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {getIDEIcon(preferredIDE || "vscode")}
                  <span>{IDE_OPTIONS[preferredIDE || "vscode"]?.name || preferredIDE}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(IDE_OPTIONS).map(([id, config]) => (
                <SelectItem key={id} value={id}>
                  <div className="flex items-center gap-2">
                    {getIDEIcon(id)}
                    <span>{config.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          title={t("settings.developer.preferredTerminal")}
          description={t("settings.developer.preferredTerminalDescription")}
        >
          <Select value={preferredTerminal || "system"} onValueChange={setPreferredTerminal}>
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  {getTerminalIcon(preferredTerminal || "system")}
                  <span>{TERMINAL_OPTIONS[preferredTerminal || "system"]?.name || preferredTerminal}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TERMINAL_OPTIONS).map(([id, config]) => (
                <SelectItem key={id} value={id}>
                  <div className="flex items-center gap-2">
                    {getTerminalIcon(id)}
                    <span>{config.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </div>

      {/* YOLO Mode */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-amber-200">
                {t("settings.developer.yoloMode")}
              </h3>
              <p className="text-xs text-amber-400/80">
                {t("settings.developer.yoloModeDescription")}
              </p>
            </div>
          </div>
          <Switch
            checked={dangerouslySkipPermissions ?? false}
            onCheckedChange={setDangerouslySkipPermissions}
          />
        </div>
        {dangerouslySkipPermissions && (
          <p className="text-xs text-amber-500 font-medium flex items-center gap-1 mt-3">
            <AlertTriangle className="h-3 w-3" />
            {t("settings.developer.yoloModeWarning")}
          </p>
        )}
      </div>

      {/* Debug & Logs */}
      <div className="rounded-xl border bg-card p-4">
        <SectionHeader title={t("settings.developer.debugLogs")} />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 py-4">
          <Button
            variant="outline"
            onClick={handleOpenLogsFolder}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            {t("settings.developer.openLogsFolder")}
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenConfigFolder}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            {t("settings.developer.openConfigFolder")}
          </Button>

          <Button
            variant="outline"
            onClick={handleCopyDebugInfo}
            className="flex items-center gap-2"
            disabled={copySuccess}
          >
            {copySuccess ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                {t("common.copied")}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t("settings.developer.copyDebugInfo")}
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={loadDebugInfo}
            disabled={isLoadingDebug}
            className="flex items-center gap-2"
          >
            {isLoadingDebug ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("settings.developer.loadDebugInfo")}
          </Button>
        </div>

        {/* Debug Info Display */}
        {debugInfo && (
          <div className="space-y-4 pt-4 border-t">
            {/* System Information */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Bug className="h-4 w-4" />
                {t("settings.developer.systemInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.os")}:</span>
                  <span className="font-mono">{debugInfo.os}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.osVersion")}:</span>
                  <span className="font-mono">{debugInfo.osVersion}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.appVersion")}:</span>
                  <span className="font-mono">{debugInfo.appVersion}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{t("settings.developer.arch")}:</span>
                  <span className="font-mono">{debugInfo.arch}</span>
                </div>
              </div>
            </div>

            {/* Paths */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("settings.developer.paths")}
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("settings.developer.logs")}:</span>
                  <code className="bg-muted/50 px-2 py-0.5 rounded">{debugInfo.logsPath}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("settings.developer.config")}:</span>
                  <code className="bg-muted/50 px-2 py-0.5 rounded">{debugInfo.configPath}</code>
                </div>
              </div>
            </div>

            {/* No Recent Errors */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {t("settings.developer.noRecentErrors")}
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md mt-4">
          <p className="font-medium mb-1">{t("settings.developer.reportingIssues")}</p>
          <p>{t("settings.developer.reportingIssuesDescription")}</p>
        </div>
      </div>
    </div>
  );
}
