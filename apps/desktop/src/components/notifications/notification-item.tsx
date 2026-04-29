import * as React from "react";
import {
  Bell,
  MessageSquare,
  Clock,
  Bot,
  Settings,
  Trash2,
  Check,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

// ============================================================================
// Types
// ============================================================================

export type NotificationCategory = "chat" | "cron" | "agent" | "system";
export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  body: string;
  metadata?: {
    groupId?: string;
    cronJobId?: string;
    agentId?: string;
    workspaceId?: string;
    actionUrl?: string;
  };
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationItemProps {
  notification: AppNotification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: AppNotification) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getCategoryIcon = (category: NotificationCategory) => {
  switch (category) {
    case "chat":
      return MessageSquare;
    case "cron":
      return Clock;
    case "agent":
      return Bot;
    case "system":
      return Settings;
    default:
      return Bell;
  }
};

const getLevelIcon = (level: NotificationLevel) => {
  switch (level) {
    case "success":
      return CheckCircle;
    case "warning":
      return AlertTriangle;
    case "error":
      return AlertCircle;
    case "info":
    default:
      return Info;
  }
};

const getLevelStyles = (level: NotificationLevel) => {
  switch (level) {
    case "success":
      return {
        iconColor: "text-green-500",
        bg: "bg-green-500/10",
      };
    case "warning":
      return {
        iconColor: "text-yellow-500",
        bg: "bg-yellow-500/10",
      };
    case "error":
      return {
        iconColor: "text-red-500",
        bg: "bg-red-500/10",
      };
    case "info":
    default:
      return {
        iconColor: "text-blue-500",
        bg: "bg-blue-500/10",
      };
  }
};

const getCategoryStyles = (category: NotificationCategory) => {
  switch (category) {
    case "chat":
      return {
        iconColor: "text-purple-500",
        bg: "bg-purple-500/10",
      };
    case "cron":
      return {
        iconColor: "text-amber-500",
        bg: "bg-amber-500/10",
      };
    case "agent":
      return {
        iconColor: "text-teal-500",
        bg: "bg-teal-500/10",
      };
    case "system":
      return {
        iconColor: "text-slate-500",
        bg: "bg-slate-500/10",
      };
    default:
      return {
        iconColor: "text-muted-foreground",
        bg: "bg-muted",
      };
  }
};

// ============================================================================
// Component
// ============================================================================

/**
 * NotificationItem - Single notification card in the notification center
 *
 * Displays notification with category icon, level indicator, title, body,
 * timestamp, and action buttons for mark as read and delete.
 */
const NotificationItem = React.forwardRef<HTMLDivElement, NotificationItemProps>(
  ({ notification, onMarkAsRead, onDelete, onClick }, ref) => {
    const { t } = useTranslation();
    const CategoryIcon = getCategoryIcon(notification.category);
    const LevelIcon = getLevelIcon(notification.level);
    const categoryStyles = getCategoryStyles(notification.category);
    const levelStyles = getLevelStyles(notification.level);

    const handleClick = () => {
      onClick?.(notification);
    };

    const handleMarkAsRead = (e: React.MouseEvent) => {
      e.stopPropagation();
      onMarkAsRead?.(notification.id);
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(notification.id);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "group relative flex gap-3 p-4 cursor-pointer",
          "border-b border-border last:border-b-0",
          "hover:bg-muted/50 transition-colors duration-200",
          !notification.read && "bg-primary/5"
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
      >
        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
        )}

        {/* Category icon */}
        <div className={cn("flex-shrink-0 p-2 rounded-lg", categoryStyles.bg)}>
          <CategoryIcon className={cn("h-4 w-4", categoryStyles.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "text-sm font-medium truncate",
                  !notification.read ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {notification.title}
              </span>
              <div className={cn("flex-shrink-0 p-0.5 rounded", levelStyles.bg)}>
                <LevelIcon className={cn("h-3 w-3", levelStyles.iconColor)} />
              </div>
            </div>
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt, t)}
            </span>
          </div>

          <p
            className={cn(
              "text-sm line-clamp-2",
              !notification.read ? "text-muted-foreground" : "text-muted-foreground/70"
            )}
          >
            {notification.body}
          </p>

          {/* Action URL indicator */}
          {notification.metadata?.actionUrl && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <ExternalLink className="h-3 w-3" />
              <span>{t("notifications.viewDetails")}</span>
            </div>
          )}
        </div>

        {/* Action buttons - visible on hover */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleMarkAsRead}
              title={t("notifications.markAsRead")}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            title={t("common.delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }
);
NotificationItem.displayName = "NotificationItem";

export { NotificationItem };
