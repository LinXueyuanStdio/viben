/**
 * Context Permission Popup Component
 *
 * A collapsible card showing context token usage and permission mode selector.
 */

import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Check,
} from "lucide-react";
import { Badge, cn } from "@viben/ui";
import type { ContextTokenBreakdown } from "./types";
import type { ContextPopupRenderProps, PermissionMode } from "./context-approval-button";
import { PERMISSION_MODE_CONFIG } from "./context-approval-button";

export interface ContextApprovalPopupProps extends ContextPopupRenderProps {
  className?: string;
  defaultExpanded?: boolean;
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

export function ContextApprovalPopup({
  breakdown,
  usagePercentage,
  permissionMode,
  onPermissionModeChange,
  className,
  defaultExpanded = true,
}: ContextApprovalPopupProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const remaining = Math.max(0, breakdown.size - breakdown.used);
  const currentModeConfig = PERMISSION_MODE_CONFIG[permissionMode];
  const CurrentModeIcon = currentModeConfig.icon;

  return (
    <div className={cn("w-[280px] rounded-lg border border-border bg-card text-card-foreground p-3 shadow-lg", className)}>
      {/* Header - clickable to expand/collapse */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 text-left text-sm transition-colors hover:text-foreground focus-visible:outline-none"
      >
        <CurrentModeIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">
          {t("chat.contextApproval.title", "Context")}
        </span>
        <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs tabular-nums">
          {usagePercentage.toFixed(0)}%
        </Badge>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Usage bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{formatTokens(breakdown.used)} / {formatTokens(breakdown.size)}</span>
              <span>{t("chat.agentInput.tokenUsage.remaining", "剩余")} {formatTokens(remaining)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getUsageBarColor(usagePercentage))}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>

          {/* Cost */}
          {breakdown.cost && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("chat.agentInput.tokenUsage.cost", "费用")}</span>
              <span className="tabular-nums text-foreground">
                ${breakdown.cost.amount.toFixed(4)} {breakdown.cost.currency}
              </span>
            </div>
          )}

          {/* Permission Mode Selector */}
          <div className="pt-2 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {t("chat.contextApproval.permissionMode", "权限模式")}
            </div>
            <div className="space-y-1">
              {(Object.keys(PERMISSION_MODE_CONFIG) as PermissionMode[]).map((mode) => {
                const modeConfig = PERMISSION_MODE_CONFIG[mode];
                const ModeIcon = modeConfig.icon;
                const isActive = permissionMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => onPermissionModeChange(mode)}
                  >
                    <ModeIcon className="size-3.5 shrink-0" />
                    <span className="flex-1">{modeConfig.label}</span>
                    {isActive && (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
