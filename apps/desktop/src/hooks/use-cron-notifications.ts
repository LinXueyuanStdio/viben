/**
 * Cron Job Notification Hook
 *
 * Sends notifications when cron job status changes:
 * - Job started execution
 * - Job completed successfully
 * - Job failed with error
 */

import { useCallback } from "react";
import { useNotificationStore } from "@/stores/notification-store";
import { toast } from "@/hooks/use-toast";
import { useSystemNotification } from "@/hooks/use-system-notification";
import { useTranslation } from "react-i18next";
import { useAnalytics } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics/types";

export type CronJobStatus = "started" | "completed" | "failed";

export interface UseCronNotificationsReturn {
  /**
   * Send notification for cron job status change
   * @param jobId - The cron job ID
   * @param jobName - The cron job name
   * @param status - The new status
   * @param error - Error message if status is "failed"
   */
  notifyCronStatus: (
    jobId: string,
    jobName: string,
    status: CronJobStatus,
    error?: string
  ) => Promise<void>;
}

/**
 * Hook to manage cron job notifications.
 *
 * Sends notifications based on user preferences:
 * - Toast notifications for in-app feedback
 * - System notifications when app is in background (especially for failures)
 * - Adds to notification center for history
 *
 * @example
 * ```tsx
 * const { notifyCronStatus } = useCronNotifications();
 *
 * // When job starts
 * await notifyCronStatus(job.id, job.name, "started");
 *
 * // When job completes
 * await notifyCronStatus(job.id, job.name, "completed");
 *
 * // When job fails
 * await notifyCronStatus(job.id, job.name, "failed", "Connection timeout");
 * ```
 */
export function useCronNotifications(): UseCronNotificationsReturn {
  const { t } = useTranslation();
  const { logEvent } = useAnalytics();
  const { addNotification, shouldShowNotification } = useNotificationStore();
  const { notifyIfBackground } = useSystemNotification();

  const notifyCronStatus = useCallback(
    async (
      jobId: string,
      jobName: string,
      status: CronJobStatus,
      error?: string
    ) => {
      // Check if cron notifications are enabled
      if (!shouldShowNotification("cron")) {
        return;
      }

      let level: "info" | "success" | "error" = "info";
      let title = "";
      let body = "";

      switch (status) {
        case "started":
          level = "info";
          title = t("notifications.system.cronJobStarted");
          body = t("notifications.system.cronJobStartedDesc", { name: jobName });
          break;
        case "completed":
          level = "success";
          title = t("notifications.system.cronJobCompleted");
          body = t("notifications.system.cronJobCompletedDesc", { name: jobName });
          break;
        case "failed":
          level = "error";
          title = t("notifications.system.cronJobFailed");
          body = error || t("notifications.system.cronJobFailedDesc", { name: jobName });
          break;
      }

      // Add to notification center for history
      addNotification({
        category: "cron",
        level,
        title,
        body,
        metadata: {
          cronJobId: jobId,
          actionUrl: `/workspace/cron`,
        },
      });

      // Track notification received
      try {
        logEvent(AnalyticsEvents.NOTIFICATION_RECEIVED, {
          notification_type: status,
          notification_category: "cron",
          source: "cron_job",
        });
      } catch {}

      // Show toast notification for immediate feedback
      switch (status) {
        case "started":
          toast.info(title, { description: body });
          break;
        case "completed":
          toast.success(title, { description: body });
          break;
        case "failed":
          toast.error(title, { description: body });
          // For failures, also send system notification even if in foreground
          // to make sure user notices important errors
          await notifyIfBackground({ title, body });
          break;
      }
    },
    [t, addNotification, shouldShowNotification, notifyIfBackground]
  );

  return { notifyCronStatus };
}
