import * as React from "react";
import { Bell, CheckCheck, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import {
  NotificationItem,
  type AppNotification,
  type NotificationCategory,
} from "./notification-item";
import {
  NotificationFilters,
  type NotificationFilterType,
  type CategoryCount,
} from "./notification-filters";

// ============================================================================
// Types
// ============================================================================

export interface NotificationCenterProps {
  /** List of notifications */
  notifications: AppNotification[];
  /** Callback to mark a single notification as read */
  onMarkAsRead?: (id: string) => void;
  /** Callback to mark all notifications as read */
  onMarkAllAsRead?: () => void;
  /** Callback to delete a single notification */
  onDelete?: (id: string) => void;
  /** Callback to clear all notifications */
  onClearAll?: () => void;
  /** Callback when a notification is clicked */
  onNotificationClick?: (notification: AppNotification) => void;
  /** Whether the panel is visible */
  visible?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Max height for the notification list */
  maxHeight?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Groups notifications by time period: Today, Yesterday, Earlier
 */
const groupNotificationsByTime = (
  notifications: AppNotification[]
): { today: AppNotification[]; yesterday: AppNotification[]; earlier: AppNotification[] } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const groups = {
    today: [] as AppNotification[],
    yesterday: [] as AppNotification[],
    earlier: [] as AppNotification[],
  };

  notifications.forEach((notification) => {
    const notificationDate = new Date(notification.createdAt);
    const notificationDay = new Date(
      notificationDate.getFullYear(),
      notificationDate.getMonth(),
      notificationDate.getDate()
    );

    if (notificationDay.getTime() === today.getTime()) {
      groups.today.push(notification);
    } else if (notificationDay.getTime() === yesterday.getTime()) {
      groups.yesterday.push(notification);
    } else {
      groups.earlier.push(notification);
    }
  });

  return groups;
};

/**
 * Calculates category counts from notifications
 */
const calculateCounts = (notifications: AppNotification[]): CategoryCount => {
  const counts: CategoryCount = {
    all: notifications.length,
    chat: 0,
    cron: 0,
    agent: 0,
    system: 0,
  };

  notifications.forEach((notification) => {
    if (notification.category in counts) {
      counts[notification.category as NotificationCategory]++;
    }
  });

  return counts;
};

/**
 * Filters notifications by category
 */
const filterNotifications = (
  notifications: AppNotification[],
  filter: NotificationFilterType
): AppNotification[] => {
  if (filter === "all") {
    return notifications;
  }
  return notifications.filter((n) => n.category === filter);
};

// ============================================================================
// Sub-components
// ============================================================================

interface TimeGroupProps {
  title: string;
  notifications: AppNotification[];
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: AppNotification) => void;
}

const TimeGroup: React.FC<TimeGroupProps> = ({
  title,
  notifications,
  onMarkAsRead,
  onDelete,
  onClick,
}) => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 px-4 py-2 bg-muted/80 backdrop-blur-sm border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
            onClick={onClick}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Component
// ============================================================================

/**
 * NotificationCenter - Main notification panel with filtering and grouping
 *
 * Displays a list of notifications grouped by time (Today, Yesterday, Earlier),
 * with category filtering, mark all as read, and clear all actions.
 */
const NotificationCenter = React.forwardRef<HTMLDivElement, NotificationCenterProps>(
  (
    {
      notifications,
      onMarkAsRead,
      onMarkAllAsRead,
      onDelete,
      onClearAll,
      onNotificationClick,
      visible = true,
      className,
      maxHeight = "500px",
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [activeFilter, setActiveFilter] = React.useState<NotificationFilterType>("all");

    // Calculate counts and filter notifications
    const counts = React.useMemo(() => calculateCounts(notifications), [notifications]);
    const filteredNotifications = React.useMemo(
      () => filterNotifications(notifications, activeFilter),
      [notifications, activeFilter]
    );

    // Group filtered notifications by time
    const groupedNotifications = React.useMemo(
      () => groupNotificationsByTime(filteredNotifications),
      [filteredNotifications]
    );

    // Calculate unread count
    const unreadCount = React.useMemo(
      () => notifications.filter((n) => !n.read).length,
      [notifications]
    );

    if (!visible) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col bg-card border border-border rounded-xl shadow-lg",
          "w-[380px] max-w-full overflow-hidden",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("notifications.title")}</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onMarkAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("notifications.markAllRead")}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={onClearAll}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("notifications.clearAll")}
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-border bg-muted/20">
          <NotificationFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        {/* Notifications List */}
        <ScrollArea className="flex-1" style={{ maxHeight }}>
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Info className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">{t("notifications.noNotifications")}</p>
              <p className="text-xs mt-1">{t("notifications.noNotificationsDesc")}</p>
            </div>
          ) : (
            <div>
              <TimeGroup
                title={t("common.today")}
                notifications={groupedNotifications.today}
                onMarkAsRead={onMarkAsRead}
                onDelete={onDelete}
                onClick={onNotificationClick}
              />
              <TimeGroup
                title={t("common.yesterday")}
                notifications={groupedNotifications.yesterday}
                onMarkAsRead={onMarkAsRead}
                onDelete={onDelete}
                onClick={onNotificationClick}
              />
              <TimeGroup
                title={t("notifications.earlier")}
                notifications={groupedNotifications.earlier}
                onMarkAsRead={onMarkAsRead}
                onDelete={onDelete}
                onClick={onNotificationClick}
              />
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }
);
NotificationCenter.displayName = "NotificationCenter";

export { NotificationCenter };
