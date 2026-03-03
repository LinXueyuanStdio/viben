import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppNotification,
  CreateNotificationInput,
  NotificationCategory,
  NotificationMethod,
  NotificationPreferences,
} from "@/types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/types/notification";
import { getGatewayClient } from "@/lib/gateway";
import type { GatewayNotificationPreferences } from "@/lib/gateway/types";

/** Maximum number of notifications to store */
const MAX_NOTIFICATIONS = 100;

/** Generate unique notification ID */
const generateNotificationId = () =>
  `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** Local storage key for migrated flag */
const MIGRATION_KEY = "viben-notifications-migrated-to-gateway";

/**
 * Convert Gateway notification preferences to local format
 */
function gatewayToLocalPreferences(gateway: GatewayNotificationPreferences): NotificationPreferences {
  return {
    enabled: gateway.enabled,
    sound: gateway.sound,
    categories: gateway.categories as Record<NotificationCategory, boolean>,
    methods: gateway.methods as Record<NotificationCategory, NotificationMethod>,
    systemNotifications: true, // Always true when syncing with Gateway
    doNotDisturb: {
      enabled: gateway.do_not_disturb.enabled,
      start: gateway.do_not_disturb.start,
      end: gateway.do_not_disturb.end,
    },
    retentionDays: gateway.retention_days,
  };
}

/**
 * Convert local notification preferences to Gateway format
 */
function localToGatewayPreferences(local: Partial<NotificationPreferences>): Partial<GatewayNotificationPreferences> {
  const result: Partial<GatewayNotificationPreferences> = {};

  if (local.enabled !== undefined) {
    result.enabled = local.enabled;
  }
  if (local.sound !== undefined) {
    result.sound = local.sound;
  }
  if (local.categories !== undefined) {
    result.categories = local.categories as GatewayNotificationPreferences["categories"];
  }
  if (local.methods !== undefined) {
    result.methods = local.methods as GatewayNotificationPreferences["methods"];
  }
  if (local.doNotDisturb !== undefined) {
    result.do_not_disturb = {
      enabled: local.doNotDisturb.enabled,
      start: local.doNotDisturb.start,
      end: local.doNotDisturb.end,
    };
  }
  if (local.retentionDays !== undefined) {
    result.retention_days = local.retentionDays;
  }

  return result;
}

interface NotificationState {
  // Notifications list
  notifications: AppNotification[];

  // User preferences
  preferences: NotificationPreferences;

  // Loading state for preferences
  preferencesLoading: boolean;
  preferencesLoaded: boolean;

  // Actions: Notification management
  addNotification: (input: CreateNotificationInput) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  clearCategory: (category: NotificationCategory) => void;

  // Actions: Preference management
  loadPreferences: () => Promise<void>;
  setPreferences: (prefs: Partial<NotificationPreferences>) => void;
  setCategoryEnabled: (category: NotificationCategory, enabled: boolean) => void;
  setCategoryMethod: (category: NotificationCategory, method: NotificationMethod) => void;
  setDoNotDisturb: (
    enabled: boolean,
    start?: string,
    end?: string
  ) => void;

  // Computed getters
  getUnreadCount: () => number;
  getUnreadCountByCategory: (category: NotificationCategory) => number;
  getNotificationsByCategory: (
    category: NotificationCategory | "all"
  ) => AppNotification[];
  isDoNotDisturbActive: () => boolean;
  shouldShowNotification: (category: NotificationCategory) => boolean;
}

/**
 * Sync preferences to Gateway (fire and forget)
 */
async function syncPreferencesToGateway(prefs: Partial<NotificationPreferences>): Promise<void> {
  try {
    const client = getGatewayClient();
    const gatewayPrefs = localToGatewayPreferences(prefs);
    await client.updateNotificationPreferences(gatewayPrefs);
  } catch (error) {
    console.warn("[NotificationStore] Failed to sync preferences to Gateway:", error);
    // Don't throw - we want to keep local state even if Gateway sync fails
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      preferencesLoading: false,
      preferencesLoaded: false,

      // Load preferences from Gateway
      loadPreferences: async () => {
        const { preferencesLoaded, preferencesLoading } = get();

        // Skip if already loaded or loading
        if (preferencesLoaded || preferencesLoading) {
          return;
        }

        set({ preferencesLoading: true });

        try {
          const client = getGatewayClient();
          const gatewayPrefs = await client.getNotificationPreferences();
          const localPrefs = gatewayToLocalPreferences(gatewayPrefs);

          set({
            preferences: localPrefs,
            preferencesLoading: false,
            preferencesLoaded: true,
          });

          // Mark as migrated
          localStorage.setItem(MIGRATION_KEY, "true");
        } catch (error) {
          console.warn("[NotificationStore] Failed to load preferences from Gateway:", error);
          set({
            preferencesLoading: false,
            preferencesLoaded: true, // Mark as loaded even on error to prevent infinite retries
          });

          // If Gateway is not available, check if we need to migrate localStorage data
          const migrated = localStorage.getItem(MIGRATION_KEY);
          if (!migrated) {
            // First time - try to migrate later when Gateway is available
            console.log("[NotificationStore] Will migrate localStorage preferences when Gateway is available");
          }
        }
      },

      // Add a new notification
      addNotification: (input) => {
        const id = generateNotificationId();
        const notification: AppNotification = {
          ...input,
          id,
          read: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          // Add new notification at the beginning
          const newNotifications = [notification, ...state.notifications];

          // Trim to max size (remove oldest)
          if (newNotifications.length > MAX_NOTIFICATIONS) {
            newNotifications.splice(MAX_NOTIFICATIONS);
          }

          return { notifications: newNotifications };
        });

        return id;
      },

      // Mark a single notification as read
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id && !n.read
              ? { ...n, read: true, readAt: new Date().toISOString() }
              : n
          ),
        })),

      // Mark all notifications as read
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.read ? n : { ...n, read: true, readAt: new Date().toISOString() }
          ),
        })),

      // Remove a single notification
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // Clear all notifications
      clearAll: () => set({ notifications: [] }),

      // Clear notifications by category
      clearCategory: (category) =>
        set((state) => ({
          notifications: state.notifications.filter(
            (n) => n.category !== category
          ),
        })),

      // Update preferences (partial update) and sync to Gateway
      setPreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
        // Sync to Gateway in background
        syncPreferencesToGateway(prefs);
      },

      // Toggle category notifications and sync to Gateway
      setCategoryEnabled: (category, enabled) => {
        const newCategories = {
          ...get().preferences.categories,
          [category]: enabled,
        };
        set((state) => ({
          preferences: {
            ...state.preferences,
            categories: newCategories,
          },
        }));
        // Sync to Gateway in background
        syncPreferencesToGateway({ categories: newCategories });
      },

      // Set notification method for a category and sync to Gateway
      setCategoryMethod: (category, method) => {
        const newMethods = {
          ...get().preferences.methods,
          [category]: method,
        };
        set((state) => ({
          preferences: {
            ...state.preferences,
            methods: newMethods,
          },
        }));
        // Sync to Gateway in background
        syncPreferencesToGateway({ methods: newMethods });
      },

      // Set do not disturb settings and sync to Gateway
      setDoNotDisturb: (enabled, start, end) => {
        const currentDnd = get().preferences.doNotDisturb;
        const newDnd = {
          enabled,
          start: start ?? currentDnd.start,
          end: end ?? currentDnd.end,
        };
        set((state) => ({
          preferences: {
            ...state.preferences,
            doNotDisturb: newDnd,
          },
        }));
        // Sync to Gateway in background
        syncPreferencesToGateway({ doNotDisturb: newDnd });
      },

      // Get total unread count
      getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

      // Get unread count for a specific category
      getUnreadCountByCategory: (category) =>
        get().notifications.filter(
          (n) => !n.read && n.category === category
        ).length,

      // Get notifications filtered by category
      getNotificationsByCategory: (category) => {
        const { notifications } = get();
        if (category === "all") {
          return notifications;
        }
        return notifications.filter((n) => n.category === category);
      },

      // Check if do not disturb is currently active
      isDoNotDisturbActive: () => {
        const { preferences } = get();
        if (!preferences.doNotDisturb.enabled) {
          return false;
        }

        const now = new Date();
        const currentTime =
          now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

        const [startHour, startMin] = preferences.doNotDisturb.start
          .split(":")
          .map(Number);
        const [endHour, endMin] = preferences.doNotDisturb.end
          .split(":")
          .map(Number);

        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        // Handle overnight DND (e.g., 22:00 - 08:00)
        if (startTime > endTime) {
          return currentTime >= startTime || currentTime < endTime;
        }

        // Same-day DND (e.g., 09:00 - 17:00)
        return currentTime >= startTime && currentTime < endTime;
      },

      // Check if notifications should be shown for a category
      shouldShowNotification: (category) => {
        const { preferences, isDoNotDisturbActive } = get();

        // Master toggle
        if (!preferences.enabled) {
          return false;
        }

        // Category toggle
        if (!preferences.categories[category]) {
          return false;
        }

        // Do not disturb
        if (isDoNotDisturbActive()) {
          return false;
        }

        return true;
      },
    }),
    {
      name: "viben-notifications",
      // Only persist notifications list, not preferences (preferences are in Gateway)
      partialize: (state) => ({
        notifications: state.notifications,
        // Keep preferences in localStorage as fallback when Gateway is unavailable
        preferences: state.preferences,
      }),
    }
  )
);
