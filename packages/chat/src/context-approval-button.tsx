/**
 * Context Approval Button Component
 *
 * A button with a circular progress border showing context usage percentage.
 * Center contains an approval mode icon and percentage text.
 * Hover/click opens a popover with context details and approval mode selector.
 */

import * as React from "react";
import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  FileText,
} from "lucide-react";
import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@viben/ui";
import type { ContextTokenBreakdown } from "./types";

export type ApprovalMode = "bypass" | "rules" | "ai";

export interface ContextApprovalButtonProps {
  breakdown: ContextTokenBreakdown;
  approvalMode: ApprovalMode;
  onApprovalModeChange: (mode: ApprovalMode) => void;
  className?: string;
  disabled?: boolean;
}

const APPROVAL_MODE_CONFIG: Record<ApprovalMode, { icon: typeof ShieldCheck; label: string; description: string }> = {
  bypass: {
    icon: ShieldOff,
    label: "绕过审批",
    description: "跳过所有审批步骤",
  },
  rules: {
    icon: ShieldCheck,
    label: "规则审批",
    description: "根据预设规则自动审批",
  },
  ai: {
    icon: ShieldAlert,
    label: "AI 审批",
    description: "由 AI 评估并审批",
  },
};

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

function TokenProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatTokens(value)}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function CircularProgress({
  percentage,
  size = 40,
  strokeWidth = 3,
  children,
  className,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const progressColor = percentage > 90
    ? "stroke-red-500"
    : percentage > 70
      ? "stroke-yellow-500"
      : "stroke-primary";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="absolute -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-all duration-300", progressColor)}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function ContextApprovalButton({
  breakdown,
  approvalMode,
  onApprovalModeChange,
  className,
  disabled,
}: ContextApprovalButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalUsed =
    breakdown.assistantProfile +
    breakdown.skillSettings +
    breakdown.historySummary +
    breakdown.conversationMessages;

  const usagePercentage =
    breakdown.totalContext > 0
      ? Math.min((totalUsed / breakdown.totalContext) * 100, 100)
      : 0;

  const remaining = Math.max(0, breakdown.totalContext - totalUsed);

  const config = APPROVAL_MODE_CONFIG[approvalMode];
  const ApprovalIcon = config.icon;

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, []);

  const handleClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center justify-center rounded-full transition-all",
                "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleClick}
              disabled={disabled}
            >
              <CircularProgress percentage={usagePercentage} size={44} strokeWidth={2.5}>
                <ApprovalIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] font-medium text-muted-foreground leading-none mt-0.5">
                  {usagePercentage.toFixed(0)}%
                </span>
              </CircularProgress>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="flex flex-col gap-0.5">
              <span>{config.label}</span>
              <span className="text-muted-foreground">Context: {usagePercentage.toFixed(0)}%</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[320px] rounded-lg border border-border bg-popover p-4 shadow-xl"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {t("chat.contextApproval.title", "Context & 审批模式")}
            </span>
          </div>

          {/* Overall usage bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">
                {t("chat.agentInput.tokenUsage.used", "已使用")}
              </span>
              <span className="font-medium">
                {formatTokens(totalUsed)} / {formatTokens(breakdown.totalContext)}
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePercentage > 90
                    ? "bg-red-500"
                    : usagePercentage > 70
                      ? "bg-yellow-500"
                      : "bg-primary"
                )}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs mt-1 text-muted-foreground">
              <span>{usagePercentage.toFixed(1)}%</span>
              <span>
                {t("chat.agentInput.tokenUsage.remaining", "剩余")}: {formatTokens(remaining)}
              </span>
            </div>
          </div>

          {/* Breakdown by category */}
          <div className="space-y-2 mb-4">
            <TokenProgressBar
              label={t("chat.agentInput.tokenUsage.assistantProfile", "助手配置")}
              value={breakdown.assistantProfile}
              total={breakdown.totalContext}
              color="bg-blue-500"
            />
            <TokenProgressBar
              label={t("chat.agentInput.tokenUsage.skillSettings", "技能设置")}
              value={breakdown.skillSettings}
              total={breakdown.totalContext}
              color="bg-purple-500"
            />
            <TokenProgressBar
              label={t("chat.agentInput.tokenUsage.historySummary", "历史摘要")}
              value={breakdown.historySummary}
              total={breakdown.totalContext}
              color="bg-amber-500"
            />
            <TokenProgressBar
              label={t("chat.agentInput.tokenUsage.conversationMessages", "对话消息")}
              value={breakdown.conversationMessages}
              total={breakdown.totalContext}
              color="bg-green-500"
            />
          </div>

          {/* Approval Mode Selector */}
          <div className="pt-3 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {t("chat.contextApproval.approvalMode", "审批模式")}
            </div>
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
              {(Object.keys(APPROVAL_MODE_CONFIG) as ApprovalMode[]).map((mode) => {
                const modeConfig = APPROVAL_MODE_CONFIG[mode];
                const ModeIcon = modeConfig.icon;
                const isActive = approvalMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-all",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                    onClick={() => onApprovalModeChange(mode)}
                    title={modeConfig.description}
                  >
                    <ModeIcon className="h-3.5 w-3.5" />
                    <span className="truncate">{modeConfig.label}</span>
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
