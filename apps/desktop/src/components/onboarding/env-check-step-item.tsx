/**
 * EnvCheck Step Item Component
 *
 * Individual step display for environment checking
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Minus,
  MinusCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Info,
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
}

// ============================================================================
// Helper Components
// ============================================================================

/** Get status text for screen readers */
function getStatusText(status: EnvCheckStepStatus, t: (key: string) => string): string {
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
  switch (status) {
    case "pending":
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    case "blocked":
      return <Lock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />;
    case "checking":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "skipped":
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
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

  // Increased opacity for better visibility (8-10% instead of 5%)
  const statusColors: Record<EnvCheckStepStatus, string> = {
    pending: "border-muted",
    blocked: "border-yellow-500/30 bg-yellow-500/10",
    checking: "border-primary/50 bg-primary/5",
    success: "border-green-500/30 bg-green-500/10",
    warning: "border-yellow-500/30 bg-yellow-500/10",
    error: "border-destructive/30 bg-destructive/10",
    skipped: "border-muted bg-muted/15",
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
          "rounded-lg border p-3 sm:p-4 transition-colors",
          statusColors[status],
          className
        )}
      >
        {/* Clickable header area */}
        <div
          className={cn(
            "flex items-start justify-between gap-2 sm:gap-4",
            hasExpandableContent && "cursor-pointer"
          )}
          onClick={handleHeaderClick}
        >
          {/* Left: Status and Title */}
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="mt-0.5 shrink-0" aria-hidden="true">
              <StatusIcon status={status} />
            </div>
            {/* Screen reader only status text */}
            <span className="sr-only">{getStatusText(status, t)}</span>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span id={titleId} className="font-medium">
                  {title}
                </span>
                {/* Tooltip with keyboard-accessible info button */}
                {tooltip && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label={t("common.moreInfo")}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {optional && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t("common.optional")}
                  </span>
                )}
                {version && (
                  <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-mono">
                    v{version}
                  </span>
                )}
                {/* Show checkingMessage when status is checking, otherwise show summary */}
                {status === "checking" && checkingMessage && (
                  <span className="text-xs text-primary/80 truncate max-w-[200px] sm:max-w-none animate-pulse">
                    {checkingMessage}
                  </span>
                )}
                {status !== "checking" && summary && !isOpen && (
                  <span className="text-xs text-foreground/70 truncate max-w-[150px] sm:max-w-none">
                    {summary}
                  </span>
                )}
              </div>
              {description && (
                <p id={descriptionId} className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
              {error && (
                <div
                  id={errorId}
                  role="alert"
                  className="mt-2 space-y-1"
                >
                  <p className="text-sm font-medium text-destructive">
                    {error.title}
                  </p>
                  <p className="text-sm text-muted-foreground break-words">
                    {error.message}
                  </p>
                  {/* Show action buttons below error on mobile for better proximity */}
                  {(onRetry || (optional && onSkip)) && (
                    <div className="flex gap-2 pt-1 sm:hidden">
                      {onRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry();
                          }}
                          disabled={isRetrying}
                        >
                          {isRetrying ? t("common.retrying") : t("common.retry")}
                        </Button>
                      )}
                      {optional && onSkip && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSkip();
                          }}
                        >
                          {t("common.skip")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions (hidden on mobile when in error state, shown below error instead) */}
          <div className={cn(
            "flex items-center gap-1 sm:gap-2 shrink-0",
            status === "error" && (onRetry || (optional && onSkip)) && "hidden sm:flex"
          )}>
            {status === "checking" && onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                disabled={isCancelling}
              >
                {isCancelling ? t("onboarding.envCheck.cancelling") : t("common.cancel")}
              </Button>
            )}
            {status === "error" && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                disabled={isRetrying}
              >
                {isRetrying ? t("common.retrying") : t("common.retry")}
              </Button>
            )}
            {/* Skip button for optional items in error state */}
            {status === "error" && optional && onSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
              >
                {t("common.skip")}
              </Button>
            )}
            {hasExpandableContent && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t("common.collapse") : t("common.expand")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </div>

        {/* Expandable Content */}
        {hasExpandableContent && (
          <CollapsibleContent className="mt-3 pt-3 border-t border-muted/50">
            <div className="space-y-2 text-sm pl-6 sm:pl-7">
              {/* Legacy content: path and details */}
              {path && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-muted-foreground shrink-0">{t("common.path")}:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono break-all">
                    {path}
                  </code>
                </div>
              )}
              {(details || error?.details) && (
                <pre className="rounded bg-muted p-2 text-xs font-mono overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
                  {details || error?.details}
                </pre>
              )}
              {/* Children content */}
              {children}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
