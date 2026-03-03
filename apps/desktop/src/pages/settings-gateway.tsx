/**
 * Gateway Settings Section
 * 网关设置
 *
 * Allows users to manage the viben gateway service:
 * 允许用户管理 viben 网关服务：
 * - Start/Stop/Restart gateway 启动/停止/重启网关
 * - Configure port 配置端口
 * - Test connectivity 测试连通性
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
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGateway } from "@/hooks";
import { useState, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";
import { toast } from "sonner";

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

// Connectivity test result type
interface ConnectivityResult {
  reachable: boolean;
  healthCheck: boolean;
  version: string | null;
  service: string | null;
  timestamp: string | null;
  url: string;
  endpoints: { path: string; available: boolean }[];
  websockets: { path: string; available: boolean }[];
}

export function SettingsGatewayPage() {
  const { t } = useTranslation();
  const {
    status,
    config,
    isLoading,
    isActioning,
    error,
    discoveredUrl,
    startGateway,
    stopGateway,
    restartGateway,
    updateConfig,
    discoverGateway,
  } = useGateway();

  const [portInput, setPortInput] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectivityResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Test connectivity
  const testConnectivity = useCallback(async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const client = getGatewayClient();
      const result = await client.diagnose();
      setTestResult(result);

      // Show toast notification based on result
      if (result.reachable && result.healthCheck) {
        const availableEndpoints = result.endpoints.filter((e) => e.available).length;
        const totalEndpoints = result.endpoints.length;
        const availableWs = result.websockets.filter((w) => w.available).length;
        const totalWs = result.websockets.length;

        toast.success(t("gateway.connectionSuccess", "网关连接成功"), {
          description: [
            result.service && result.version
              ? `${result.service} v${result.version}`
              : null,
            `${t("gateway.address", "地址")}: ${result.url}`,
            `${t("gateway.availableEndpoints", "可用端点")}: ${availableEndpoints}/${totalEndpoints}`,
            `WebSocket: ${availableWs}/${totalWs}`,
          ]
            .filter(Boolean)
            .join("\n"),
          duration: 5000,
        });
      } else {
        toast.error(t("gateway.connectionFailed", "网关连接失败"), {
          description: result.reachable
            ? t("gateway.healthCheckFailed", "健康检查未通过")
            : t("gateway.unreachableDescription", "无法连接到网关服务，请检查网关是否已启动"),
          duration: 5000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestError(errorMsg);
      toast.error(t("gateway.connectionError", "连接错误"), {
        description: errorMsg,
        duration: 5000,
      });
    } finally {
      setIsTesting(false);
    }
  }, [t]);

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
                disabled={isActioning}
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
        {(status?.url || discoveredUrl) && (
          <div className="pt-3 border-t">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("gateway.url", "网关地址")}
              {discoveredUrl && discoveredUrl !== status?.url && (
                <span className="ml-2 text-green-600">
                  ({t("gateway.autoDiscovered", "已自动发现")})
                </span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono">
                {discoveredUrl || status?.url}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={copyUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={discoverGateway}
                title={t("gateway.refreshDiscover", "重新发现")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Connectivity Test Card */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
              <Wifi className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("gateway.connectivityTest", "连通性检测")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("gateway.connectivityTestDescription")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={testConnectivity}
            disabled={isTesting}
            className="gap-1.5"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            {t("gateway.testConnection", "检测")}
          </Button>
        </div>

        {/* Test Error */}
        {testError && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className="pt-3 border-t space-y-3">
            {/* Overall Status */}
            <div className="flex items-center gap-2">
              {testResult.reachable ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    {t("gateway.reachable", "网关可达")}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    {t("gateway.unreachable", "网关不可达")}
                  </span>
                </>
              )}
            </div>

            {/* Gateway Info - Service & Version */}
            {(testResult.service || testResult.version) && (
              <div className="flex items-center gap-4 text-sm">
                {testResult.service && (
                  <div className="flex items-center gap-1.5">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{testResult.service}</span>
                  </div>
                )}
                {testResult.version && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                    v{testResult.version}
                  </span>
                )}
              </div>
            )}

            {/* Gateway URL */}
            {testResult.url && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-xs text-muted-foreground">
                  {t("gateway.address", "地址")}:
                </span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {testResult.url}
                </code>
              </div>
            )}

            {/* Endpoints Status */}
            {testResult.endpoints.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("gateway.endpoints", "端点状态")} ({testResult.endpoints.filter(e => e.available).length}/{testResult.endpoints.length})
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {testResult.endpoints.map((endpoint) => (
                    <div
                      key={endpoint.path}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      {endpoint.available ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <code className="text-muted-foreground truncate">
                        {endpoint.path}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WebSocket Endpoints Status */}
            {testResult.websockets.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  WebSocket ({testResult.websockets.filter(w => w.available).length}/{testResult.websockets.length})
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {testResult.websockets.map((ws) => (
                    <div
                      key={ws.path}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      {ws.available ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <code className="text-muted-foreground truncate">
                        {ws.path}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration Card - Host & Port */}
      <div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
        <h3 className="text-sm font-semibold">
          {t("settings.gatewayConfig", "网关配置")}
        </h3>

        {/* Host Configuration */}
        <SettingsItem
          title={t("gateway.host")}
          description={t("gateway.hostDescription")}
        >
          <code className="bg-muted px-2 py-1 rounded text-sm">
            {config?.host || "127.0.0.1"}
          </code>
        </SettingsItem>

        {/* Port Configuration */}
        <SettingsItem
          title={t("gateway.port")}
          description={t("gateway.portDescription")}
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
      </div>

    </div>
  );
}
