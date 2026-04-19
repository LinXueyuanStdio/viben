/**
 * Group Chat Message List
 *
 * Displays messages in a group chat with support for multiple senders,
 * @mentions highlighting, and system messages.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, User, ArrowDown, MessageSquare, Reply } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  GroupChatUIMessage,
  GroupChatMember,
} from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

interface GroupChatMessageListProps {
  /** Messages to display */
  messages: GroupChatUIMessage[];
  /** Members of the group chat (for display names and avatars) */
  members: GroupChatMember[];
  /** Current user's ID (for styling own messages) */
  currentUserId?: string;
  /** Members currently typing */
  typingMembers?: string[];
  /** Callback when a mention is clicked */
  onMentionClick?: (memberId: string) => void;
  /** Callback when reply button is clicked */
  onReply?: (message: GroupChatUIMessage) => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp to relative time or absolute time
 */
function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get avatar gradient color based on name
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
 * Get icon for message type
 */
function MessageTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "user":
      return <User className={className} />;
    case "agent_thinking":
    case "agent_response":
      return <Bot className={className} />;
    case "system":
      return <MessageSquare className={className} />;
    default:
      return <User className={className} />;
  }
}

/**
 * Parse content and highlight @mentions
 * @internal Reserved for future mention highlighting feature
 * @public Exported for potential use in other components
 */
