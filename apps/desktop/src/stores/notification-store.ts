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

/** Maximum number of notifications to store */
const MAX_NOTIFICATIONS = 100;

/** Generate unique notification ID */
const generateNotificationId = () =>
  `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface NotificationState {
  // Notifications list
  notifications: AppNotification[];

  // User preferences
  preferences: NotificationPreferences;

  // Actions: Notification management
  addNotification: (input: CreateNotificationInput) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  clearCategory: (category: NotificationCategory) => void;

  // Actions: Preference management
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

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,

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

      // Update preferences (partial update)
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      // Toggle category notifications
      setCategoryEnabled: (category, enabled) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            categories: {
              ...state.preferences.categories,
              [category]: enabled,
            },
          },
        })),

      // Set notification method for a category
      setCategoryMethod: (category, method) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            methods: {
              ...state.preferences.methods,
              [category]: method,
            },
          },
        })),

      // Set do not disturb settings
      setDoNotDisturb: (enabled, start, end) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            doNotDisturb: {
              enabled,
              start: start ?? state.preferences.doNotDisturb.start,
              end: end ?? state.preferences.doNotDisturb.end,
            },
          },
        })),

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
      partialize: (state) => ({
        notifications: state.notifications,
        preferences: state.preferences,
      }),
    }
  )
);
