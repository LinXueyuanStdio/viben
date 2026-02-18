import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertCircle, Loader2, ExternalLink, Bot } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { cn } from "@/lib/utils";
import { useExecutors } from "@/hooks/use-workspace-resources";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface StepClaudeProps {
  onComplete: () => void;
  onBack: () => void;
}

// AI client information with download links
const AI_CLIENTS = [
  {
    id: "claude",
    name: "Claude Desktop",
    configFolder: ".claude",
    downloadUrl: "https://claude.ai/download",
    icon: "C",
  },
  {
    id: "cursor",
    name: "Cursor",
    configFolder: ".cursor",
    downloadUrl: "https://cursor.sh/",
    icon: "Cu",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    configFolder: ".windsurf",
    downloadUrl: "https://codeium.com/windsurf",
    icon: "W",
  },
  {
    id: "codex",
    name: "OpenAI Codex CLI",
    configFolder: ".codex",
    downloadUrl: "https://github.com/openai/codex",
    icon: "Cx",
  },
];

export function StepClaude({ onComplete, onBack }: StepClaudeProps) {
  const { t } = useTranslation();
  const { executors, loading, error, refresh } = useExecutors();

  // Map detected executors to AI clients
  const detectedClients = React.useMemo(() => {
    const detected = new Set<string>();
    for (const executor of executors) {
      const isInstalled =
        executor.availability.type === "LOGIN_DETECTED" ||
        executor.availability.type === "INSTALLATION_FOUND";
      if (!isInstalled) continue;

      // Map executor types to client IDs
      const executorId = executor.type.toLowerCase();
      if (executorId.includes("claude")) {
        // CLAUDE_CODE -> claude for Claude Desktop detection
        if (executor.global_config_path?.includes("Claude")) {
          detected.add("claude");
        }
      }
      if (executorId.includes("cursor")) {
        detected.add("cursor");
      }
      // Check config paths for other clients
      const configPath = executor.workspace_config_path || executor.global_config_path;
      if (configPath) {
        for (const client of AI_CLIENTS) {
          if (configPath.includes(client.configFolder)) {
            detected.add(client.id);
          }
        }
      }
    }
    return detected;
  }, [executors]);

  const handleOpenDownload = async (url: string) => {
    await open(url);
  };

  const hasAnyClient = detectedClients.size > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.claude.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("onboarding.claude.description")}</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI clients list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("onboarding.claude.aiClients")}</Label>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.refresh")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t("onboarding.claude.detecting")}
          </div>
        ) : (
          <div className="space-y-2">
            {AI_CLIENTS.map((client) => {
              const isDetected = detectedClients.has(client.id);
              return (
                <div
                  key={client.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors",
                    isDetected ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold",
                        isDetected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {client.icon}
                    </div>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {isDetected ? t("common.installed") : t("common.notInstalled")}
                      </div>
                    </div>
                  </div>
                  {isDetected ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDownload(client.downloadUrl)}
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      {t("onboarding.claude.download")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status message */}
      <div
        className={cn(
          "rounded-lg p-4 text-center",
          hasAnyClient ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"
        )}
      >
        <Bot className="mx-auto mb-2 h-8 w-8" />
        {hasAnyClient ? (
          <>
            <p className="font-medium">{t("onboarding.claude.detected", { count: detectedClients.size })}</p>
            <p className="mt-1 text-sm opacity-80">{t("onboarding.claude.readyToConfigure")}</p>
          </>
        ) : (
          <>
            <p className="font-medium">{t("onboarding.claude.noClients")}</p>
            <p className="mt-1 text-sm">{t("onboarding.claude.noClientsHint")}</p>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          {t("common.previous")}
        </Button>
        <Button onClick={onComplete}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
