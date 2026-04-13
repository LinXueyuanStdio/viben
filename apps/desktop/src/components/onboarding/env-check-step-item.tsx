/**
 * EnvCheck Step Item Component
 *
 * Individual step display for environment checking
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  X,
  Loader2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
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
  | "checking"
  | "success"
  | "warning"
  | "error";

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
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusIcon({ status }: { status: EnvCheckStepStatus }) {
  switch (status) {
    case "checking":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "success":
      return <Check className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case "error":
      return <X className="h-4 w-4 text-destructive" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
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
}: EnvCheckStepItemProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const hasExpandableContent = !!(details || error?.details || path);

  const statusColors: Record<EnvCheckStepStatus, string> = {
    pending: "border-muted",
    checking: "border-primary/50",
    success: "border-green-500/20 bg-green-500/5",
    warning: "border-yellow-500/20 bg-yellow-500/5",
    error: "border-destructive/20 bg-destructive/5",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        statusColors[status],
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Status and Title */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <StatusIcon status={status} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {tooltip ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium cursor-help">{title}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span className="font-medium">{title}</span>
              )}
              {version && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  v{version}
                </span>
              )}
            </div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            {error && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {error.title}
                </p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {status === "checking" && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCancelling}
            >
              {isCancelling ? t("onboarding.envCheck.cancelling") : t("common.cancel")}
            </Button>
          )}
          {status === "error" && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? t("common.retrying") : t("common.retry")}
            </Button>
          )}
          {hasExpandableContent && (
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Expandable Content */}
      {hasExpandableContent && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="mt-3 pt-3 border-t border-muted">
            <div className="space-y-2 text-sm">
              {path && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t("common.path")}:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {path}
                  </code>
                </div>
              )}
              {(details || error?.details) && (
                <pre className="rounded bg-muted p-2 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto">
                  {details || error?.details}
                </pre>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
