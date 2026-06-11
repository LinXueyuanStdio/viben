/**
 * Context Approval Button Component
 *
 * A compact rounded-rectangle button showing [icon] percentage% format.
 * Hover/click opens a popover with context details and approval mode selector.
 */

import * as React from "react";
import { useState, useCallback, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
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
  /** Render custom popup content. If provided, popup will show on hover/click */
  renderPopup?: (props: ContextPopupRenderProps) => React.ReactNode;
  /** Called when hover state changes. Use this to render popup externally. */
  onHoverChange?: (isHovered: boolean) => void;
  /** Called when button is clicked. Use this to toggle popup externally. */
  onClick?: () => void;
  /** If true, popup is rendered externally and this component only manages hover state */
  externalPopup?: boolean;
}

export interface ContextPopupRenderProps {
  breakdown: ContextTokenBreakdown;
  totalUsed: number;
  usagePercentage: number;
  remaining: number;
  approvalMode: ApprovalMode;
  onApprovalModeChange: (mode: ApprovalMode) => void;
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

function getUsageColor(percentage: number): { text: string; stroke: string } {
  if (percentage > 90) return { text: "text-red-500", stroke: "stroke-red-500" };
  if (percentage > 70) return { text: "text-yellow-500", stroke: "stroke-yellow-500" };
  return { text: "text-muted-foreground", stroke: "stroke-primary" };
}

function MiniCircularProgress({
  percentage,
  size = 20,
  strokeWidth = 2,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const colors = getUsageColor(percentage);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
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
          className={cn("transition-all duration-300", colors.stroke)}
        />
      </svg>
      <span className={cn("text-[8px] font-medium leading-none", colors.text)}>
        {percentage.toFixed(0)}
      </span>
    </div>
  );
}

export function ContextApprovalButton({
  breakdown,
  approvalMode,
  onApprovalModeChange,
  className,
  disabled,
  renderPopup,
  onHoverChange,
  onClick,
  externalPopup,
}: ContextApprovalButtonProps) {
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

  const hasPopup = renderPopup || externalPopup;

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsOpen(true);
    onHoverChange?.(true);
  }, [onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      onHoverChange?.(false);
    }, 150);
  }, [onHoverChange]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
      return;
    }
    setIsOpen((prev) => {
      const next = !prev;
      onHoverChange?.(next);
      return next;
    });
  }, [onClick, onHoverChange]);

  const buttonContent = (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
        "hover:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={hasPopup ? handleClick : undefined}
      disabled={disabled}
      aria-label={`${config.label}, Context 使用率 ${usagePercentage.toFixed(0)}%`}
    >
      <ApprovalIcon className="h-3.5 w-3.5 text-muted-foreground" />
      <MiniCircularProgress percentage={usagePercentage} size={20} strokeWidth={2} />
    </button>
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onMouseEnter={hasPopup ? handleMouseEnter : undefined}
      onMouseLeave={hasPopup ? handleMouseLeave : undefined}
    >
      {/* Only show tooltip when popup is closed */}
      {isOpen ? (
        buttonContent
      ) : (
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              {buttonContent}
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <div className="flex flex-col gap-0.5">
                <span>{config.label}</span>
                <span className="text-muted-foreground">Context: {usagePercentage.toFixed(0)}%</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {isOpen && renderPopup && !externalPopup && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {renderPopup({
            breakdown,
            totalUsed,
            usagePercentage,
            remaining,
            approvalMode,
            onApprovalModeChange,
          })}
        </div>
      )}
    </div>
  );
}

export function useContextApprovalPopupProps(
  breakdown: ContextTokenBreakdown,
  approvalMode: ApprovalMode,
  onApprovalModeChange: (mode: ApprovalMode) => void
): ContextPopupRenderProps {
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

  return {
    breakdown,
    totalUsed,
    usagePercentage,
    remaining,
    approvalMode,
    onApprovalModeChange,
  };
}

export { APPROVAL_MODE_CONFIG };
