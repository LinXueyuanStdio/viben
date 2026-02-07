/**
 * Gateway Settings Section
 *
 * Allows users to manage the viben-gateway service:
 * - Start/Stop/Restart gateway
 * - Configure port
 * - Toggle auto-start
 */

import { useTranslation } from "react-i18next";
import {
  Play,
  Square,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Server,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGateway } from "@/hooks";
import { useState } from "react";

// Settings item component
interface SettingsItemProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsItem({ title, description, children }: SettingsItemProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex-1 pr-4">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsGatewayPage() {
  const { t } = useTranslation();
  const {
    status,
    config,
    isLoading,
    isActioning,
    error,
    binaryPath,
    startGateway,
    stopGateway,
    restartGateway,
    updateConfig,
  } = useGateway();

  const [portInput, setPortInput] = useState<string>("");

  // Initialize port input when config loads
  if (config && !portInput) {
    setPortInput(String(config.port));
  }

  // Handle port change
  const handlePortChange = async () => {
    const port = parseInt(portInput, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return;
    }
    await updateConfig({ port });
  };

  // Copy URL to clipboard
  const copyUrl = () => {
    if (status?.url) {
      navigator.clipboard.writeText(status.url);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.gateway", "网关")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.gatewayDescription", "管理 AI 智能体网关服务")}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Card */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                status?.running
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-muted"
              }`}
            >
              <Server
                className={`h-5 w-5 ${
                  status?.running
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("settings.gatewayStatus", "网关状态")}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {status?.running ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-sm text-green-600">
                      {t("gateway.running", "运行中")}
                    </span>
                    {status.pid && (
                      <span className="text-xs text-muted-foreground">
                        (PID: {status.pid})
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {t("gateway.stopped", "已停止")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {status?.running ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={restartGateway}
                  disabled={isActioning}
                  className="gap-1.5"
                >
                  {isActioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t("gateway.restart", "重启")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopGateway}
                  disabled={isActioning}
                  className="gap-1.5"
                >
                  {isActioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {t("gateway.stop", "停止")}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={startGateway}
                disabled={isActioning || !binaryPath}
                className="gap-1.5"
              >
                {isActioning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t("gateway.start", "启动")}
              </Button>
            )}
          </div>
        </div>

        {/* URL Display */}
        {status?.url && (
          <div className="pt-3 border-t">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("gateway.url", "网关地址")}
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono">
                {status.url}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={copyUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Card */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold">
          {t("settings.gatewayConfig", "网关配置")}
        </h3>

        {/* Auto Start Toggle */}
        <SettingsItem
          title={t("gateway.autoStart", "自动启动")}
          description={t(
            "gateway.autoStartDescription",
            "应用启动时自动启动网关服务"
          )}
        >
          <Switch
            checked={config?.auto_start ?? true}
            onCheckedChange={(checked) => updateConfig({ auto_start: checked })}
          />
        </SettingsItem>

        {/* Port Configuration */}
        <SettingsItem
          title={t("gateway.port", "端口")}
          description={t(
            "gateway.portDescription",
            "网关服务监听的端口号 (需要重启生效)"
          )}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              className="w-24 h-9"
              min={1}
              max={65535}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handlePortChange}
              disabled={
                !portInput ||
                parseInt(portInput, 10) === config?.port ||
                isNaN(parseInt(portInput, 10))
              }
            >
              {t("common.apply", "应用")}
            </Button>
          </div>
        </SettingsItem>

        {/* Host Configuration */}
        <SettingsItem
          title={t("gateway.host", "主机")}
          description={t(
            "gateway.hostDescription",
            "网关服务绑定的主机地址"
          )}
        >
          <code className="bg-muted px-2 py-1 rounded text-sm">
            {config?.host || "127.0.0.1"}
          </code>
        </SettingsItem>
      </div>

      {/* Binary Info Card */}
      <div className="rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold mb-3">
          {t("settings.gatewayBinary", "网关程序")}
        </h3>

        {binaryPath ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-muted-foreground truncate">{binaryPath}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{t("gateway.binaryNotFound", "未找到网关程序")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "gateway.buildHint",
                "请先构建网关: cd crates && cargo build --release -p viben-gateway"
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
