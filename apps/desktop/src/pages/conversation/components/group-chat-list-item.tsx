/**
 * Group Chat List Item
 *
 * Displays a group chat in a list with avatar, name, last message preview,
 * and member count.
 */

import { useTranslation } from "react-i18next";
import {
  Users,
  Pencil,
  Trash2,
  LogOut,
  Bell,
  BellOff,
} from "lucide-react";
import type { GroupChat, GroupChatMember, ChatListItem } from "@/lib/gateway";
import {
  ListItem,
  getGradientByName,
  formatRelativeTime,
  type ListItemAction,
  type ListItemSource,
} from "./list-item";

// ============================================================================
// Types
// ============================================================================

/** GroupChatListItem can accept either GroupChat or ChatListItem type */
export type GroupChatItemData = GroupChat | ChatListItem;

/** Type guard to check if data is ChatListItem */
function isChatListItem(data: GroupChatItemData): data is ChatListItem {
  return "item_type" in data;
}

interface GroupChatListItemProps {
  /** The group chat to display (GroupChat or ChatListItem) */
  groupChat: GroupChatItemData;
  /** Members of the group chat */
  members?: GroupChatMember[];
  /** Whether this group chat is selected */
  isSelected?: boolean;
  /** Last message preview */
  lastMessage?: string;
  /** Unread message count */
  unreadCount?: number;
  /** Whether notifications are muted */
  isMuted?: boolean;
  /** Source info for workspace badge */
  source?: ListItemSource;
  /** Called when the item is clicked */
  onClick?: () => void;
  /** Called when rename is clicked */
  onRename?: () => void;
  /** Called when delete is clicked */
  onDelete?: () => void;
  /** Called when leave is clicked */
  onLeave?: () => void;
  /** Called when mute is toggled */
  onToggleMute?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function GroupChatListItem({
  groupChat,
  members = [],
  isSelected = false,
  lastMessage,
  unreadCount = 0,
  isMuted = false,
  source,
  onClick,
  onRename,
  onDelete,
  onLeave,
  onToggleMute,
}: GroupChatListItemProps) {
  const { t } = useTranslation();

  const memberCount = members.length;

  // Build actions list
  const actions: ListItemAction[] = [];

  if (onRename) {
    actions.push({
      label: t("groupChat.rename", "Rename"),
      icon: Pencil,
      onClick: onRename,
    });
  }

  if (onToggleMute) {
    actions.push({
      label: isMuted
        ? t("groupChat.unmute", "Unmute")
        : t("groupChat.mute", "Mute"),
      icon: isMuted ? Bell : BellOff,
      onClick: onToggleMute,
    });
  }

  if (onLeave) {
    actions.push({
      label: t("groupChat.leave", "Leave Group"),
      icon: LogOut,
      onClick: onLeave,
      separator: true,
    });
  }

  if (onDelete) {
    actions.push({
      label: t("groupChat.delete", "Delete Group"),
      icon: Trash2,
      onClick: onDelete,
      destructive: true,
      separator: !onLeave,
    });
  }

  // Extract data from GroupChat or ChatListItem
  const isGlobal = isChatListItem(groupChat)
    ? (groupChat.metadata?.is_global as boolean) ?? groupChat.source === "global"
    : groupChat.is_global;

  const updatedAt = isChatListItem(groupChat)
    ? (groupChat.metadata?.created_at as string) ?? ""
    : groupChat.updated_at;

  const description = isChatListItem(groupChat)
    ? groupChat.description
    : groupChat.description;

  return (
    <ListItem
      name={groupChat.name}
      description={
        lastMessage ||
        description ||
        t("groupChat.noMessages", "No messages yet")
      }
      avatar={{
        icon: Users,
        gradient: getGradientByName(groupChat.name),
      }}
      indicators={{
        count: memberCount > 0 ? memberCount : undefined,
        source,
      }}
      badges={
        isGlobal
          ? [{ label: t("groupChat.global", "Global"), variant: "primary" }]
          : undefined
      }
      meta={{
        text: updatedAt ? formatRelativeTime(updatedAt) : undefined,
        count: unreadCount,
        icon: isMuted ? BellOff : undefined,
      }}
      isSelected={isSelected}
      onClick={onClick}
      actions={actions.length > 0 ? actions : undefined}
      contextMenu={actions.length > 0}
    />
  );
}
