/**
 * Context Approval Popup Component
 *
 * A collapsible card showing context token usage breakdown and approval mode selector.
 * Designed to match BackgroundTaskList and TodoListPanel style.
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
import type { ApprovalMode, ContextPopupRenderProps } from "./context-approval-button";
import { APPROVAL_MODE_CONFIG } from "./context-approval-button";

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

interface TokenBreakdownItemProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function TokenBreakdownItem({ label, value, total, color }: TokenBreakdownItemProps) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5 text-xs">
      <div className={cn("size-2 shrink-0 rounded-full", color)} />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums text-foreground">
        {formatTokens(value)}
      </span>
      <span className="shrink-0 w-12 text-right tabular-nums text-muted-foreground">
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}

export function ContextApprovalPopup({
  breakdown,
  totalUsed,
  usagePercentage,
  remaining,
  approvalMode,
  onApprovalModeChange,
  className,
  defaultExpanded = true,
}: ContextApprovalPopupProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const currentModeConfig = APPROVAL_MODE_CONFIG[approvalMode];
  const CurrentModeIcon = currentModeConfig.icon;

  return (
    <div className={cn("w-[300px] rounded-lg border border-border bg-card text-card-foreground p-3 shadow-lg", className)}>
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
          {/* Overall usage bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{formatTokens(totalUsed)} / {formatTokens(breakdown.totalContext)}</span>
              <span>{t("chat.agentInput.tokenUsage.remaining", "剩余")} {formatTokens(remaining)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getUsageBarColor(usagePercentage))}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>

          {/* Token breakdown list */}
          <div className="space-y-1">
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.assistantProfile", "助手配置")}
              value={breakdown.assistantProfile}
              total={breakdown.totalContext}
              color="bg-blue-500"
            />
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.skillSettings", "技能设置")}
              value={breakdown.skillSettings}
              total={breakdown.totalContext}
              color="bg-purple-500"
            />
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.historySummary", "历史摘要")}
              value={breakdown.historySummary}
              total={breakdown.totalContext}
              color="bg-amber-500"
            />
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.conversationMessages", "对话消息")}
              value={breakdown.conversationMessages}
              total={breakdown.totalContext}
              color="bg-green-500"
            />
          </div>

          {/* Approval Mode Selector */}
          <div className="pt-2 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {t("chat.contextApproval.approvalMode", "审批模式")}
            </div>
            <div className="space-y-1">
              {(Object.keys(APPROVAL_MODE_CONFIG) as ApprovalMode[]).map((mode) => {
                const modeConfig = APPROVAL_MODE_CONFIG[mode];
                const ModeIcon = modeConfig.icon;
                const isActive = approvalMode === mode;
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
                    onClick={() => onApprovalModeChange(mode)}
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
