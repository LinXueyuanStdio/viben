/**
 * AI Clients Section Component for EnvCheck
 *
 * Displays the list of AI clients (executors) within the environment check flow.
 * Extracted from step-claude.tsx for use in EnvCheckStepItem expandable content.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { cn } from "@/lib/utils";
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

// ============================================================================
// Types
// ============================================================================

export interface AiClientsSectionProps {
  /** List of executor statuses */
  executors: ExecutorInfo[];
  /** Whether loading executors */
  isLoading?: boolean;
  /** Error message if loading failed */
  error?: string | null;
  /** Callback to refresh executor list */
  onRefresh?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Executor type to download URL mapping */
const EXECUTOR_DOWNLOAD_URLS: Partial<Record<ExecutorType, string>> = {
  CLAUDE_CODE: "https://claude.ai/download",
  CURSOR_AGENT: "https://cursor.sh/",
  CODEX: "https://github.com/openai/codex",
  GEMINI: "https://gemini.google.com/",
  COPILOT: "https://github.com/features/copilot",
  QWEN_CODE: "https://qwen.aliyun.com/",
};

/** Executor type to short icon label mapping */
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

// ============================================================================
// Helper Functions
// ============================================================================

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

  const availabilityInfo = getTranslatedAvailabilityStatus(
    executor.availability,
    t
  );

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
            "flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold",
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
            <span className="font-medium text-sm">{executor.name}</span>
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
                availabilityInfo.variant === "success" &&
                  "text-green-600 dark:text-green-400",
                availabilityInfo.variant === "warning" &&
                  "text-yellow-600 dark:text-yellow-400",
                availabilityInfo.variant === "error" &&
                  "text-red-600 dark:text-red-400"
              )}
            >
              {availabilityInfo.label}
            </span>
            {executor.description && (
              <>
                <span>·</span>
                <span className="truncate max-w-[150px]">
                  {executor.description}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="ml-2 shrink-0">
        {isAvailable ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : downloadUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload(downloadUrl)}
          >
            <ExternalLink className="mr-1.5 h-3 w-3" />
            {t("onboarding.claude.download")}
          </Button>
        ) : executor.docs_url ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownload(executor.docs_url!)}
          >
            <ExternalLink className="mr-1.5 h-3 w-3" />
            {t("common.learnMore")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AiClientsSection({
  executors,
  isLoading,
  error,
  onRefresh,
}: AiClientsSectionProps) {
  const { t } = useTranslation();

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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-sm">{t("onboarding.claude.aiClients")}</Label>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("common.refresh")}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Executors list */}
      {isLoading && executors.length === 0 ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm">{t("onboarding.claude.detecting")}</span>
        </div>
      ) : executors.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("onboarding.claude.noClients")}
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sortedExecutors.map((executor) => (
            <ExecutorCard
              key={executor.type}
              executor={executor}
              downloadUrl={EXECUTOR_DOWNLOAD_URLS[executor.type]}
              iconLabel={
                EXECUTOR_ICONS[executor.type] || executor.type.slice(0, 2)
              }
              onDownload={handleOpenDownload}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
