import * as React from "react";
import { ArrowUpCircle, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PackageUpdate } from "@/hooks/use-package-updates";

// ============================================================================
// Types
// ============================================================================

export interface UpdateNotificationProps {
  /** List of available updates */
  updates: PackageUpdate[];
  /** Whether notification is visible */
  visible?: boolean;
  /** Auto-hide after milliseconds (0 = no auto-hide) */
  autoHideDuration?: number;
  /** Position on screen */
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  /** Callback when dismiss is clicked */
  onDismiss?: () => void;
  /** Callback when update action is clicked */
  onUpdateClick?: () => void;
  /** Whether updates are being installed */
  updating?: boolean;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Position Classes
// ============================================================================

const positionClasses = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
};

// ============================================================================
// Component
// ============================================================================

/**
 * UpdateNotification - Toast notification for available package updates
 *
 * Displays a non-intrusive notification when new updates are detected.
 * Provides quick actions to view updates or dismiss.
 */
const UpdateNotification = React.forwardRef<
  HTMLDivElement,
  UpdateNotificationProps
>(
  (
    {
      updates,
      visible = true,
      autoHideDuration = 0,
      position = "bottom-right",
      onDismiss,
      onUpdateClick,
      updating = false,
      className,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = React.useState(visible);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update visibility when prop changes
    React.useEffect(() => {
      setIsVisible(visible);
    }, [visible]);

    // Auto-hide timer
    React.useEffect(() => {
      if (isVisible && autoHideDuration > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsVisible(false);
          onDismiss?.();
        }, autoHideDuration);
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [isVisible, autoHideDuration, onDismiss]);

    // Don't render if no updates or not visible
    if (updates.length === 0 || !isVisible) {
      return null;
    }

    const handleDismiss = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    // Determine notification message
    const mcpCount = updates.filter((u) => u.package_type === "mcp").length;
    const skillCount = updates.filter((u) => u.package_type === "skill").length;

    let message: string;
    if (mcpCount > 0 && skillCount > 0) {
      message = t("updates.mixedAvailable", {
        mcpCount,
        skillCount,
        defaultValue: `${mcpCount} MCP and ${skillCount} skill update(s)`,
      });
    } else if (mcpCount > 0) {
      message = t("updates.mcpAvailable", {
        count: mcpCount,
        defaultValue: `${mcpCount} MCP update(s) available`,
      });
    } else {
      message = t("updates.skillsAvailable", {
        count: skillCount,
        defaultValue: `${skillCount} skill update(s) available`,
      });
    }

    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-50 flex items-center gap-3",
          "p-4 min-w-[320px] max-w-[420px]",
          "bg-card border border-border rounded-xl",
          "shadow-lg shadow-black/10",
          "animate-in slide-in-from-bottom-2 fade-in-0 duration-300",
          positionClasses[position],
          className
        )}
        role="alert"
        aria-live="polite"
      >
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
          <ArrowUpCircle className="h-5 w-5 text-amber-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {t("updates.updatesAvailable", "Updates Available")}
          </p>
          <p className="text-xs text-muted-foreground truncate">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="default"
            size="sm"
            onClick={onUpdateClick}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              t("updates.viewUpdates", "View")
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t("common.close")}</span>
          </Button>
        </div>
      </div>
    );
  }
);
UpdateNotification.displayName = "UpdateNotification";

// ============================================================================
// Hook for managing notification state
// ============================================================================

export interface UseUpdateNotificationOptions {
  /** Updates to display */
  updates: PackageUpdate[];
  /** Auto-show when new updates detected */
  autoShow?: boolean;
  /** Auto-hide duration in ms (0 = no auto-hide) */
  autoHideDuration?: number;
}

export interface UseUpdateNotificationReturn {
  /** Whether notification is visible */
  isVisible: boolean;
  /** Show the notification */
  show: () => void;
  /** Hide the notification */
  hide: () => void;
  /** Toggle visibility */
  toggle: () => void;
  /** Number of updates */
  updateCount: number;
}

/**
 * Hook for managing update notification visibility
 */
export function useUpdateNotification(
  options: UseUpdateNotificationOptions
): UseUpdateNotificationReturn {
  const { updates, autoShow = true, autoHideDuration = 10000 } = options;

  const [isVisible, setIsVisible] = React.useState(false);
  const previousCountRef = React.useRef(0);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-show when new updates are detected
  React.useEffect(() => {
    if (autoShow && updates.length > previousCountRef.current) {
      setIsVisible(true);

      // Auto-hide after duration
      if (autoHideDuration > 0) {
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
        }, autoHideDuration);
      }
    }
    previousCountRef.current = updates.length;
  }, [updates.length, autoShow, autoHideDuration]);

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const show = React.useCallback(() => setIsVisible(true), []);
  const hide = React.useCallback(() => setIsVisible(false), []);
  const toggle = React.useCallback(() => setIsVisible((v) => !v), []);

  return {
    isVisible,
    show,
    hide,
    toggle,
    updateCount: updates.length,
  };
}

export { UpdateNotification };