export function renderContentWithMentions(
  content: string,
  mentions: string[] | undefined,
  members: GroupChatMember[],
  onMentionClick?: (memberId: string) => void
): React.ReactNode {
  if (!mentions || mentions.length === 0) {
    return content;
  }

  // Create a map of member_id to display_name
  const memberNameMap = new Map<string, string>();
  members.forEach((m) => memberNameMap.set(m.member_id, m.display_name));

  // Simple regex to find @mentions in content
  const mentionPattern = /@(\S+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const mentionedName = match[1];
    // Check if this is a valid mention
    const memberId = mentions.find((id) => {
      const displayName = memberNameMap.get(id);
      return displayName?.toLowerCase() === mentionedName.toLowerCase() ||
             id.toLowerCase() === mentionedName.toLowerCase();
    });

    if (memberId) {
      const displayName = memberNameMap.get(memberId) || mentionedName;
      parts.push(
        <span
          key={`mention-${match.index}`}
          className="bg-primary/10 text-primary px-1 rounded cursor-pointer hover:bg-primary/20 transition-colors"
          onClick={() => onMentionClick?.(memberId)}
        >
          @{displayName}
        </span>
      );
    } else {
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

// ============================================================================
// Message Item Component
// ============================================================================

interface MessageItemProps {
  message: GroupChatUIMessage;
  members: GroupChatMember[];
  isOwn: boolean;
  showAvatar: boolean;
  showName: boolean;
  onMentionClick?: (memberId: string) => void;
  onReply?: (message: GroupChatUIMessage) => void;
}

function MessageItem({
  message,
  members: _members,
  isOwn,
  showAvatar,
  showName,
  onMentionClick: _onMentionClick,
  onReply,
}: MessageItemProps) {
  // Mark as reserved for future use
  void _members;
  void _onMentionClick;

  const { t } = useTranslation();
  const [showActions, setShowActions] = React.useState(false);

  // Get sender name from message or agent_name
  const senderName = message.sender_name || message.agent_name || t("common.unknown");

  // System message styling
  if (message.type === "system") {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  // Agent thinking message styling
  if (message.type === "agent_thinking") {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div
          className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
            getAvatarGradient(senderName)
          )}
        >
          <Bot className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs text-muted-foreground italic">
          {senderName} {t("groupChat.isThinking", "is thinking...")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex gap-3",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className="shrink-0 w-8">
        {showAvatar ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm cursor-default",
                    getAvatarGradient(senderName)
                  )}
                >
                  <MessageTypeIcon
                    type={message.type}
                    className="h-4 w-4 text-white"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side={isOwn ? "left" : "right"}>
                <p className="font-medium">{senderName}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {message.type === "user" ? "human" : "agent"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col max-w-[70%] min-w-0",
          isOwn ? "items-end" : "items-start"
        )}
      >
        {/* Sender name */}
        {showName && !isOwn && (
          <span className="text-xs font-medium text-muted-foreground mb-1 px-1">
            {senderName}
          </span>
        )}

        {/* Message bubble */}
        <div className="relative">
          <div
            className={cn(
              "px-3 py-2 rounded-2xl",
              isOwn
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            )}
          >
            <p className="whitespace-pre-wrap break-words">
              {message.content || ""}
            </p>
          </div>

          {/* Hover actions */}
          {showActions && onReply && (
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 flex items-center gap-1",
                isOwn ? "-left-8" : "-right-8"
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 bg-background/80 shadow-sm"
                onClick={() => onReply(message)}
              >
                <Reply className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground mt-1 px-1">
          {formatMessageTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Typing Indicator
// ============================================================================

interface TypingIndicatorProps {
  typingMembers: string[];
  members: GroupChatMember[];
}

function TypingIndicator({ typingMembers, members }: TypingIndicatorProps) {
  const { t } = useTranslation();

  if (typingMembers.length === 0) return null;

  // Get display names of typing members
  const typingNames = typingMembers.map((id) => {
    const member = members.find((m) => m.member_id === id);
    return member?.display_name || id;
  });

  let text: string;
  if (typingNames.length === 1) {
    text = t("groupChat.oneTyping", "{{name}} is typing...", { name: typingNames[0] });
  } else if (typingNames.length === 2) {
    text = t("groupChat.twoTyping", "{{name1}} and {{name2}} are typing...", {
      name1: typingNames[0],
      name2: typingNames[1],
    });
  } else {
    text = t("groupChat.manyTyping", "Several people are typing...");
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>{text}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GroupChatMessageList({
  messages,
  members,
  currentUserId = "user-1",
  typingMembers = [],
  onMentionClick,
  onReply,
  className,
}: GroupChatMessageListProps) {
  // Mark as reserved for future use
  void renderContentWithMentions;
  void onMentionClick;

  const { t } = useTranslation();
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Scroll state
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const userScrolledUpRef = React.useRef(false);
  const lastScrollTopRef = React.useRef(0);

  // Scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Check scroll position
  const checkScrollPosition = React.useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Detect manual scroll up
    if (scrollTop < lastScrollTopRef.current && distanceFromBottom > 100) {
      userScrolledUpRef.current = true;
    }

    // Re-enable auto-scroll when near bottom
    if (distanceFromBottom < 50) {
      userScrolledUpRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  // Auto-scroll on new messages
  React.useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Add scroll listener
  React.useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScrollPosition);
    checkScrollPosition();

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
    };
  }, [checkScrollPosition]);

  // Determine which messages should show avatar and name
  // (show if first message from sender or sender changed)
  const shouldShowMeta = (index: number): { showAvatar: boolean; showName: boolean } => {
    if (index === 0) return { showAvatar: true, showName: true };

    const current = messages[index];
    const prev = messages[index - 1];

    // System and thinking messages don't need avatars
    if (current.type === "system" || current.type === "agent_thinking") {
      return { showAvatar: false, showName: false };
    }

    // Get sender id from message
    const currentSenderId = current.sender_id || current.agent_id;
    const prevSenderId = prev.sender_id || prev.agent_id;

    // Show if sender changed
    if (prevSenderId !== currentSenderId) {
      return { showAvatar: true, showName: true };
    }

    // Show if more than 5 minutes apart
    const timeDiff = new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime();
    if (timeDiff > 5 * 60 * 1000) {
      return { showAvatar: true, showName: true };
    }

    return { showAvatar: false, showName: false };
  };

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={cn("flex flex-1 items-center justify-center", className)}>
        <div className="text-center max-w-md px-4">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="font-semibold text-foreground mb-2">
            {t("groupChat.emptyTitle", "No messages yet")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("groupChat.emptyDescription", "Start the conversation by sending a message.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex-1", className)}>
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="space-y-3 p-4 pb-8">
          {messages.map((message, index) => {
            const { showAvatar, showName } = shouldShowMeta(index);
            const isOwn = message.type === "user" && message.sender_id === currentUserId;

            return (
              <MessageItem
                key={message.id}
                message={message}
                members={members}
                isOwn={isOwn}
                showAvatar={showAvatar}
                showName={showName}
                onMentionClick={onMentionClick}
                onReply={onReply}
              />
            );
          })}

          {/* Typing indicator */}
          <TypingIndicator typingMembers={typingMembers} members={members} />

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-4 left-1/2 z-10 -translate-x-1/2",
            "flex items-center justify-center p-2",
            "bg-background border border-border rounded-full shadow-lg",
            "hover:bg-accent transition-all cursor-pointer",
            "animate-in fade-in slide-in-from-bottom-2 duration-200"
          )}
          title={t("chat.scrollToBottom", "Scroll to bottom")}
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
