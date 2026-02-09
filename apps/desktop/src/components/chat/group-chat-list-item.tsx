/**
 * Group Chat List Item
 *
 * Displays a group chat in a list with avatar, name, last message preview,
 * and member count.
 */

import { useTranslation } from "react-i18next";
import {
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  LogOut,
  Bell,
  BellOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GroupChat, GroupChatMember } from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

interface GroupChatListItemProps {
  /** The group chat to display */
  groupChat: GroupChat;
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
// Helper Functions
// ============================================================================

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Get avatar gradient colors
 */
function getAvatarGradient(name: string): string {
  const colors = [
    "from-blue-500 to-cyan-400",
    "from-purple-500 to-pink-400",
    "from-green-500 to-emerald-400",
    "from-orange-500 to-yellow-400",
    "from-red-500 to-rose-400",
    "from-indigo-500 to-violet-400",
  ];
  const index = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[index];
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
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
  onClick,
  onRename,
  onDelete,
  onLeave,
  onToggleMute,
}: GroupChatListItemProps) {
  const { t } = useTranslation();

  const memberCount = members.length;
  const hasActions = onRename || onDelete || onLeave || onToggleMute;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all rounded-lg",
        isSelected
          ? "bg-accent"
          : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className={cn(
          "relative shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
          getAvatarGradient(groupChat.name)
        )}
      >
        <Users className="h-5 w-5 text-white" />
        {/* Member count badge */}
        {memberCount > 0 && (
          <div className="absolute -bottom-1 -right-1 bg-background border rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            {memberCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm truncate">
            {truncateText(groupChat.name, 20)}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(groupChat.updated_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {lastMessage || groupChat.description || t("groupChat.noMessages", "No messages yet")}
          </p>
          {unreadCount > 0 && (
            <span className="shrink-0 bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Muted indicator */}
      {isMuted && (
        <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}

      {/* Hover actions */}
      {hasActions && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            "bg-background/80 backdrop-blur-sm rounded-md px-1 py-0.5"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {onRename && (
                <DropdownMenuItem onClick={onRename}>
                  <Pencil className="h-4 w-4 mr-2" />
                  {t("groupChat.rename", "Rename")}
                </DropdownMenuItem>
              )}
              {onToggleMute && (
                <DropdownMenuItem onClick={onToggleMute}>
                  {isMuted ? (
                    <>
                      <Bell className="h-4 w-4 mr-2" />
                      {t("groupChat.unmute", "Unmute")}
                    </>
                  ) : (
                    <>
                      <BellOff className="h-4 w-4 mr-2" />
                      {t("groupChat.mute", "Mute")}
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {onLeave && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLeave}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("groupChat.leave", "Leave Group")}
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("groupChat.delete", "Delete Group")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
