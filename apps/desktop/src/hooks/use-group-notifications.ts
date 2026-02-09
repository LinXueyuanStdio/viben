/**
 * Group Chat Notification Hook
 *
 * Sends notifications for group chat events:
 * - New message from other members
 * - User is @mentioned
 * - Member joins/leaves group
 * - Group is created/deleted
 */

import { useCallback } from "react";
import { useNotificationStore } from "@/stores/notification-store";
import { toast } from "@/hooks/use-toast";
import { useSystemNotification } from "@/hooks/use-system-notification";
import { useTranslation } from "react-i18next";
import type { GroupChatMessage, GroupChatMember } from "@/lib/gateway";

export interface UseGroupNotificationsReturn {
  /**
   * Send notification for a new group message
   * @param groupId - The group chat ID
   * @param groupName - The group chat name
   * @param message - The message received
   * @param currentUserId - Current user's ID to check for mentions
   */
  notifyGroupMessage: (
    groupId: string,
    groupName: string,
    message: GroupChatMessage,
    currentUserId: string
  ) => Promise<void>;

  /**
   * Send notification when a member joins the group
   * @param groupId - The group chat ID
   * @param groupName - The group chat name
   * @param member - The member who joined
   */
  notifyMemberJoined: (
    groupId: string,
    groupName: string,
    member: GroupChatMember
  ) => Promise<void>;

  /**
   * Send notification when a member leaves the group
   * @param groupId - The group chat ID
   * @param groupName - The group chat name
   * @param memberId - The ID of the member who left
   * @param memberName - The display name of the member who left
   */
  notifyMemberLeft: (
    groupId: string,
    groupName: string,
    memberId: string,
    memberName?: string
  ) => Promise<void>;

  /**
   * Send notification when a group is created
   * @param groupId - The group chat ID
   * @param groupName - The group chat name
   */
  notifyGroupCreated: (groupId: string, groupName: string) => Promise<void>;

  /**
   * Send notification when a group is deleted
   * @param groupName - The group chat name that was deleted
   */
  notifyGroupDeleted: (groupName: string) => Promise<void>;
}

/**
 * Hook to manage group chat notifications.
 *
 * Sends notifications based on user preferences:
 * - Toast notifications for in-app feedback
 * - System notifications when app is in background (especially for mentions)
 * - Adds to notification center for history
 *
 * @example
 * ```tsx
 * const { notifyGroupMessage, notifyMemberJoined } = useGroupNotifications();
 *
 * // When a new message arrives
 * await notifyGroupMessage(group.id, group.name, message, currentUserId);
 *
 * // When a member joins
 * await notifyMemberJoined(group.id, group.name, member);
 * ```
 */
