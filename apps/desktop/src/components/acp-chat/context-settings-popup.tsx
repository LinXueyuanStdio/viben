import { useTranslation } from "react-i18next";
import { FolderTree, ListTodo, Shrink } from "lucide-react";
import { cn, Switch, Label } from "@viben/ui";
import type { ApprovalMode } from "@viben/chat";
import { APPROVAL_MODE_CONFIG } from "@viben/chat";

export interface ContextSettingsPopupProps {
  hasSession: boolean;
  used: number;
  size: number;
  cost: { amount: number; currency: string } | null;
  approvalMode: ApprovalMode;
  onApprovalModeChange: (mode: ApprovalMode) => void;
  sandbox: boolean;
  onSandboxChange: (v: boolean) => void;
  worktree: boolean;
  onWorktreeChange: (v: boolean) => void;
  backgroundTask: boolean;
  onBackgroundTaskChange: (v: boolean) => void;
  onCompact: () => void;
  className?: string;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

function getUsageBarColor(percentage: number): string {
  if (percentage > 90) return "bg-red-500";
  if (percentage > 70) return "bg-yellow-500";
  return "bg-primary";
}

const MODES: ApprovalMode[] = ["bypass", "rules", "ai"];

export function ContextSettingsPopup({
  hasSession,
  used,
  size,
  cost,
  approvalMode,
  onApprovalModeChange,
  sandbox,
  onSandboxChange,
  worktree,
  onWorktreeChange,
  backgroundTask,
  onBackgroundTaskChange,
  onCompact,
  className,
}: ContextSettingsPopupProps) {
  const { t } = useTranslation();

  if (!hasSession) {
    return (
      <div className={cn("w-[240px] rounded-lg border border-border bg-card text-card-foreground p-3 shadow-lg", className)}>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="ctx-sandbox"
              className={cn(
                "text-xs font-medium cursor-pointer transition-colors",
                sandbox ? "text-amber-500" : "text-muted-foreground"
              )}
            >
              {t("chat.sandbox")}
            </Label>
            <Switch
              id="ctx-sandbox"
              checked={sandbox}
              onCheckedChange={onSandboxChange}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label
              htmlFor="ctx-worktree"
              className={cn(
                "text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors",
                worktree ? "text-blue-500" : "text-muted-foreground"
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              {t("chat.worktree")}
            </Label>
            <Switch
              id="ctx-worktree"
              checked={worktree}
              onCheckedChange={onWorktreeChange}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label
              htmlFor="ctx-bg-task"
              className={cn(
                "text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors",
                backgroundTask ? "text-green-500" : "text-muted-foreground"
              )}
            >
              <ListTodo className="h-3.5 w-3.5" />
              {t("chat.backgroundTask.title")}
            </Label>
            <Switch
              id="ctx-bg-task"
              checked={backgroundTask}
              onCheckedChange={onBackgroundTaskChange}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
        </div>
      </div>
    );
  }

  const usagePercentage = size > 0 ? Math.min((used / size) * 100, 100) : 0;
  const remaining = Math.max(0, size - used);

  return (
    <div className={cn("w-[280px] rounded-lg border border-border bg-card text-card-foreground p-3 shadow-lg", className)}>
      {/* Usage progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{formatTokens(used)} / {formatTokens(size)}</span>
          <span>{t("chat.agentInput.tokenUsage.remaining", "剩余")} {formatTokens(remaining)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", getUsageBarColor(usagePercentage))}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
      </div>

      {/* Cost display */}
      {cost && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{t("chat.agentInput.tokenUsage.cost", "费用")}</span>
          <span className="tabular-nums text-foreground">
            ${cost.amount.toFixed(4)} {cost.currency}
          </span>
        </div>
      )}

      {/* Approval mode segmented control */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          {t("chat.contextApproval.approvalMode", "审批模式")}
        </div>
        <div className="flex h-8 rounded-md border border-border overflow-hidden">
          {MODES.map((mode, idx) => {
            const config = APPROVAL_MODE_CONFIG[mode];
            const Icon = config.icon;
            const isActive = approvalMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 text-xs transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
                  idx < MODES.length - 1 && "border-r border-border",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => onApprovalModeChange(mode)}
              >
                <Icon className="size-3.5" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact context button */}
      <div className="mt-3 pt-3 border-t border-border">
        <button
          type="button"
          onClick={onCompact}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5",
            "text-xs font-medium transition-colors",
            "border border-border",
            "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Shrink className="size-3.5" />
          {t("chat.compactContext", "压缩上下文")}
        </button>
      </div>
    </div>
  );
}
