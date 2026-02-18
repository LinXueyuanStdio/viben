/**
 * Executors Settings Page
 *
 * Displays installation status of all supported AI coding agent executors.
 * Auto-discovers which executors are installed and available.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExecutorType } from "@viben/core/shared";
import { getGatewayClient, type AvailabilityInfo } from "@/lib/gateway";
import { useGatewayStatus } from "@/hooks/use-gateway-status";

// Executor metadata
interface ExecutorInfo {
  id: ExecutorType;
  name: string;
  description: string;
  website?: string;
  installCommand?: string;
}

const EXECUTORS: ExecutorInfo[] = [
  {
    id: "CLAUDE_CODE",
    name: "CLAUDE_CODE",
    description: "CLAUDE_CODE",
    website: "https://docs.anthropic.com/en/docs/claude-code",
    installCommand: "npm install -g @anthropic-ai/claude-code",
  },
  {
    id: "AMP",
    name: "AMP",
    description: "AMP",
    website: "https://sourcegraph.com/amp",
  },
  {
    id: "GEMINI",
    name: "GEMINI",
    description: "GEMINI",
    website: "https://ai.google.dev/gemini-api",
    installCommand: "npm install -g @anthropic-ai/gemini-cli",
  },
  {
    id: "CODEX",
    name: "CODEX",
    description: "CODEX",
    website: "https://openai.com/codex",
    installCommand: "npm install -g codex-cli",
  },
  {
    id: "OPENCODE",
    name: "OPENCODE",
    description: "OPENCODE",
    website: "https://github.com/opencode-ai/opencode",
  },
  {
    id: "CURSOR_AGENT",
    name: "CURSOR_AGENT",
    description: "CURSOR_AGENT",
    website: "https://cursor.sh",
  },
  {
    id: "QWEN_CODE",
    name: "QWEN_CODE",
    description: "QWEN_CODE",
    website: "https://github.com/QwenLM/Qwen",
  },
  {
    id: "COPILOT",
    name: "COPILOT",
    description: "COPILOT",
    website: "https://github.com/features/copilot",
    installCommand: "gh extension install github/gh-copilot",
  },
  {
    id: "DROID",
    name: "DROID",
    description: "DROID",
    website: "https://developer.android.com",
  },
];

// Executor status
interface ExecutorStatus {
  info: ExecutorInfo;
  availability: AvailabilityInfo | null;
  checking: boolean;
  error?: string;
}

export function SettingsExecutorsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status: gatewayStatus } = useGatewayStatus();
  const [executors, setExecutors] = useState<ExecutorStatus[]>(
    EXECUTORS.map((info) => ({
      info,
      availability: null,
      checking: false,
    }))
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check single executor availability
  const checkExecutor = useCallback(async (executorId: ExecutorType) => {
    setExecutors((prev) =>
      prev.map((e) =>
        e.info.id === executorId ? { ...e, checking: true, error: undefined } : e
      )
    );

    try {
      const client = getGatewayClient();
      const availability = await client.checkAvailability(executorId);
      setExecutors((prev) =>
        prev.map((e) =>
          e.info.id === executorId
            ? { ...e, availability, checking: false }
            : e
        )
      );
    } catch (err) {
      setExecutors((prev) =>
        prev.map((e) =>
          e.info.id === executorId
            ? {
                ...e,
                checking: false,
                error: err instanceof Error ? err.message : t("settingsExecutors.checkFailed", "Check failed"),
              }
            : e
        )
      );
    }
  }, [t]);

  // Check all executors
  const checkAllExecutors = useCallback(async () => {
    if (gatewayStatus !== "connected") return;

    setIsRefreshing(true);
    const client = getGatewayClient();

    // Check all in parallel
    await Promise.all(
      EXECUTORS.map(async (info) => {
        setExecutors((prev) =>
          prev.map((e) =>
            e.info.id === info.id ? { ...e, checking: true, error: undefined } : e
          )
        );

        try {
          const availability = await client.checkAvailability(info.id);
          setExecutors((prev) =>
            prev.map((e) =>
              e.info.id === info.id ? { ...e, availability, checking: false } : e
            )
          );
        } catch (err) {
          setExecutors((prev) =>
            prev.map((e) =>
              e.info.id === info.id
                ? {
                    ...e,
                    checking: false,
                    error: err instanceof Error ? err.message : t("settingsExecutors.checkFailed", "Check failed"),
                  }
                : e
            )
          );
        }
      })
    );

    setIsRefreshing(false);
  }, [gatewayStatus, t]);

  // Auto-check on mount when gateway is connected
  useEffect(() => {
    if (gatewayStatus === "connected") {
      checkAllExecutors();
    }
  }, [gatewayStatus, checkAllExecutors]);

  // Get status display
  const getStatusDisplay = (executor: ExecutorStatus) => {
    if (executor.checking) {
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        text: t("settingsExecutors.checking", "检测中..."),
        variant: "neutral" as const,
      };
    }

    if (executor.error) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        text: executor.error,
        variant: "error" as const,
      };
    }

    if (!executor.availability) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        text: t("settingsExecutors.unknown", "未检测"),
        variant: "neutral" as const,
      };
    }

    switch (executor.availability.type) {
      case "LOGIN_DETECTED":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: t("settingsExecutors.loggedIn", "已登录"),
          variant: "success" as const,
        };
      case "INSTALLATION_FOUND":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          text: t("settingsExecutors.installed", "已安装"),
          variant: "success" as const,
        };
      case "NOT_FOUND":
        return {
          icon: <XCircle className="h-4 w-4" />,
          text: t("settingsExecutors.notFound", "未找到"),
          variant: "warning" as const,
        };
      default:
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: t("settingsExecutors.unknown", "未知"),
          variant: "neutral" as const,
        };
    }
  };

  const installedCount = executors.filter(
    (e) =>
      e.availability?.type === "LOGIN_DETECTED" ||
      e.availability?.type === "INSTALLATION_FOUND"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold font-serif mb-1">
            {t("settings.sections.executors", "执行器")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "settings.executorsDescription",
              "检查 AI 编程智能体执行器的安装状态"
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkAllExecutors}
          disabled={gatewayStatus !== "connected" || isRefreshing}
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
          />
          {t("settingsExecutors.refresh", "刷新")}
        </Button>
      </div>

      {/* Gateway warning */}
      {gatewayStatus !== "connected" && (
        <div className="p-4 rounded-xl bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {t(
              "settingsExecutors.gatewayRequired",
              "需要网关连接才能检测执行器状态。请先启动网关服务。"
            )}
          </span>
        </div>
      )}

      {/* Summary */}
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">
              {t("settingsExecutors.summary", "执行器状态")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settingsExecutors.summaryText", "{{installed}}/{{total}} 个执行器可用", {
                installed: installedCount,
                total: EXECUTORS.length,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Executor list */}
      <div className="space-y-3">
        {executors.map((executor) => {
          const status = getStatusDisplay(executor);
          const isAvailable = executor.availability?.type === "LOGIN_DETECTED" ||
            executor.availability?.type === "INSTALLATION_FOUND";

          return (
            <div
              key={executor.info.id}
              className={cn(
                "p-4 rounded-xl border bg-card transition-all duration-300",
                "hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30",
                isAvailable && "cursor-pointer"
              )}
              onClick={() => {
                if (isAvailable) {
                  navigate(`/executor/${executor.info.id}`);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{t(`settingsExecutors.executorNames.${executor.info.id}`, executor.info.name)}</h3>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                        status.variant === "success" &&
                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                        status.variant === "warning" &&
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                        status.variant === "error" &&
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        status.variant === "neutral" &&
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {status.icon}
                      {status.text}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(`settingsExecutors.executors.${executor.info.id}`, executor.info.description)}
                  </p>

                  {/* Install command for not-found executors */}
                  {executor.availability?.type === "NOT_FOUND" &&
                    executor.info.installCommand && (
                      <div className="mt-3 p-2 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">
                          {t("settingsExecutors.installHint", "安装命令:")}
                        </p>
                        <code className="text-xs font-mono">
                          {executor.info.installCommand}
                        </code>
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {executor.info.website && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(executor.info.website, "_blank");
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      checkExecutor(executor.info.id);
                    }}
                    disabled={gatewayStatus !== "connected" || executor.checking}
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        executor.checking && "animate-spin"
                      )}
                    />
                  </Button>
                  {isAvailable && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
