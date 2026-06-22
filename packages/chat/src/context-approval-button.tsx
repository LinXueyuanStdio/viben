/**
 * Context Permission Button Component
 *
 * A compact rounded-rectangle button showing [icon] percentage% format.
 * Hover/click opens a popover with context details and permission mode selector.
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

export type PermissionMode = "bypass" | "rules" | "ai";

export interface ContextApprovalButtonProps {
  breakdown: ContextTokenBreakdown;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
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
  usagePercentage: number;
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
}

const PERMISSION_MODE_CONFIG: Record<PermissionMode, { icon: typeof ShieldCheck; label: string; description: string }> = {
  bypass: {
    icon: ShieldOff,
    label: "绕过权限",
    description: "跳过所有权限确认步骤",
  },
  rules: {
    icon: ShieldCheck,
    label: "规则权限",
    description: "根据预设规则处理权限确认",
  },
  ai: {
    icon: ShieldAlert,
    label: "AI 权限",
    description: "由 AI 评估权限确认",
  },
};

function getUsageColor(percentage: number): { text: string; color: string } {
  if (percentage > 90) return { text: "text-red-500", color: "var(--color-red-500, #ef4444)" };
  if (percentage > 70) return { text: "text-yellow-500", color: "var(--color-yellow-500, #eab308)" };
  return { text: "text-muted-foreground", color: "var(--primary, #6366f1)" };
}

function MiniCircularProgress({
  percentage,
  size = 20,
  strokeWidth = 3,
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
          strokeWidth={strokeWidth}
          style={{ stroke: "color-mix(in oklch, currentColor 20%, transparent)" }}
          className="text-muted-foreground"
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
          style={{ stroke: colors.color, transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <span className={cn("text-[8px] font-semibold leading-none tabular-nums", colors.text)}>
        {percentage.toFixed(0)}
      </span>
    </div>
  );
}

export function ContextApprovalButton({
  breakdown,
  permissionMode,
  onPermissionModeChange,
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

  const usagePercentage =
    breakdown.size > 0
      ? Math.min((breakdown.used / breakdown.size) * 100, 100)
      : 0;

  const config = PERMISSION_MODE_CONFIG[permissionMode];
  const PermissionIcon = config.icon;

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
      <PermissionIcon className="h-4 w-4 text-muted-foreground" />
      <MiniCircularProgress percentage={usagePercentage} />
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
            usagePercentage,
            permissionMode,
            onPermissionModeChange,
          })}
        </div>
      )}
    </div>
  );
}

export function useContextPermissionPopupProps(
  breakdown: ContextTokenBreakdown,
  permissionMode: PermissionMode,
  onPermissionModeChange: (mode: PermissionMode) => void
): ContextPopupRenderProps {
  const usagePercentage =
    breakdown.size > 0
      ? Math.min((breakdown.used / breakdown.size) * 100, 100)
      : 0;

  return {
    breakdown,
    usagePercentage,
    permissionMode,
    onPermissionModeChange,
  };
}

export { PERMISSION_MODE_CONFIG };