export function useGroupNotifications(): UseGroupNotificationsReturn {
  const { t } = useTranslation();
  const { addNotification, shouldShowNotification } = useNotificationStore();
  const { notifyIfBackground } = useSystemNotification();

  /**
   * Check if the message mentions the current user
   */
  const checkIsMentioned = useCallback(
    (message: GroupChatMessage, currentUserId: string): boolean => {
      if (!message.mentions || message.mentions.length === 0) {
        return false;
      }
      return message.mentions.includes(currentUserId);
    },
    []
  );

  /**
   * Truncate message content for notification display
   */
  const truncateContent = useCallback((content: string, maxLength = 100): string => {
    if (content.length <= maxLength) {
      return content;
    }
    return content.slice(0, maxLength) + "...";
  }, []);

  /**
   * Notify when a new message is received
   */
  const notifyGroupMessage = useCallback(
    async (
      groupId: string,
      groupName: string,
      message: GroupChatMessage,
      currentUserId: string
    ) => {
      console.log("[GroupNotifications] notifyGroupMessage called:", {
        groupId,
        groupName,
        senderId: message.sender_id,
        currentUserId,
        content: message.content?.slice(0, 50),
      });

      // Don't notify for own messages
      if (message.sender_id === currentUserId) {
        console.log("[GroupNotifications] Skipping - own message");
        return;
      }

      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        console.log("[GroupNotifications] Skipping - notifications disabled");
        return;
      }

      const isMentioned = checkIsMentioned(message, currentUserId);
      const truncatedContent = truncateContent(message.content);

      let title: string;
      let body: string;
      const level: "info" | "warning" = isMentioned ? "warning" : "info";

      if (isMentioned) {
        // User was mentioned
        title = t("notifications.groupChat.mentioned", {
          sender: message.sender_name,
          group: groupName,
        });
        body = truncatedContent;
      } else {
        // Regular message
        title = t("notifications.groupChat.newMessage", {
          sender: message.sender_name,
          group: groupName,
        });
        body = truncatedContent;
      }

      // Add to notification center for history
      addNotification({
        category: "chat",
        level,
        title,
        body,
        metadata: {
          groupId,
          actionUrl: `/workspace/chat?group=${groupId}`,
        },
      });

      console.log("[GroupNotifications] Showing notification:", { title, body, level, isMentioned });

      // Show toast notification
      if (isMentioned) {
        toast.warning(title, { description: body });
        // Always send system notification for mentions
        await notifyIfBackground({ title, body });
      } else {
        toast.info(title, { description: body });
        // Send system notification only if app is in background
        await notifyIfBackground({ title, body });
      }
    },
    [t, addNotification, shouldShowNotification, notifyIfBackground, checkIsMentioned, truncateContent]
  );

  /**
   * Notify when a member joins the group
   */
  const notifyMemberJoined = useCallback(
    async (groupId: string, groupName: string, member: GroupChatMember) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const title = t("notifications.groupChat.memberJoined", { group: groupName });
      const body = t("notifications.groupChat.memberJoinedDesc", {
        name: member.display_name,
      });

      // Add to notification center
      addNotification({
        category: "chat",
        level: "info",
        title,
        body,
        metadata: {
          groupId,
          actionUrl: `/workspace/chat?group=${groupId}`,
        },
      });

      // Show toast notification
      toast.info(title, { description: body });
    },
    [t, addNotification, shouldShowNotification]
  );

  /**
   * Notify when a member leaves the group
   */
  const notifyMemberLeft = useCallback(
    async (
      groupId: string,
      groupName: string,
      memberId: string,
      memberName?: string
    ) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const displayName = memberName || memberId;
      const title = t("notifications.groupChat.memberLeft", { group: groupName });
      const body = t("notifications.groupChat.memberLeftDesc", {
        name: displayName,
      });

      // Add to notification center
      addNotification({
        category: "chat",
        level: "info",
        title,
        body,
        metadata: {
          groupId,
          actionUrl: `/workspace/chat?group=${groupId}`,
        },
      });

      // Show toast notification
      toast.info(title, { description: body });
    },
    [t, addNotification, shouldShowNotification]
  );

  /**
   * Notify when a group is created
   */
  const notifyGroupCreated = useCallback(
    async (groupId: string, groupName: string) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const title = t("notifications.groupChat.groupCreated");
      const body = t("notifications.groupChat.groupCreatedDesc", { name: groupName });

      // Add to notification center
      addNotification({
        category: "chat",
        level: "success",
        title,
        body,
        metadata: {
          groupId,
          actionUrl: `/workspace/chat?group=${groupId}`,
        },
      });

      // Show toast notification
      toast.success(title, { description: body });
    },
    [t, addNotification, shouldShowNotification]
  );

  /**
   * Notify when a group is deleted
   */
  const notifyGroupDeleted = useCallback(
    async (groupName: string) => {
      // Check if chat notifications are enabled
      if (!shouldShowNotification("chat")) {
        return;
      }

      const title = t("notifications.groupChat.groupDeleted");
      const body = t("notifications.groupChat.groupDeletedDesc", { name: groupName });

      // Add to notification center
      addNotification({
        category: "chat",
        level: "info",
        title,
        body,
      });

      // Show toast notification
      toast.info(title, { description: body });
    },
    [t, addNotification, shouldShowNotification]
  );

  return {
    notifyGroupMessage,
    notifyMemberJoined,
    notifyMemberLeft,
    notifyGroupCreated,
    notifyGroupDeleted,
  };
}
