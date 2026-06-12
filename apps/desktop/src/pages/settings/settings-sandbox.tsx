/**
 * Sandbox Settings Section
 *
 * Allows users to view and manage sandbox providers:
 * - View available sandbox providers
 * - See provider capabilities
 * - Test sandbox execution
 */

import { useTranslation } from "react-i18next";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  Terminal,
  Play,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSandbox, type SandboxProviderType, type SandboxProviderDetails } from "@/hooks/use-sandbox";
import { useState, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

// Provider icon based on type
function ProviderIcon({ type, className }: { type: SandboxProviderType; className?: string }) {
  switch (type) {
    case "codex":
      return <ShieldCheck className={className} />;
    case "claude":
      return <Shield className={className} />;
    case "native":
    default:
      return <ShieldOff className={className} />;
  }
}

// Isolation level badge
function IsolationBadge({ level }: { level: string }) {
  const { t } = useTranslation();

  const config: Record<string, { color: string; label: string }> = {
    vm: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: t("sandbox.isolationVm", "VM") },
    container: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: t("sandbox.isolationContainer", "Container") },
    process: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: t("sandbox.isolationProcess", "Process") },
    none: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", label: t("sandbox.isolationNone", "None") },
  };

  const cfg = config[level] || config.none;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// Provider card component
function ProviderCard({
  provider,
  isAvailable,
  onTest,
  isTesting,
}: {
  provider: SandboxProviderDetails;
  isAvailable: boolean;
  onTest: () => void;
  isTesting: boolean;
}) {
  const { t } = useTranslation();
  const { capabilities } = provider;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isAvailable
          ? "bg-card"
          : "bg-muted/30 opacity-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              isAvailable
                ? "bg-primary/10"
                : "bg-muted"
            }`}
          >
            <ProviderIcon
              type={provider.type}
              className={`h-5 w-5 ${
                isAvailable ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{provider.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {isAvailable ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs text-green-600">
                    {t("common.available", "Available")}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("common.notInstalled", "Not installed")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Test Button */}
        {isAvailable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            disabled={isTesting}
            className="gap-1.5"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t("sandbox.test", "Test")}
          </Button>
        )}
      </div>

      {/* Capabilities */}
      <div className="pt-3 border-t space-y-2">
        {/* Isolation Level */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("sandbox.isolation", "Isolation")}
          </span>
          <IsolationBadge level={capabilities.isolation} />
        </div>

        {/* Network Access */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("sandbox.networkAccess", "Network Access")}
          </span>
          <div className="flex items-center gap-1.5">
            {capabilities.supportsNetworking ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs text-green-600">
                  {t("common.enabled", "Enabled")}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t("common.disabled", "Disabled")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Supported Runtimes */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("sandbox.runtimes", "Runtimes")}
          </span>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {capabilities.supportedRuntimes.map((runtime) => (
              <span
                key={runtime}
                className="px-1.5 py-0.5 bg-muted rounded text-xs"
              >
                {runtime}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsSandboxPage() {
  const { t } = useTranslation();
  const {
    providers,
    providerDetails,
    isLoading,
    error,
    refreshProviders,
    exec,
    isProviderAvailable,
  } = useSandbox();

  const [testingProvider, setTestingProvider] = useState<SandboxProviderType | null>(null);

  // Test a provider by running echo command
  const testProvider = useCallback(
    async (providerType: SandboxProviderType) => {
      setTestingProvider(providerType);
      try {
        const result = await exec("echo", ["Hello from sandbox!"], {
          provider: providerType,
        });

        if (result) {
          if (result.exitCode === 0) {
            toast.success(t("sandbox.testSuccess", "Sandbox test successful"), {
              description: [
                `${t("sandbox.provider", "Provider")}: ${result.provider?.name || providerType}`,
                `${t("sandbox.output", "Output")}: ${result.stdout.trim()}`,
                `${t("sandbox.duration", "Duration")}: ${result.duration}ms`,
              ].join("\n"),
              duration: 5000,
            });
          } else {
            toast.error(t("sandbox.testFailed", "Sandbox test failed"), {
              description: result.stderr || t("sandbox.exitCode", { code: result.exitCode }),
              duration: 5000,
            });
          }
        }
      } catch (err) {
        toast.error(t("sandbox.testError", "Test error"), {
          description: err instanceof Error ? err.message : String(err),
          duration: 5000,
        });
      } finally {
        setTestingProvider(null);
      }
    },
    [exec, t]
  );

  // Default provider details for display when not yet loaded
  const defaultProviders: SandboxProviderDetails[] = [
    {
      type: "codex",
      name: t("sandbox.providerNames.codex", "Codex CLI Sandbox"),
      capabilities: {
        supportsVolumeMounts: false,
        supportsNetworking: false,
        isolation: "process",
        supportedRuntimes: ["node", "python", "bun"],
        supportsPooling: false,
      },
    },
    {
      type: "claude",
      name: t("sandbox.providerNames.claude", "Claude Sandbox"),
      capabilities: {
        supportsVolumeMounts: false,
        supportsNetworking: true,
        isolation: "process",
        supportedRuntimes: ["node", "python", "bun"],
        supportsPooling: false,
      },
    },
    {
      type: "native",
      name: t("sandbox.providerNames.native", "Native (No Isolation)"),
      capabilities: {
        supportsVolumeMounts: false,
        supportsNetworking: true,
        isolation: "none",
        supportedRuntimes: ["node", "python", "bun", "bash"],
        supportsPooling: false,
      },
    },
  ];

  // Use provider details from API or fallback to defaults
  const displayProviders = providerDetails.length > 0 ? providerDetails : defaultProviders;

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
          {t("settings.sections.sandbox", "Sandbox")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.sandboxDescription", "Manage sandbox providers for isolated code execution")}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Overview Card */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {t("sandbox.availableProviders", "Available Providers")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {providers.length > 0
                  ? t("sandbox.providersFound", "{{count}} provider(s) available", { count: providers.length })
                  : t("sandbox.noProviders", "No providers available")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshProviders}
            disabled={isLoading}
            className="gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("common.refresh", "Refresh")}
          </Button>
        </div>

        {/* Priority explanation */}
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {t(
              "sandbox.priorityExplanation",
              "Provider priority: Codex (most secure) > Claude (process isolation) > Native (no isolation)"
            )}
          </p>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("sandbox.providers", "Providers")}
        </h3>

        <div className="grid gap-4">
          {displayProviders.map((provider) => (
            <ProviderCard
              key={provider.type}
              provider={provider}
              isAvailable={isProviderAvailable(provider.type)}
              onTest={() => testProvider(provider.type)}
              isTesting={testingProvider === provider.type}
            />
          ))}
        </div>
      </div>

      {/* Installation Hints */}
      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
            <Terminal className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {t("sandbox.installProviders", "Install Providers")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("sandbox.installDescription", "Install additional sandbox providers for better isolation")}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t space-y-3">
          {/* Codex */}
          {!isProviderAvailable("codex") && (
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("sandbox.codexCli", "Codex CLI")}</p>
              <code className="block bg-muted rounded-lg px-3 py-2 text-xs font-mono">
                npm install -g @openai/codex
              </code>
            </div>
          )}

          {/* Claude Sandbox */}
          {!isProviderAvailable("claude") && (
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("sandbox.claudeSandboxRuntime", "Claude Sandbox Runtime")}</p>
              <code className="block bg-muted rounded-lg px-3 py-2 text-xs font-mono">
                npm install -g @anthropic-ai/sandbox-runtime
              </code>
            </div>
          )}

          {/* All installed */}
          {providers.length === 3 && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("sandbox.allInstalled", "All providers installed")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
