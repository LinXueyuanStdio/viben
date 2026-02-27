import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Bot,
  RefreshCw,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { cn } from "@/lib/utils";
import { useExecutors } from "@/hooks/use-workspace-resources";
import {
  isAgentAvailable,
  type ExecutorInfo,
  type ExecutorType,
} from "@/lib/gateway";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StepClaudeProps {
  onComplete: () => void;
  onBack: () => void;
}

// Executor type to download URL mapping
const EXECUTOR_DOWNLOAD_URLS: Partial<Record<ExecutorType, string>> = {
  CLAUDE_CODE: "https://claude.ai/download",
  CURSOR_AGENT: "https://cursor.sh/",
  CODEX: "https://github.com/openai/codex",
  GEMINI: "https://gemini.google.com/",
  COPILOT: "https://github.com/features/copilot",
  QWEN_CODE: "https://qwen.aliyun.com/",
};

// Executor type to short icon label mapping
const EXECUTOR_ICONS: Partial<Record<ExecutorType, string>> = {
  CLAUDE_CODE: "CC",
  CURSOR_AGENT: "Cu",
  CODEX: "Cx",
  GEMINI: "Ge",
  COPILOT: "Co",
  QWEN_CODE: "Qw",
  AMP: "Am",
  OPENCODE: "Oc",
  DROID: "Dr",
};

export function StepClaude({ onComplete, onBack }: StepClaudeProps) {
  const { t } = useTranslation();
  const { executors, loading, error, refresh, getAvailableExecutors } =
    useExecutors();

  // Get available (installed) executors
  const availableExecutors = React.useMemo(() => {
    return getAvailableExecutors();
  }, [getAvailableExecutors]);

  // Sort executors: available first, then by name
  const sortedExecutors = React.useMemo(() => {
    return [...executors].sort((a, b) => {
      const aAvailable = a.availability && isAgentAvailable(a.availability);
      const bAvailable = b.availability && isAgentAvailable(b.availability);

      // Available executors first
      if (aAvailable && !bAvailable) return -1;
      if (!aAvailable && bAvailable) return 1;

      // Then sort by name
      return a.name.localeCompare(b.name);
    });
  }, [executors]);

  const handleOpenDownload = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.error("Failed to open URL:", err);
    }
  };

  const hasAnyExecutor = availableExecutors.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">
          {t("onboarding.claude.title")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.claude.description")}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => refresh()}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Executors list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("onboarding.claude.aiClients")}</Label>
          <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("common.refresh")}
              </>
            )}
          </Button>
        </div>

        {loading && executors.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t("onboarding.claude.detecting")}
          </div>
        ) : executors.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            {t("onboarding.claude.noClients")}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedExecutors.map((executor) => (
              <ExecutorCard
                key={executor.type}
                executor={executor}
                downloadUrl={EXECUTOR_DOWNLOAD_URLS[executor.type]}
                iconLabel={EXECUTOR_ICONS[executor.type] || executor.type.slice(0, 2)}
                onDownload={handleOpenDownload}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status message */}
      <div
        className={cn(
          "rounded-lg p-4 text-center",
          hasAnyExecutor
            ? "bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Bot className="mx-auto mb-2 h-8 w-8" />
        {hasAnyExecutor ? (
          <>
            <p className="font-medium">
              {t("onboarding.claude.detected", {
                count: availableExecutors.length,
              })}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {t("onboarding.claude.readyToConfigure")}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">{t("onboarding.claude.noClients")}</p>
            <p className="mt-1 text-sm">
              {t("onboarding.claude.noClientsHint")}
            </p>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("common.previous")}
        </Button>
        <Button onClick={onComplete}>{t("common.next")}</Button>
      </div>
    </div>
  );
}

// ============================================================================
// ExecutorCard Component
// ============================================================================

interface ExecutorCardProps {
  executor: ExecutorInfo;
  downloadUrl?: string;
  iconLabel: string;
  onDownload: (url: string) => void;
  t: (key: string) => string;
}

/**
 * Get translated availability status
 */
function getTranslatedAvailabilityStatus(
  availability: ExecutorInfo["availability"] | undefined,
  t: (key: string) => string
): { label: string; variant: "success" | "warning" | "error" } {
  if (!availability) {
    return { label: t("common.unknown"), variant: "error" };
  }
  switch (availability.type) {
    case "LOGIN_DETECTED":
      return { label: t("onboarding.claude.loggedIn"), variant: "success" };
    case "INSTALLATION_FOUND":
      return { label: t("onboarding.claude.installed"), variant: "success" };
    case "NOT_FOUND":
      return { label: t("onboarding.claude.notFound"), variant: "error" };
    default:
      return { label: t("common.unknown"), variant: "warning" };
  }
}

function ExecutorCard({
  executor,
  downloadUrl,
  iconLabel,
  onDownload,
  t,
}: ExecutorCardProps) {
  // Guard against undefined availability
  const isAvailable = executor.availability
    ? isAgentAvailable(executor.availability)
    : false;

  const availabilityInfo = getTranslatedAvailabilityStatus(executor.availability, t);

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition-colors",
        isAvailable ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold",
            isAvailable
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {iconLabel}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{executor.name}</span>
            {executor.supports_mcp && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      MCP
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("onboarding.claude.supportsMcp")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                availabilityInfo.variant === "success" && "text-green-600 dark:text-green-400",
                availabilityInfo.variant === "warning" && "text-yellow-600 dark:text-yellow-400",
                availabilityInfo.variant === "error" && "text-red-600 dark:text-red-400"
              )}
            >
              {availabilityInfo.label}
            </span>
            {executor.description && (
              <>
                <span>·</span>
                <span className="truncate">{executor.description}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="ml-2 shrink-0">
        {isAvailable ? (
          <Check className="h-5 w-5 text-green-500" />
        ) : downloadUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(downloadUrl)}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t("onboarding.claude.download")}
          </Button>
        ) : executor.docs_url ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownload(executor.docs_url!)}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t("common.learnMore")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
