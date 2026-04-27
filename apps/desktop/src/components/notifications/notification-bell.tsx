import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

// ============================================================================
// Types
// ============================================================================

export interface NotificationBellProps {
  /** Number of unread notifications */
  unreadCount: number;
  /** Whether the notification panel is open */
  isOpen?: boolean;
  /** Callback when bell is clicked */
  onClick?: () => void;
  /** Whether there's a new notification (triggers animation) */
  hasNewNotification?: boolean;
  /** Additional CSS class */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * NotificationBell - Bell icon button with unread badge
 *
 * Displays a bell icon with an optional badge showing unread count.
 * Supports animation when new notifications arrive.
 */
const NotificationBell = React.forwardRef<HTMLButtonElement, NotificationBellProps>(
  ({ unreadCount, isOpen, onClick, hasNewNotification, className }, ref) => {
    const { t } = useTranslation();
    const [isAnimating, setIsAnimating] = useState(false);

    // Trigger animation when new notification arrives
    useEffect(() => {
      if (hasNewNotification) {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 500);
        return () => clearTimeout(timer);
      }
    }, [hasNewNotification]);

    const displayCount = unreadCount > 99 ? "99+" : unreadCount.toString();

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-9 w-9",
          isOpen && "bg-accent",
          className
        )}
        onClick={onClick}
        aria-label={t("notifications.title")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell
          className={cn(
            "h-5 w-5 transition-transform",
            isAnimating && "animate-bell-ring"
          )}
        />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5",
              "min-w-[1.125rem] h-[1.125rem] px-1",
              "flex items-center justify-center",
              "text-[10px] font-semibold",
              "bg-destructive text-destructive-foreground",
              "rounded-full",
              "border-2 border-background",
              isAnimating && "animate-pulse"
            )}
          >
            {displayCount}
          </span>
        )}

        {/* New notification indicator dot (when count is 0 but has new) */}
        {unreadCount === 0 && hasNewNotification && (
          <span
            className={cn(
              "absolute top-1 right-1",
              "h-2 w-2 rounded-full",
              "bg-primary",
              "animate-pulse"
            )}
          />
        )}
      </Button>
    );
  }
);
NotificationBell.displayName = "NotificationBell";

export { NotificationBell };
