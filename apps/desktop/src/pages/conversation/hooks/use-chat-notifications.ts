/**
 * Chat Notification Hook
 *
 * Sends notifications for chat-related events:
 * - AI assistant response received
 * - Long-running operation completed
 * - Error occurred during chat
 */

import { useCallback } from "react";
import { useNotificationStore } from "@/stores/notification-store";
import { toast } from "@/hooks/use-toast";
import { useSystemNotification } from "@/hooks/use-system-notification";
import { useTranslation } from "react-i18next";

export type ChatNotificationType =
  | "ai_response"
  | "operation_completed"
  | "error";

export interface UseChatNotificationsReturn {
  /**
   * Send notification when AI assistant responds
   * @param agentName - The name of the AI agent
   * @param preview - Preview of the response content
   * @param metadata - Optional metadata for navigation
   */
  notifyAIResponse: (
    agentName: string,
    preview: string,
    metadata?: {
      agentId?: string;
      workspaceId?: string;
      sessionId?: string;
    }
  ) => Promise<void>;

  /**
   * Send notification when a long-running operation completes
   * @param operationName - Name of the operation (e.g., "File processing")
   * @param success - Whether the operation succeeded
   * @param details - Optional details about the result
   */
  notifyOperationComplete: (
    operationName: string,
    success: boolean,
    details?: string
  ) => Promise<void>;

  /**
   * Send notification when an error occurs in chat
   * @param errorMessage - The error message
   * @param agentName - Optional agent name for context
   */
  notifyChatError: (
    errorMessage: string,
    agentName?: string
  ) => Promise<void>;
}

/**
 * Hook to manage chat notifications.
 *
 * Sends notifications based on user preferences:
 * - Toast notifications for in-app feedback
 * - System notifications when app is in background
 * - Adds to notification center for history
 *
 * @example
 * ```tsx
 * const { notifyAIResponse, notifyChatError } = useChatNotifications();
 *
 * // When AI responds
 * await notifyAIResponse("Claude", "Here is the analysis...", {
 *   agentId: "agent-123",
 *   workspaceId: "ws-456",
 * });
 *
 * // When operation completes
 * await notifyOperationComplete("File processing", true, "Processed 10 files");
 *
 * // When error occurs
 * await notifyChatError("Failed to connect to server", "Claude");
 * ```
 */
export function useChatNotifications(): UseChatNotificationsReturn {
  const { t } = useTranslation();
  const { addNotification, shouldShowNotification } = useNotificationStore();
  const { notifyIfBackground } = useSystemNotification();

  /**
   * Truncate text to a maximum length
   */
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  };

  /**
   * Notify when AI assistant responds
   */
  const notifyAIResponse = useCallback(
    async (
      agentName: string,
      preview: string,
      metadata?: {
        agentId?: string;
        workspaceId?: string;
        sessionId?: string;
      }
    ) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const title = t("notifications.system.newMessageFrom", { name: agentName });
      const body = truncate(preview, 100);

      // Add to notification center for history
      addNotification({
        category: "chat",
        level: "info",
        title,
        body,
        metadata: {
          agentId: metadata?.agentId,
          workspaceId: metadata?.workspaceId,
          actionUrl: metadata?.workspaceId
            ? `/workspace/${metadata.workspaceId}/chat`
            : undefined,
        },
      });

      // Show toast notification for immediate feedback
      toast.info(agentName, {
        description: truncate(preview, 50),
      });

      // Send system notification if app is in background
      await notifyIfBackground({
        title,
        body,
      });
    },
    [t, addNotification, shouldShowNotification, notifyIfBackground]
  );

  /**
   * Notify when a long-running operation completes
   */
  const notifyOperationComplete = useCallback(
    async (
      operationName: string,
      success: boolean,
      details?: string
    ) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const title = success
        ? t("notifications.system.taskCompleted")
        : t("notifications.system.taskFailed");
      const body = success
        ? t("notifications.system.taskCompletedDesc", { name: operationName })
        : details || t("notifications.system.taskFailedDesc", { name: operationName });
      const level = success ? "success" : "error";

      // Add to notification center
      addNotification({
        category: "chat",
        level,
        title,
        body,
      });

      // Show toast notification
      if (success) {
        toast.success(title, { description: body });
      } else {
        toast.error(title, { description: body });
        // For failures, also send system notification
        await notifyIfBackground({ title, body });
      }
    },
    [t, addNotification, shouldShowNotification, notifyIfBackground]
  );

  /**
   * Notify when an error occurs in chat
   */
  const notifyChatError = useCallback(
    async (errorMessage: string, agentName?: string) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const title = agentName
        ? t("notifications.system.agentFailed")
        : t("chat.error");
      const body = agentName
        ? t("notifications.system.agentFailedDesc", { name: agentName }) + ": " + errorMessage
        : errorMessage;

      // Add to notification center
      addNotification({
        category: "chat",
        level: "error",
        title,
        body,
        metadata: agentName
          ? { agentId: agentName }
          : undefined,
      });

      // Show toast notification
      toast.error(title, { description: truncate(body, 100) });

      // Send system notification for errors (important to notify user)
      await notifyIfBackground({ title, body: truncate(body, 100) });
    },
    [t, addNotification, shouldShowNotification, notifyIfBackground]
  );

  return {
    notifyAIResponse,
    notifyOperationComplete,
    notifyChatError,
  };
}
