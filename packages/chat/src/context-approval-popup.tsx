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
  Circle,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
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

function getUsageStatusColor(percentage: number): string {
  if (percentage > 90) return "text-red-500";
  if (percentage > 70) return "text-yellow-500";
  return "text-emerald-500";
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
    <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/50">
      <Circle className={cn("size-2 shrink-0 fill-current", color)} />
      <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatTokens(value)}
      </span>
      <span className="shrink-0 w-10 text-right text-[10px] text-muted-foreground">
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

  return (
    <div className={cn("w-[320px] rounded-lg border bg-card p-2 text-left", className)}>
      {/* Header */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <currentModeConfig.icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">
          {t("chat.contextApproval.title", "Context")}
        </span>
        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
          {usagePercentage.toFixed(0)}%
        </Badge>
        <span className="min-w-0 truncate text-muted-foreground">
          {formatTokens(totalUsed)} / {formatTokens(breakdown.totalContext)}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <>
          {/* Overall usage bar */}
          <div className="mt-2 px-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getUsageBarColor(usagePercentage))}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1 text-muted-foreground">
              <span className={getUsageStatusColor(usagePercentage)}>
                {usagePercentage.toFixed(1)}%
              </span>
              <span>
                {t("chat.agentInput.tokenUsage.remaining", "剩余")}: {formatTokens(remaining)}
              </span>
            </div>
          </div>

          {/* Token breakdown list */}
          <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.assistantProfile", "助手配置")}
              value={breakdown.assistantProfile}
              total={breakdown.totalContext}
              color="text-blue-500"
            />
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.skillSettings", "技能设置")}
              value={breakdown.skillSettings}
              total={breakdown.totalContext}
              color="text-purple-500"
            />
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.historySummary", "历史摘要")}
              value={breakdown.historySummary}
              total={breakdown.totalContext}
              color="text-amber-500"
            />
            <TokenBreakdownItem
              label={t("chat.agentInput.tokenUsage.conversationMessages", "对话消息")}
              value={breakdown.conversationMessages}
              total={breakdown.totalContext}
              color="text-green-500"
            />
          </div>

          {/* Approval Mode Selector */}
          <div className="mt-2 pt-2 border-t border-border">
            <div className="text-[10px] font-medium text-muted-foreground px-1 mb-1.5">
              {t("chat.contextApproval.approvalMode", "审批模式")}
            </div>
            <div className="space-y-0.5">
              {(Object.keys(APPROVAL_MODE_CONFIG) as ApprovalMode[]).map((mode) => {
                const modeConfig = APPROVAL_MODE_CONFIG[mode];
                const ModeIcon = modeConfig.icon;
                const isActive = approvalMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                    onClick={() => onApprovalModeChange(mode)}
                  >
                    <ModeIcon className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1">{modeConfig.label}</span>
                    {isActive && (
                      <Circle className="size-2 shrink-0 fill-primary text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
