/**
 * EnvCheck Step Item Component
 *
 * Individual step display for environment checking
 * Beautiful card design with status indicators and animations
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  MinusCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

// ============================================================================
// Types
// ============================================================================

export type EnvCheckStepStatus =
  | "pending"
  | "blocked"
  | "checking"
  | "success"
  | "warning"
  | "error"
  | "skipped";

/** Content type for the expandable section */
export type EnvCheckContentType = "simple" | "python-selector" | "client-list";

export interface EnvCheckStepItemProps {
  title: string;
  status: EnvCheckStepStatus;
  tooltip?: string;
  description?: string;
  details?: string;
  version?: string;
  path?: string;
  error?: {
    title: string;
    message: string;
    details?: string;
  };
  onRetry?: () => void;
  onCancel?: () => void;
  isRetrying?: boolean;
  isCancelling?: boolean;
  className?: string;
  /** Content type for the expandable section (currently used for semantic purposes) */
  contentType?: EnvCheckContentType;
  /** Whether the collapsible is expanded */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Children to render in the expandable section */
  children?: React.ReactNode;
  /** Whether this check item is optional */
  optional?: boolean;
  /** Callback when user skips this optional check */
  onSkip?: () => void;
  /** Summary text to show when collapsed (displayed next to version) */
  summary?: string;
  /** Message to display when status is "checking" (e.g., "Installing viben@latest...") */
  checkingMessage?: string;
  /** Progress info for installation (0-100 percent) */
  progress?: {
    percent: number;
    message: string;
  };
}

// ============================================================================
// Helper Components
// ============================================================================

/** Get status text for screen readers */
function getStatusText(
  status: EnvCheckStepStatus,
  t: (key: string) => string
): string {
  switch (status) {
    case "pending":
      return t("common.pending");
    case "blocked":
      return t("common.blocked");
    case "checking":
      return t("common.checking");
    case "success":
      return t("common.success");
    case "warning":
      return t("common.warning");
    case "error":
      return t("common.error");
    case "skipped":
      return t("common.skipped");
    default:
      return "";
  }
}

function StatusIcon({ status }: { status: EnvCheckStepStatus }) {
  const baseClass = "h-5 w-5 transition-all duration-300";

  switch (status) {
    case "pending":
      return <Circle className={cn(baseClass, "text-muted-foreground/50")} />;
    case "blocked":
      return (
        <Lock
          className={cn(baseClass, "text-amber-500 dark:text-amber-400")}
        />
      );
    case "checking":
      return (
        <Loader2
          className={cn(baseClass, "animate-spin text-blue-500 dark:text-blue-400")}
        />
      );
    case "success":
      return (
        <CheckCircle2
          className={cn(
            baseClass,
            "text-emerald-500 dark:text-emerald-400 animate-in zoom-in-50 duration-300"
          )}
        />
      );
    case "warning":
      return (
        <AlertTriangle
          className={cn(baseClass, "text-amber-500 dark:text-amber-400")}
        />
      );
    case "error":
      return (
        <XCircle
          className={cn(
            baseClass,
            "text-red-500 dark:text-red-400 animate-in zoom-in-50 duration-300"
          )}
        />
      );
    case "skipped":
      return (
        <MinusCircle className={cn(baseClass, "text-muted-foreground/60")} />
      );
    default:
      return <Circle className={cn(baseClass, "text-muted-foreground/50")} />;
  }
}

// ============================================================================
// Component
// ============================================================================

