/**
 * Structured failure view component
 *
 * Qclaw reference: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/GatewayBootstrapGate.tsx
 */

import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  SkipForward,
  Terminal,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { FailureView } from "@/lib/onboarding/bootstrap-diagnostics";
import type { SuggestedAction } from "@/lib/onboarding/installer-issues";

// ============================================================================
// Props
// ============================================================================

interface FailureViewProps {
  failure: FailureView;
  actions?: SuggestedAction[];
  onRetry?: () => void;
  onSkip?: () => void;
  isRetrying?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function FailureViewDisplay({
  failure,
  actions,
  onRetry,
  onSkip,
  isRetrying,
  className,
}: FailureViewProps) {
  const { t } = useTranslation();

  const severityConfig = {
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
      iconColor: "text-yellow-500",
      titleColor: "text-yellow-700 dark:text-yellow-400",
    },
    error: {
      icon: AlertCircle,
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20",
      iconColor: "text-destructive",
      titleColor: "text-destructive",
    },
    fatal: {
      icon: XCircle,
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      iconColor: "text-red-600",
      titleColor: "text-red-700 dark:text-red-400",
    },
  };

  const config = severityConfig[failure.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-4",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5", config.iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className={cn("font-medium", config.titleColor)}>
            {failure.title}
          </h3>
          <p className="text-sm text-muted-foreground">{failure.detail}</p>
        </div>
      </div>

      {/* Hints */}
      {failure.hints.length > 0 && (
        <div className="pl-8 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("onboarding.failure.suggestions")}
          </p>
          <ul className="space-y-1.5">
            {failure.hints.map((hint, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-muted-foreground/50">•</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {(actions && actions.length > 0) || onRetry || onSkip ? (
        <div className="flex flex-wrap gap-2 pl-8 pt-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")}
              />
              {isRetrying ? t("common.retrying") : t("common.retry")}
            </Button>
          )}

          {actions?.map((action, index) => (
            <ActionButton key={index} action={action} />
          ))}

          {onSkip && failure.recoverable && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <SkipForward className="mr-2 h-4 w-4" />
              {t("common.skip")}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Action Button
// ============================================================================

function ActionButton({ action }: { action: SuggestedAction }) {
  const { t } = useTranslation();

  switch (action.type) {
    case "open-link":
      return (
        <Button variant="outline" size="sm" asChild>
          <a href={action.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {action.label}
          </a>
        </Button>
      );

    case "manual-download":
      return (
        <Button variant="outline" size="sm" asChild>
          <a href={action.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("onboarding.failure.manualDownload")}
          </a>
        </Button>
      );

    case "run-command":
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(action.command)}
        >
          <Terminal className="mr-2 h-4 w-4" />
          {action.label}
        </Button>
      );

    case "contact-support":
      return (
        <Button variant="ghost" size="sm" asChild>
          <a
            href="https://github.com/LinXueyuanStdio/viben/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            {t("onboarding.failure.contactSupport")}
          </a>
        </Button>
      );

    default:
      return null;
  }
}

export { FailureViewDisplay as FailureView };
