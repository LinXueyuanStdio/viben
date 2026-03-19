/**
 * System notifications module
 *
 * Cross-platform system notifications using native OS capabilities:
 * - macOS: osascript (AppleScript)
 * - Linux: notify-send
 * - Windows: PowerShell
 */
import { spawn } from "node:child_process";
import { platform } from "node:os";

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Subtitle (macOS only) */
  subtitle?: string;
  /** Sound to play */
  sound?: boolean | string;
  /** Icon path (Linux, Windows) */
  icon?: string;
  /** Timeout in milliseconds (Linux, Windows) */
  timeout?: number;
  /** Actions/buttons (limited support) */
  actions?: string[];
}

/**
 * Send a system notification
 */
export async function sendNotification(options: NotificationOptions): Promise<boolean> {
  const os = platform();

  try {
    switch (os) {
      case "darwin":
        return await sendMacOSNotification(options);
      case "linux":
        return await sendLinuxNotification(options);
      case "win32":
        return await sendWindowsNotification(options);
      default:
        console.warn(`[Notifications] Unsupported platform: ${os}`);
        return false;
    }
  } catch (error) {
    console.error("[Notifications] Failed to send notification:", error);
    return false;
  }
}

/**
 * Send notification on macOS using osascript
 */
async function sendMacOSNotification(options: NotificationOptions): Promise<boolean> {
  const { title, message, subtitle, sound } = options;

  // Build AppleScript command
  let script = `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`;

  if (subtitle) {
    script += ` subtitle "${escapeAppleScript(subtitle)}"`;
  }

  if (sound) {
    const soundName = typeof sound === "string" ? sound : "default";
    script += ` sound name "${soundName}"`;
  }

  return new Promise((resolve) => {
    const proc = spawn("osascript", ["-e", script]);

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Send notification on Linux using notify-send
 */
async function sendLinuxNotification(options: NotificationOptions): Promise<boolean> {
  const { title, message, icon, timeout } = options;

  const args = [title, message];

  if (icon) {
    args.push("-i", icon);
  }

  if (timeout) {
    args.push("-t", timeout.toString());
  }

  return new Promise((resolve) => {
    const proc = spawn("notify-send", args);

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Send notification on Windows using PowerShell
 */
async function sendWindowsNotification(options: NotificationOptions): Promise<boolean> {
  const { title, message, icon } = options;

  // Use BurntToast module if available, otherwise fall back to basic toast
  const iconParam = icon ? `-AppLogo "${icon}"` : "";
  const script = `
    try {
      Import-Module BurntToast -ErrorAction Stop
      New-BurntToastNotification -Text "${escapePS(title)}", "${escapePS(message)}" ${iconParam}
    } catch {
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
      $template = @"
<toast>
  <visual>
    <binding template="ToastText02">
      <text id="1">${escapeXml(title)}</text>
      <text id="2">${escapeXml(message)}</text>
    </binding>
  </visual>
</toast>
"@
      $xml = [Windows.Data.Xml.Dom.XmlDocument]::new()
      $xml.LoadXml($template)
      $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Viben").Show($toast)
    }
  `;

  return new Promise((resolve) => {
    const proc = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      shell: false,
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Escape string for AppleScript
 * @internal Exported for testing
 */
export function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Escape string for PowerShell
 * @internal Exported for testing
 */
export function escapePS(str: string): string {
  return str.replace(/`/g, "``").replace(/"/g, '`"').replace(/\$/g, "`$");
}

/**
 * Escape string for XML
 * @internal Exported for testing
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// Convenience functions
// ============================================================================

/**
 * Notify that a cron job has completed
 */
export async function notifyCronCompletion(
  jobName: string,
  status: "success" | "failure",
  duration?: number
): Promise<boolean> {
  const statusEmoji = status === "success" ? "✅" : "❌";
  const durationText = duration ? ` (${Math.round(duration / 1000)}s)` : "";

  return sendNotification({
    title: "Viben Cron Job",
    message: `${statusEmoji} ${jobName}${durationText}`,
    sound: status === "failure",
  });
}

/**
 * Notify that an agent has completed
 */
export async function notifyAgentCompletion(
  agentName: string,
  sessionId: string,
  success: boolean
): Promise<boolean> {
  const statusEmoji = success ? "✅" : "❌";

  return sendNotification({
    title: "Viben Agent",
    message: `${statusEmoji} ${agentName} session ${sessionId.slice(0, 8)} ${success ? "completed" : "failed"}`,
    sound: !success,
  });
}

/**
 * Notify that a channel message was received
 */
export async function notifyChannelMessage(
  channelType: string,
  channelName: string,
  senderName: string,
  message: string
): Promise<boolean> {
  const truncatedMessage = message.length > 100 ? message.slice(0, 97) + "..." : message;

  return sendNotification({
    title: `${channelType}: ${channelName}`,
    message: `${senderName}: ${truncatedMessage}`,
    sound: true,
  });
}

/**
 * Notify a simple message
 */
export async function notify(title: string, message: string): Promise<boolean> {
  return sendNotification({ title, message });
}
