/**
 * System Notification Hook
 *
 * Provides system-level notifications using Tauri's notification plugin.
 * Supports macOS, Windows, and Linux native notifications.
 */

import { useState, useEffect, useCallback } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  type Options as NotificationOptions,
} from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type NotificationPermission = "granted" | "denied" | "default" | "unknown";

export interface SystemNotificationOptions {
  /** Notification title */
  title: string;
  /** Notification body text */
  body?: string;
  /** Icon name or path */
  icon?: string;
  /** Sound to play (platform specific) */
  sound?: string;
  /** Whether to bring app to foreground on click */
  bringToForeground?: boolean;
}

export interface UseSystemNotificationReturn {
  /** Current permission status */
  permission: NotificationPermission;
  /** Whether notifications are supported */
  isSupported: boolean;
  /** Whether permission is granted */
  isGranted: boolean;
  /** Whether we're checking permission */
  isChecking: boolean;
  /** Request notification permission */
  requestPermission: () => Promise<boolean>;
  /** Send a system notification */
  notify: (options: SystemNotificationOptions) => Promise<void>;
  /** Check if app is in background (minimized or hidden) */
  isAppInBackground: () => Promise<boolean>;
  /** Send notification only if app is in background */
  notifyIfBackground: (options: SystemNotificationOptions) => Promise<void>;
}

/**
 * Hook to manage system notifications via Tauri's notification plugin.
 *
 * Usage:
 * ```tsx
 * const { notify, requestPermission, isGranted } = useSystemNotification();
 *
 * // Request permission first
 * await requestPermission();
 *
 * // Send notification
 * await notify({
 *   title: "New Message",
 *   body: "You have a new message from Agent",
 * });
 * ```
 */
export function useSystemNotification(): UseSystemNotificationReturn {
  const [permission, setPermission] = useState<NotificationPermission>("unknown");
  const [isChecking, setIsChecking] = useState(true);

  // Check permission status on mount
  useEffect(() => {
    let mounted = true;

    const checkPermission = async () => {
      try {
        const granted = await isPermissionGranted();
        if (mounted) {
          setPermission(granted ? "granted" : "default");
          setIsChecking(false);
        }
      } catch (error) {
        console.error("[SystemNotification] Failed to check permission:", error);
        if (mounted) {
          setPermission("unknown");
          setIsChecking(false);
        }
      }
    };

    checkPermission();

    return () => {
      mounted = false;
    };
  }, []);

  // Request notification permission
  const handleRequestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // First check if already granted
      const alreadyGranted = await isPermissionGranted();
      if (alreadyGranted) {
        setPermission("granted");
        return true;
      }

      // Request permission
      const result = await requestPermission();
      const granted = result === "granted";
      setPermission(granted ? "granted" : "denied");
      return granted;
    } catch (error) {
      console.error("[SystemNotification] Failed to request permission:", error);
      setPermission("denied");
      return false;
    }
  }, []);

  // Send a system notification
  const notify = useCallback(
    async (options: SystemNotificationOptions): Promise<void> => {
      try {
        // Check permission first
        const granted = await isPermissionGranted();
        if (!granted) {
          console.warn("[SystemNotification] Permission not granted");
          return;
        }

        // Build notification options
        const notificationOptions: NotificationOptions = {
          title: options.title,
          body: options.body,
        };

        // Add icon if provided
        if (options.icon) {
          notificationOptions.icon = options.icon;
        }

        // Add sound if provided
        if (options.sound) {
          notificationOptions.sound = options.sound;
        }

        // Send the notification
        await sendNotification(notificationOptions);

        // Bring app to foreground if requested and notification is clicked
        // Note: Tauri v2 notification plugin handles this via action handlers,
        // but basic notifications don't support click callbacks directly.
        // The app will be brought to foreground when user clicks the notification
        // through OS-level behavior.
      } catch (error) {
        console.error("[SystemNotification] Failed to send notification:", error);
      }
    },
    []
  );

  // Check if app is in background
  const isAppInBackground = useCallback(async (): Promise<boolean> => {
    try {
      const window = getCurrentWindow();
      const [isMinimized, isVisible, isFocused] = await Promise.all([
        window.isMinimized(),
        window.isVisible(),
        window.isFocused(),
      ]);

      // App is in background if minimized, not visible, or not focused
      return isMinimized || !isVisible || !isFocused;
    } catch (error) {
      console.error("[SystemNotification] Failed to check window state:", error);
      // Default to false (assume foreground) on error
      return false;
    }
  }, []);

  // Send notification only if app is in background
  const notifyIfBackground = useCallback(
    async (options: SystemNotificationOptions): Promise<void> => {
      const inBackground = await isAppInBackground();
      if (inBackground) {
        await notify(options);
      }
    },
    [isAppInBackground, notify]
  );

  return {
    permission,
    isSupported: true, // Tauri notifications are always supported on desktop
    isGranted: permission === "granted",
    isChecking,
    requestPermission: handleRequestPermission,
    notify,
    isAppInBackground,
    notifyIfBackground,
  };
}

/**
 * Utility function to send a notification (for use outside React components)
 */
export async function sendSystemNotification(
  options: SystemNotificationOptions
): Promise<void> {
  try {
    const granted = await isPermissionGranted();
    if (!granted) {
      console.warn("[SystemNotification] Permission not granted");
      return;
    }

    const notificationOptions: NotificationOptions = {
      title: options.title,
      body: options.body,
    };

    if (options.icon) {
      notificationOptions.icon = options.icon;
    }

    if (options.sound) {
      notificationOptions.sound = options.sound;
    }

    await sendNotification(notificationOptions);
  } catch (error) {
    console.error("[SystemNotification] Failed to send notification:", error);
  }
}

/**
 * Utility function to check and request permission (for use outside React components)
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const granted = await isPermissionGranted();
    if (granted) {
      return true;
    }

    const result = await requestPermission();
    return result === "granted";
  } catch (error) {
    console.error("[SystemNotification] Failed to ensure permission:", error);
    return false;
  }
}
