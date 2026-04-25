/**
 * Context Details Popover
 *
 * Shows token usage breakdown with progress bars.
 * Categories: Assistant Profile, Skill Settings, History Summary, Conversation Messages
 */

import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextTokenBreakdown {
  /** Tokens used by assistant profile/persona */
  assistantProfile: number;
  /** Tokens used by skill settings */
  skillSettings: number;
  /** Tokens used by history summary */
  historySummary: number;
  /** Tokens used by conversation messages */
  conversationMessages: number;
  /** Total context window size */
  totalContext: number;
}

interface ContextDetailsPopoverProps {
  breakdown: ContextTokenBreakdown;
  className?: string;
}

// Format token count for display
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
};

// Progress bar component
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
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function ContextDetailsPopover({
  breakdown,
  className,
}: ContextDetailsPopoverProps) {
  const { t } = useTranslation();

  const totalUsed =
    breakdown.assistantProfile +
    breakdown.skillSettings +
    breakdown.historySummary +
    breakdown.conversationMessages;

  const remaining = Math.max(0, breakdown.totalContext - totalUsed);
  const usagePercentage =
    breakdown.totalContext > 0
      ? Math.min((totalUsed / breakdown.totalContext) * 100, 100)
      : 0;

  return (
    <div className={cn("w-[320px]", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">
          {t("chat.agentInput.tokenUsage.title", "Context Details")}
        </span>
      </div>

      {/* Overall usage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">
            {t("chat.agentInput.tokenUsage.used", "Used")}
          </span>
          <span className="font-medium">
            {formatTokens(totalUsed)} / {formatTokens(breakdown.totalContext)}
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

      {/* Breakdown by category */}
      <div className="space-y-3">
        <TokenProgressBar
          label={t(
            "chat.agentInput.tokenUsage.assistantProfile",
            "Assistant Profile"
          )}
          value={breakdown.assistantProfile}
          total={breakdown.totalContext}
          color="bg-blue-500"
        />
        <TokenProgressBar
          label={t("chat.agentInput.tokenUsage.skillSettings", "Skill Settings")}
          value={breakdown.skillSettings}
          total={breakdown.totalContext}
          color="bg-purple-500"
        />
        <TokenProgressBar
          label={t(
            "chat.agentInput.tokenUsage.historySummary",
            "History Summary"
          )}
          value={breakdown.historySummary}
          total={breakdown.totalContext}
          color="bg-amber-500"
        />
        <TokenProgressBar
          label={t(
            "chat.agentInput.tokenUsage.conversationMessages",
            "Conversation Messages"
          )}
          value={breakdown.conversationMessages}
          total={breakdown.totalContext}
          color="bg-green-500"
        />
      </div>

      {/* Total summary */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("chat.agentInput.tokenUsage.total", "Total")}
          </span>
          <span className="font-medium">{formatTokens(breakdown.totalContext)}</span>
        </div>
      </div>
    </div>
  );
}
