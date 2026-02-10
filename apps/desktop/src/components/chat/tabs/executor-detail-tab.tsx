/**
 * Executor detail tab content for the right sidebar
 *
 * Uses the ExecutorDetailPanel component with compact mode for sidebar display.
 */
import { useTranslation } from "react-i18next";
import { Terminal, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExecutorDetailPanel } from "@/components/chat/executor-detail-panel";
import type { ExecutorDetailTabContentProps } from "./types";

/**
 * Executor detail tab content
 *
 * Shows executor details in compact mode for the sidebar.
 * If workspaceId is provided, uses the full ExecutorDetailPanel with capabilities.
 * Otherwise falls back to a simple display.
 */
export function ExecutorDetailTabContent({
  executor,
  workspaceId,
  onSettings,
}: ExecutorDetailTabContentProps) {
  const { t } = useTranslation();

  // If workspaceId is provided, use the full ExecutorDetailPanel
  if (workspaceId) {
    return (
      <ExecutorDetailPanel
        executor={{
          id: executor.id,
          name: executor.name,
          type: executor.type,
          config_path: undefined, // Not available in ExecutorDetailInfo
        }}
        workspaceId={workspaceId}
        onNavigateToEdit={onSettings ? () => onSettings(executor.id) : undefined}
        showHeader={true}
        showConfigButton={!!onSettings}
        compact={true}
      />
    );
  }

  // Fallback simple display when workspaceId is not available
  const getStatusColor = () => {
    switch (executor.status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getTypeGradient = () => {
    const gradients: Record<string, string> = {
      "claude-code": "from-amber-500 to-orange-400",
      codex: "from-green-500 to-emerald-400",
      cursor: "from-purple-500 to-violet-400",
      windsurf: "from-blue-500 to-cyan-400",
      vscode: "from-sky-500 to-blue-400",
    };
    return gradients[executor.type] || "from-gray-500 to-slate-400";
  };

  return (
    <div className="space-y-4">
      {/* Executor Info Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className={cn(
          "relative w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-md",
          getTypeGradient()
        )}>
          <Terminal className="h-6 w-6 text-white" />
          {/* Status indicator */}
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
            getStatusColor()
          )} />
        </div>
        <div>
          <h3 className="font-semibold">{executor.name}</h3>
          <p className="text-xs text-muted-foreground">{executor.type}</p>
        </div>
      </div>

      <Separator />

      {/* Executor Details */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("executor.type", "Type")}</span>
          <span className="font-medium capitalize">{executor.type.replace("-", " ")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("executor.status", "Status")}</span>
          <span className={cn(
            "font-medium capitalize",
            executor.status === "online" && "text-green-600",
            executor.status === "offline" && "text-red-600"
          )}>
            {executor.status || t("common.unknown", "Unknown")}
          </span>
        </div>
      </div>

      {/* Actions */}
      {onSettings && (
        <>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onSettings(executor.id)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {t("executor.settings", "Executor Settings")}
          </Button>
        </>
      )}
    </div>
  );
}
