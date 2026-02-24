/**
 * Cron Job Notification Adapter
 *
 * Listens to WebSocket events and displays notifications.
 * This is the application layer adapter that connects gateway events
 * to the notification system.
 *
 * Architecture:
 * - Gateway (viben-core) broadcasts events via WebSocket
 * - Application layer (desktop/cli) decides how to display notifications
 * - This adapter handles the desktop app notification display
 */

import { useCallback } from "react";
import { useGatewayWebSocket, type GatewayEventPayload } from "./use-gateway-websocket";
import { useNotificationStore } from "@/stores/notification-store";
import { useSystemNotification } from "@/hooks/use-system-notification";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { JobStatus } from "@/types/cron";

// ============================================================================
// Types
// ============================================================================

interface CronNotificationSettings {
  in_app?: boolean;
  system?: boolean;
  channel_ids?: string[];
}

interface CronJobCompletedData {
  job_id: string;
  job_name: string;
  job_type: "agent" | "script";
  status: JobStatus;
  /** Duration in milliseconds */
  duration_ms: number;
  /** Output message (truncated) */
  output?: string;
  completed_at: number;
  /** Notification settings from the job */
  notifications?: CronNotificationSettings;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook that automatically displays notifications for cron job events.
 *
 * This hook connects to the gateway WebSocket, subscribes to cron events,
 * and displays appropriate notifications (toast, system notification, notification center).
 *
 * @example
 * ```tsx
 * // In your root layout or app component:
 * function App() {
 *   useCronNotificationAdapter();
 *   return <>{children}</>;
 * }
 * ```
 */
export function useCronNotificationAdapter() {
  const { t } = useTranslation();
  const { addNotification, shouldShowNotification } = useNotificationStore();
  const { notifyIfBackground } = useSystemNotification();

  // Handle incoming cron events
  const handleCronEvent = useCallback(
    async (channel: string, payload: GatewayEventPayload) => {
      // Debug logging
      console.log("[CronNotificationAdapter] Received event:", { channel, payload });

      // Only handle cron channel events
      if (channel !== "cron") {
        console.log("[CronNotificationAdapter] Ignoring non-cron channel:", channel);
        return;
      }

      // Check if cron notifications are enabled
      if (!shouldShowNotification("cron")) {
        console.log("[CronNotificationAdapter] Cron notifications disabled");
        return;
      }

      switch (payload.type) {
        case "CronJobCompleted": {
          const data = payload.data as unknown as CronJobCompletedData;
          if (!data) return;

          const { job_name, job_type, status, duration_ms, output, notifications } = data;
          const isSuccess = status === "success";

          // Check notification settings from the job
          const shouldNotifyInApp = notifications?.in_app !== false; // default to true
          const shouldNotifySystem = notifications?.system === true; // default to false

          // Format duration for display
          const formatDuration = (ms: number): string => {
            if (ms < 1000) return `${ms}ms`;
            if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
            const mins = Math.floor(ms / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            return `${mins}m ${secs}s`;
          };

          const durationText = formatDuration(duration_ms);
          const jobTypeLabel = job_type === "agent"
            ? t("notifications.system.jobTypeAgent")
            : t("notifications.system.jobTypeScript");

          const level = isSuccess ? "success" : "error";
          const title = isSuccess
            ? t("notifications.system.cronJobCompleted")
            : t("notifications.system.cronJobFailed");

          // Build detailed description
          let body: string;
          if (isSuccess) {
            body = t("notifications.system.cronJobCompletedDetail", {
              name: job_name,
              type: jobTypeLabel,
              duration: durationText,
            });
          } else {
            body = t("notifications.system.cronJobFailedDetail", {
              name: job_name,
              type: jobTypeLabel,
              duration: durationText,
            });
          }

          // Append output if available (truncate for toast)
          const truncatedOutput = output && output.length > 100
            ? `${output.slice(0, 100)}...`
            : output;

          // Add to notification center (with full output) - always add for history
          addNotification({
            category: "cron",
            level,
            title,
            body: output ? `${body}\n${output}` : body,
            metadata: {
              cronJobId: data.job_id,
              actionUrl: `/workspace/cron`,
              jobType: job_type,
              durationMs: duration_ms,
            },
          });

          // Show toast notification if in_app is enabled
          const toastBody = truncatedOutput ? `${body}\n${truncatedOutput}` : body;
          if (shouldNotifyInApp) {
            if (isSuccess) {
              toast.success(title, { description: toastBody });
            } else {
              toast.error(title, { description: toastBody });
            }
          }

          // Send system notification if:
          // 1. notifications.system is enabled on the job, OR
          // 2. Job failed (always notify for failures)
          if (shouldNotifySystem || !isSuccess) {
            await notifyIfBackground({ title, body: toastBody });
          }
          break;
        }

        // Optionally handle triggered events (usually don't need notification)
        // case "CronJobTriggered": {
        //   // Could show a subtle indicator that job started
        //   break;
        // }
      }
    },
    [t, addNotification, shouldShowNotification, notifyIfBackground]
  );

  // Use gateway WebSocket with heartbeat and auto-reconnect
  useGatewayWebSocket({
    channels: ["cron"],
    onEvent: handleCronEvent,
    // Heartbeat every 30 seconds
    heartbeatInterval: 30000,
    // Timeout after 10 seconds of no response
    heartbeatTimeout: 10000,
    // Start reconnect at 1 second
    reconnectDelay: 1000,
    // Max reconnect delay of 30 seconds
    maxReconnectDelay: 30000,
    // Unlimited reconnect attempts
    maxReconnectAttempts: Infinity,
  });
}