export function EnvCheckStepItem({
  title,
  status,
  tooltip,
  description,
  details,
  version,
  path,
  error,
  onRetry,
  onCancel,
  isRetrying,
  isCancelling,
  className,
  contentType: _contentType,
  expanded,
  onExpandedChange,
  children,
  optional,
  onSkip,
  summary,
  checkingMessage,
  progress,
}: EnvCheckStepItemProps) {
  const { t } = useTranslation();

  // Generate unique IDs for ARIA
  const titleId = React.useId();
  const descriptionId = React.useId();
  const errorId = React.useId();

  // Use internal state if expanded/onExpandedChange not provided (controlled vs uncontrolled)
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = expanded !== undefined;
  const isOpen = isControlled ? expanded : internalOpen;
  const setIsOpen = isControlled
    ? (value: boolean) => onExpandedChange?.(value)
    : setInternalOpen;

  // Determine if there's expandable content
  const hasLegacyExpandableContent = !!(details || error?.details || path);
  const hasChildrenContent = !!children;
  const hasExpandableContent = hasLegacyExpandableContent || hasChildrenContent;

  // Beautiful gradient backgrounds and borders for each status
  const statusStyles: Record<EnvCheckStepStatus, string> = {
    pending:
      "border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 hover:border-border/80",
    blocked:
      "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:border-amber-500/50",
    checking:
      "border-blue-500/40 bg-gradient-to-br from-blue-500/10 to-blue-500/5 shadow-sm shadow-blue-500/10",
    success:
      "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 hover:border-emerald-500/50",
    warning:
      "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:border-amber-500/50",
    error:
      "border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-500/5 hover:border-red-500/50",
    skipped:
      "border-border/30 bg-gradient-to-br from-muted/20 to-muted/5 opacity-60",
  };

  // Handle click on the header area to toggle expansion
  const handleHeaderClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("[role='button']")
    ) {
      return;
    }
    if (hasExpandableContent) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        role="region"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-live="polite"
        className={cn(
          "group relative rounded-xl border p-4 transition-all duration-200",
          "backdrop-blur-sm",
          statusStyles[status],
          hasExpandableContent && "cursor-pointer",
          className
        )}
        onClick={handleHeaderClick}
      >
        {/* Subtle glow effect for active states */}
        {(status === "checking" || status === "success") && (
          <div
            className={cn(
              "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
              status === "checking" && "bg-blue-500/5",
              status === "success" && "bg-emerald-500/5"
            )}
          />
        )}

        {/* Main content */}
        <div className="relative flex items-center gap-3">
          {/* Status Icon with background */}
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
              status === "pending" && "bg-muted/50",
              status === "blocked" && "bg-amber-500/15",
              status === "checking" && "bg-blue-500/15",
              status === "success" && "bg-emerald-500/15",
              status === "warning" && "bg-amber-500/15",
              status === "error" && "bg-red-500/15",
              status === "skipped" && "bg-muted/30"
            )}
            aria-hidden="true"
          >
            <StatusIcon status={status} />
          </div>

          {/* Screen reader only status text */}
          <span className="sr-only">{getStatusText(status, t)}</span>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                id={titleId}
                className={cn(
                  "font-semibold text-[15px] leading-tight",
                  status === "skipped" && "text-muted-foreground"
                )}
              >
                {title}
              </h3>

              {/* Tooltip */}
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                        aria-label={t("common.moreInfo")}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-sm">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Optional badge */}
              {optional && (
                <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {t("common.optional")}
                </span>
              )}

              {/* Version badge */}
              {version && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-medium text-primary">
                  v{version}
                </span>
              )}

              {/* Checking message (when not showing progress) */}
              {status === "checking" && checkingMessage && !progress && (
                <span className="text-[13px] text-blue-600 dark:text-blue-400 animate-pulse">
                  {checkingMessage}
                </span>
              )}

              {/* Summary (when collapsed and not checking) */}
              {status !== "checking" && summary && !isOpen && (
                <span className="text-[13px] text-muted-foreground truncate max-w-[200px]">
                  {summary}
                </span>
              )}
            </div>

            {/* Progress bar for installation */}
            {status === "checking" && progress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-blue-600 dark:text-blue-400">
                    {progress.message}
                  </span>
                  <span className="text-muted-foreground font-medium tabular-nums">
                    {Math.round(progress.percent)}%
                  </span>
                </div>
                <Progress
                  value={progress.percent}
                  className="h-1.5 bg-blue-500/20"
                />
              </div>
            )}

            {/* Description */}
            {description && (
              <p
                id={descriptionId}
                className="text-[13px] text-muted-foreground leading-relaxed"
              >
                {description}
              </p>
            )}

            {/* Error display */}
            {error && (
              <div
                id={errorId}
                role="alert"
                className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 space-y-1.5"
              >
                <p className="text-[13px] font-medium text-red-600 dark:text-red-400">
                  {error.title}
                </p>
                <p className="text-[12px] text-red-600/80 dark:text-red-400/80 break-words leading-relaxed">
                  {error.message}
                </p>

                {/* Action buttons below error on mobile */}
                {(onRetry || (optional && onSkip)) && (
                  <div className="flex gap-2 pt-2 sm:hidden">
                    {onRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-red-500/30 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry();
                        }}
                        disabled={isRetrying}
                      >
                        <RefreshCw
                          className={cn(
                            "mr-1.5 h-3 w-3",
                            isRetrying && "animate-spin"
                          )}
                        />
                        {isRetrying ? t("common.retrying") : t("common.retry")}
                      </Button>
                    )}
                    {optional && onSkip && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSkip();
                        }}
                      >
                        <SkipForward className="mr-1.5 h-3 w-3" />
                        {t("common.skip")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right side: Actions */}
          <div
            className={cn(
              "flex items-center gap-1.5 shrink-0",
              status === "error" &&
                (onRetry || (optional && onSkip)) &&
                "hidden sm:flex"
            )}
          >
            {/* Cancel button during checking */}
            {status === "checking" && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs hover:bg-blue-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                disabled={isCancelling}
              >
                {isCancelling
                  ? t("onboarding.envCheck.cancelling")
                  : t("common.cancel")}
              </Button>
            )}

            {/* Retry button on error */}
            {status === "error" && onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-red-500/30 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                disabled={isRetrying}
              >
                <RefreshCw
                  className={cn(
                    "mr-1.5 h-3 w-3",
                    isRetrying && "animate-spin"
                  )}
                />
                {isRetrying ? t("common.retrying") : t("common.retry")}
              </Button>
            )}

            {/* Skip button for optional items in error state */}
            {status === "error" && optional && onSkip && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
              >
                <SkipForward className="mr-1.5 h-3 w-3" />
                {t("common.skip")}
              </Button>
            )}

            {/* Expand/collapse button */}
            {hasExpandableContent && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted/50"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t("common.collapse") : t("common.expand")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        {/* Expandable Content */}
        {hasExpandableContent && (
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="space-y-3 pl-12">
                {/* Path display */}
                {path && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                    <span className="text-[12px] text-muted-foreground font-medium shrink-0">
                      {t("common.path")}:
                    </span>
                    <code className="rounded-md bg-muted/50 border border-border/50 px-2 py-1 text-[11px] font-mono text-foreground/80 break-all">
                      {path}
                    </code>
                  </div>
                )}

                {/* Details display */}
                {(details || error?.details) && (
                  <pre className="rounded-lg bg-muted/30 border border-border/50 p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-40 whitespace-pre-wrap break-words leading-relaxed">
                    {details || error?.details}
                  </pre>
                )}

                {/* Children content */}
                {children}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
