/**
 * Notification System Types
 *
 * Types for the desktop notification system including:
 * - In-app toast notifications
 * - System notifications (macOS/Windows/Linux)
 * - Notification center (persistent notifications)
 */

// Notification category - determines icon and filtering
export type NotificationCategory = "chat" | "cron" | "agent" | "system";

// Notification level - determines styling and urgency
export type NotificationLevel = "info" | "success" | "warning" | "error";

/**
 * Metadata for notification context and navigation
 */
export interface NotificationMetadata {
  /** Group chat ID for chat notifications */
  groupId?: string;
  /** Cron job ID for scheduled task notifications */
  cronJobId?: string;
  /** Agent ID for agent-related notifications */
  agentId?: string;
  /** Workspace ID for workspace-scoped notifications */
  workspaceId?: string;
  /** URL path to navigate when notification is clicked */
  actionUrl?: string;
}

/**
 * Application notification stored in notification center
 */
export interface AppNotification {
  /** Unique identifier */
  id: string;
  /** Category for filtering */
  category: NotificationCategory;
  /** Notification level/severity */
  level: NotificationLevel;
  /** Notification title */
  title: string;
  /** Notification body/description */
  body: string;
  /** Optional metadata for context and navigation */
  metadata?: NotificationMetadata;
  /** Whether the notification has been read */
  read: boolean;
  /** Timestamp when notification was created */
  createdAt: Date;
  /** Timestamp when notification was marked as read */
  readAt?: Date;
}

/**
 * User preferences for notification behavior
 */
export interface NotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;
  /** Per-category toggles */
  categories: Record<NotificationCategory, boolean>;
  /** Whether to show system (OS) notifications */
  systemNotifications: boolean;
  /** Whether to play notification sounds */
  sound: boolean;
  /** Do not disturb settings */
  doNotDisturb: {
    enabled: boolean;
    /** Start time in 24h format (e.g., "22:00") */
    start: string;
    /** End time in 24h format (e.g., "08:00") */
    end: string;
  };
  /** Number of days to retain notifications (default 30) */
  retentionDays: number;
}

/**
 * Input for creating a new notification (without auto-generated fields)
 */
export type CreateNotificationInput = Omit<
  AppNotification,
  "id" | "read" | "createdAt" | "readAt"
>;

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  categories: {
    chat: true,
    cron: true,
    agent: true,
    system: true,
  },
  systemNotifications: true,
  sound: true,
  doNotDisturb: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
  retentionDays: 30,
};
