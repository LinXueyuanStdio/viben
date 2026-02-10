/**
 * System Notifications
 *
 * Cross-platform system notification API using Tauri's notification plugin.
 * Provides a simple interface to send OS-level notifications with proper
 * app icon support.
 */

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  type Options,
} from '@tauri-apps/plugin-notification';

// ============================================
// Types
// ============================================

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Optional icon path or URL */
  icon?: string;
  /** Optional sound name (platform-specific) */
  sound?: string;
  /** Whether this is a silent notification */
  silent?: boolean;
}

/**
 * Notification urgency level
 */
export type NotificationUrgency = 'low' | 'normal' | 'critical';

// ============================================
// Permission Management
// ============================================

/**
 * Check if notification permission is granted
 *
 * @returns true if permission is granted, false otherwise
 *
 * @example
 * ```ts
 * const hasPermission = await hasNotificationPermission();
 * if (!hasPermission) {
 *   await requestNotificationPermission();
 * }
 * ```
 */
export async function hasNotificationPermission(): Promise<boolean> {
  return isPermissionGranted();
}

/**
 * Request notification permission from the user
 *
 * @returns The permission state ('granted', 'denied', or 'default')
 *
 * @example
 * ```ts
 * const permission = await requestNotificationPermission();
 * if (permission === 'granted') {
 *   notify({ title: 'Success', body: 'Notifications enabled!' });
 * }
 * ```
 */
export async function requestNotificationPermission(): Promise<
  'granted' | 'denied' | 'default'
> {
  return requestPermission();
}

/**
 * Ensure notification permission is granted, requesting if needed
 *
 * @returns true if permission was granted, false if denied
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  return granted;
}

// ============================================
// Notification Functions
// ============================================

/**
 * Send a system notification
 *
 * Automatically requests permission if not granted.
 *
 * @param options - Notification options
 * @returns true if notification was sent, false if permission denied
 *
 * @example
 * ```ts
 * // Simple notification
 * await notify({ title: 'Hello', body: 'World' });
 *
 * // With icon
 * await notify({
 *   title: 'Task Complete',
 *   body: 'Your build has finished',
 *   icon: '/path/to/icon.png',
 * });
 * ```
 */
export async function notify(options: NotificationOptions): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.warn('Notification permission denied');
    return false;
  }

  const notifOptions: Options = {
    title: options.title,
    body: options.body,
  };

  if (options.icon) {
    notifOptions.icon = options.icon;
  }

  if (options.sound) {
    notifOptions.sound = options.sound;
  }

  if (options.silent !== undefined) {
    notifOptions.silent = options.silent;
  }

  sendNotification(notifOptions);
  return true;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Notify about a channel message
 *
 * @param channelName - Name of the channel
 * @param channelType - Type of the channel (e.g., 'telegram', 'discord')
 * @param sender - Message sender name
 * @param message - Message content
 */
export async function notifyChannelMessage(
  channelName: string,
  channelType: string,
  sender: string | undefined,
  message: string
): Promise<boolean> {
  return notify({
    title: `${channelName} - ${channelType}`,
    body: `${sender ?? 'Unknown'}: ${truncate(message, 200)}`,
  });
}

/**
 * Notify about cron job completion
 *
 * @param jobName - Name of the cron job
 * @param success - Whether the job succeeded
 * @param _output - Optional job output (not used, kept for API compatibility)
 */
export async function notifyCronCompletion(
  jobName: string,
  success: boolean,
  _output?: string
): Promise<boolean> {
  // Use job name as title for cleaner notification
  const title = `⏰ ${jobName}`;

  // Use human-friendly status message
  const body = success
    ? '✅ 定时任务执行完成'
    : '❌ 定时任务执行失败';

  return notify({ title, body });
}

/**
 * Notify about agent task completion
 *
 * @param agentName - Name of the agent
 * @param sessionId - Session identifier
 * @param success - Whether the task succeeded
 */
export async function notifyAgentCompletion(
  agentName: string,
  sessionId: string,
  success: boolean
): Promise<boolean> {
  const title = `Agent: ${agentName}`;
  const body = success
    ? `Session ${truncate(sessionId, 20)} completed successfully`
    : `Session ${truncate(sessionId, 20)} failed`;

  return notify({ title, body });
}

/**
 * Generic notification helper
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param critical - Whether this is a critical notification (ignored for now)
 */
export async function notifyCustom(
  title: string,
  body: string,
  _critical?: boolean
): Promise<boolean> {
  return notify({ title, body });
}

// ============================================
// Utilities
// ============================================

/**
 * Truncate a message to a maximum length
 *
 * @param message - Message to truncate
 * @param maxLen - Maximum length
 * @returns Truncated message with ellipsis if needed
 */
function truncate(message: string, maxLen: number): string {
  if (message.length <= maxLen) {
    return message;
  }
  return `${message.slice(0, maxLen - 3)}...`;
}
