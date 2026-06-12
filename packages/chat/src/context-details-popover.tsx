/**
 * Context Details Popover
 *
 * Shows context token usage with a progress bar.
 */

import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { cn } from "@viben/ui";
import type { ContextTokenBreakdown } from "./types";

export interface ContextDetailsPopoverProps {
  breakdown: ContextTokenBreakdown;
  className?: string;
}

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
};

export function ContextDetailsPopover({
  breakdown,
  className,
}: ContextDetailsPopoverProps) {
  const { t } = useTranslation();

  const remaining = Math.max(0, breakdown.size - breakdown.used);
  const usagePercentage =
    breakdown.size > 0
      ? Math.min((breakdown.used / breakdown.size) * 100, 100)
      : 0;

  return (
    <div className={cn("w-[280px]", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t("chat.agentInput.tokenUsage.title", "Context Details")}
        </span>
      </div>

      {/* Usage bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">
            {t("chat.agentInput.tokenUsage.used", "Used")}
          </span>
          <span className="font-medium">
            {formatTokens(breakdown.used)} / {formatTokens(breakdown.size)}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
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
            {t("chat.agentInput.tokenUsage.remaining", "Remaining")}:{" "}
            {formatTokens(remaining)}
          </span>
        </div>
      </div>

      {/* Cost */}
      {breakdown.cost && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("chat.agentInput.tokenUsage.cost", "费用")}
            </span>
            <span className="font-medium tabular-nums">
              ${breakdown.cost.amount.toFixed(4)} {breakdown.cost.currency}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
