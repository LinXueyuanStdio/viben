/**
 * Setup Step Row Component
 *
 * A minimal, single-line step indicator for the gateway setup flow.
 * Shows: icon + label + optional detail/countdown on the right.
 *
 * Accessibility: Uses aria-live for screen reader announcements on state changes.
 */

import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type StepState = "idle" | "running" | "success" | "error" | "retrying";

export interface SetupStepRowProps {
  label: string;
  state: StepState;
  /** Error message (shown when state is error) */
  error?: string;
  /** Suggestion for how to fix the error */
  suggestion?: string;
  /** Countdown seconds until next retry (shown when state is retrying) */
  retryCountdown?: number;
  /** Retry attempt info like "2/3" */
  retryInfo?: string;
  /** Manual retry callback */
  onRetry?: () => void;
  /** Additional detail shown on success (e.g., "PID: 1234") */
  detail?: string;
  className?: string;
}

export function SetupStepRow({
  label,
  state,
  error,
  suggestion,
  retryCountdown,
  retryInfo,
  onRetry,
  detail,
  className,
}: SetupStepRowProps) {
  const { t } = useTranslation();

  // Get status text for screen readers
  const getStatusText = (): string => {
    switch (state) {
      case "idle": return t("common.pending");
      case "running": return t("common.checking");
      case "success": return t("common.success");
      case "error": return t("common.error");
      case "retrying": return t("common.retrying");
      default: return "";
    }
  };

  return (
    <div
      className={cn("space-y-1", className)}
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${getStatusText()}`}
    >
      {/* Screen reader only status */}
      <span className="sr-only">{getStatusText()}</span>

      {/* Main row */}
      <div className="flex items-center gap-2">
        {/* Icon */}
        {state === "idle" && (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        )}
        {state === "running" && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
        )}
        {state === "success" && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 animate-in zoom-in-50 duration-300" />
        )}
        {state === "error" && (
          <XCircle className="h-4 w-4 shrink-0 text-red-500 animate-in zoom-in-50 duration-300" />
        )}
        {state === "retrying" && (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        )}

        {/* Label */}
        <span
          className={cn(
            "text-sm",
            state === "idle" && "text-muted-foreground",
            state === "running" && "text-blue-600 dark:text-blue-400",
            state === "success" && "text-emerald-600 dark:text-emerald-400",
            state === "error" && "text-red-600 dark:text-red-400",
            state === "retrying" && "text-amber-600 dark:text-amber-400"
          )}
        >
          {label}
        </span>

        {/* Right side info */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {state === "success" && detail && <span>{detail}</span>}
          {state === "retrying" && retryCountdown !== undefined && (
            <span>{t("onboarding.gatewaySetup.retryInSeconds", { count: retryCountdown, defaultValue: "{{count}}s" })}</span>
          )}
          {state === "retrying" && retryInfo && <span>({retryInfo})</span>}
          {state === "error" && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={onRetry}
              aria-label={t("common.retryStep", { step: label, defaultValue: "Retry {{step}}" })}
            >
              {t("common.retry")}
            </Button>
          )}
        </div>
      </div>

      {/* Error details (expandable) */}
      {(state === "error" || state === "retrying") && error && (
        <div className="ml-6 space-y-0.5">
          <p className="text-xs text-muted-foreground">{error}</p>
          {suggestion && (
            <p className="text-xs text-muted-foreground/70">{suggestion}</p>
          )}
        </div>
      )}
    </div>
  );
}
