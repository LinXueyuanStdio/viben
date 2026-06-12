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
  Link,
  Terminal,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGateway, useVibenCli } from "@/hooks";
import type { VibenCliSource } from "@/hooks";
import { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { getGatewayClient, getGatewayUrl, setGatewayUrl } from "@/lib/gateway";
import { toast } from "@/hooks/use-toast";

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
    isLoading,
    isActioning,
    error,
    discoveredUrl,
    startGateway,
    stopGateway,
    restartGateway,
    discoverGateway,
  } = useGateway();

  const [baseUrlInput, setBaseUrlInput] = useState<string>("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectivityResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Viben CLI detection and selection
  const {
    alternatives: vibenAlternatives,
    selectedPath: vibenSelectedPath,
    isLoading: isVibenLoading,
    error: vibenError,
    selectPath: selectVibenPath,
    validatePath: validateVibenPath,
    detectViben,
  } = useVibenCli();

  // Custom viben path input state
  const [customVibenPath, setCustomVibenPath] = useState("");
  const [isValidatingVibenPath, setIsValidatingVibenPath] = useState(false);
  const [vibenPathValidationResult, setVibenPathValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Initialize base URL input from stored value
  useEffect(() => {
    setBaseUrlInput(getGatewayUrl());
  }, []);

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

        toast.success(t("gateway.connectionSuccess", "Gateway connected"), {
          description: [
            result.service && result.version
              ? `${result.service} v${result.version}`
              : null,
            `${t("gateway.address", "Address")}: ${result.url}`,
            `${t("gateway.availableEndpoints", "Available endpoints")}: ${availableEndpoints}/${totalEndpoints}`,
            `${t("gateway.websocket", "WebSocket")}: ${availableWs}/${totalWs}`,
          ]
            .filter(Boolean)
            .join("\n"),
          duration: 5000,
        });
      } else {
        toast.error(t("gateway.connectionFailed", "Gateway connection failed"), {
          description: result.reachable
            ? t("gateway.healthCheckFailed", "Health check failed")
            : t("gateway.unreachableDescription", "Unable to connect to gateway service. Please check if the gateway is running."),
          duration: 5000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestError(errorMsg);
      toast.error(t("gateway.connectionError", "Connection error"), {
        description: errorMsg,
        duration: 5000,
      });
    } finally {
      setIsTesting(false);
    }
  }, [t]);

  // Handle base URL change
  const handleBaseUrlChange = useCallback(() => {
    // Validate URL format
    try {
      const url = new URL(baseUrlInput);
      if (!["http:", "https:"].includes(url.protocol)) {
        toast.error(t("gateway.invalidUrlProtocol", "Invalid protocol. Please use http or https."));
        return;
      }
      setGatewayUrl(baseUrlInput);
      toast.success(t("gateway.urlSaved", "Gateway URL saved"));
      // Trigger re-discovery to update connection
      discoverGateway();
    } catch {
      toast.error(t("gateway.invalidUrl", "Invalid URL format"));
    }
  }, [baseUrlInput, t, discoverGateway]);

  // Copy URL to clipboard
  const copyUrl = () => {
    if (status?.url) {
      navigator.clipboard.writeText(status.url);
    }
  };

  // Validate custom viben path
  const handleValidateVibenPath = useCallback(async () => {
    if (!customVibenPath.trim()) return;

    setIsValidatingVibenPath(true);
    setVibenPathValidationResult(null);

    try {
      const isValid = await validateVibenPath(customVibenPath.trim());
      if (isValid) {
        setVibenPathValidationResult({
          valid: true,
          message: t("vibenCli.pathValid", "Path is valid"),
        });
        // Automatically select this path
        await selectVibenPath(customVibenPath.trim());
        toast.success(t("vibenCli.pathSelected", "Viben CLI path selected"));
        setCustomVibenPath("");
      } else {
        setVibenPathValidationResult({
          valid: false,
          message: t("vibenCli.pathInvalid", "Invalid viben path"),
        });
      }
    } catch (err) {
      setVibenPathValidationResult({
        valid: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsValidatingVibenPath(false);
    }
  }, [customVibenPath, validateVibenPath, selectVibenPath, t]);

  // Get source label for display
  const getSourceLabel = (source: VibenCliSource): string => {
    switch (source) {
      case "bundled":
        return t("vibenCli.sourceBundled", "Bundled");
      case "homebrew":
        return "Homebrew";
      case "npm":
        return "npm";
      case "cargo":
        return "Cargo";
      case "system-path":
        return t("vibenCli.sourceSystemPath", "System Path");
      case "user-config":
        return t("vibenCli.sourceUserConfig", "User Config");
      case "nvm":
        return "nvm";
      case "pyenv":
        return "pyenv";
      case "pip":
        return "pip";
      case "fallback":
        return t("vibenCli.sourceFallback", "Default");
      default:
        return source;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.gateway", "Gateway")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.gatewayDescription", "Manage the AI agent gateway service")}
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
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                isLoading
                  ? "bg-muted"
                  : status?.running
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-muted"
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Server
                  className={`h-5 w-5 ${
                    status?.running
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                  }`}
                />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("settings.gatewayStatus", "Gateway Status")}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {isLoading ? (
                  <span className="text-sm text-muted-foreground">
                    {t("gateway.checking", "Checking...")}
                  </span>
                ) : status?.running ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-sm text-green-600">
                      {t("gateway.running", "Running")}
                    </span>
                    {status.pid && (
                      <span className="text-xs text-muted-foreground">
                        ({t("common.pid", "PID")}: {status.pid})
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {t("gateway.stopped", "Stopped")}
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
                  disabled={isActioning || isLoading}
                  className="gap-1.5"
                >
                  {isActioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t("gateway.restart", "Restart")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopGateway}
                  disabled={isActioning || isLoading}
                  className="gap-1.5"
                >
                  {isActioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {t("gateway.stop", "Stop")}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={startGateway}
                disabled={isActioning || isLoading}
                className="gap-1.5"
              >
                {isActioning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t("gateway.start", "Start")}
              </Button>
            )}
          </div>
        </div>

        {/* URL Display */}
        {(status?.url || discoveredUrl) && (
          <div className="pt-3 border-t">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {t("gateway.url", "Gateway URL")}
              {discoveredUrl && discoveredUrl !== status?.url && (
                <span className="ml-2 text-green-600">
                  ({t("gateway.autoDiscovered", "Auto-discovered")})
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
                title={t("gateway.refreshDiscover", "Re-discover")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Connectivity Test Card */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
              <Wifi className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("gateway.connectivityTest", "Connectivity Test")}
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
            {t("gateway.testConnection", "Test")}
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
                    {t("gateway.reachable", "Gateway reachable")}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    {t("gateway.unreachable", "Gateway unreachable")}
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
                  {t("gateway.address", "Address")}:
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
                  {t("gateway.endpoints", "Endpoint Status")} ({testResult.endpoints.filter(e => e.available).length}/{testResult.endpoints.length})
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
                  {t("gateway.websocket", "WebSocket")} ({testResult.websockets.filter(w => w.available).length}/{testResult.websockets.length})
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

      {/* Configuration Card - Base URL */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
            <Link className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {t("settings.gatewayConfig", "Gateway Configuration")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("gateway.baseUrlDescription", "Set the base URL for the gateway service")}
            </p>
          </div>
        </div>

        {/* Base URL Configuration */}
        <div className="pt-3 border-t">
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            {t("gateway.baseUrl", "Base URL")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="url"
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              placeholder={t("gateway.urlPlaceholder", "http://127.0.0.1:18790")}
              className="flex-1 h-9 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaseUrlChange}
              disabled={!baseUrlInput || baseUrlInput === getGatewayUrl()}
            >
              {t("common.apply", "Apply")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("gateway.baseUrlHint", "e.g., http://127.0.0.1:18790 or https://gateway.example.com")}
          </p>
        </div>
      </div>

      {/* Viben CLI Selection Card */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
              <Terminal className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("vibenCli.title", "Viben CLI")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("vibenCli.description", "Select the Viben CLI path used by the gateway service")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => detectViben(true)}
            disabled={isVibenLoading}
            title={t("common.refresh", "Refresh")}
          >
            {isVibenLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Error display */}
        {vibenError && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{vibenError}</span>
          </div>
        )}

        {/* Detected CLI Paths */}
        <div className="pt-3 border-t space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t("vibenCli.detectedPaths", "Detected Paths")}
          </Label>

          {isVibenLoading && vibenAlternatives.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("vibenCli.detecting", "Detecting...")}
            </div>
          ) : vibenAlternatives.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {t("vibenCli.noPaths", "No Viben CLI detected. Please specify a path using the input below.")}
            </div>
          ) : (
            <div className="space-y-2">
              {vibenAlternatives.map((alt) => (
                <button
                  key={alt.path}
                  onClick={() => selectVibenPath(alt.path)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    vibenSelectedPath === alt.path
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 shrink-0 ${
                        vibenSelectedPath === alt.path
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}
                    >
                      {vibenSelectedPath === alt.path && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-medium truncate">
                          {alt.path}
                        </code>
                        {alt.source === "bundled" && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            {t("vibenCli.bundled", "Bundled")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {alt.version && (
                          <span className="px-1.5 py-0.5 bg-muted rounded font-mono">
                            v{alt.version}
                          </span>
                        )}
                        <span>{getSourceLabel(alt.source)}</span>
                      </div>
                    </div>
                  </div>
                  {vibenSelectedPath === alt.path && (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Path Input */}
        <div className="pt-3 border-t space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t("vibenCli.customPath", "Custom Path")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={customVibenPath}
              onChange={(e) => {
                setCustomVibenPath(e.target.value);
                setVibenPathValidationResult(null);
              }}
              placeholder={t("vibenCli.customPathPlaceholder", "/path/to/viben")}
              className="flex-1 h-9 font-mono text-sm"
              disabled={isValidatingVibenPath}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidateVibenPath}
              disabled={!customVibenPath.trim() || isValidatingVibenPath}
            >
              {isValidatingVibenPath ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("vibenCli.check", "Check")
              )}
            </Button>
          </div>
          {vibenPathValidationResult && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                vibenPathValidationResult.valid
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {vibenPathValidationResult.valid ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              <span>{vibenPathValidationResult.message}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
