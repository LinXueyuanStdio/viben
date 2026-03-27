---
sidebar_position: 3
title: Chat Feature Development Guide
description: Desktop Chat Page Implementation Guide
---

# Chat Feature Development Guide

> Development Guide: Desktop Chat Page Implementation Guide

---

## 1. File Structure

```
apps/desktop/src/
├── pages/
│   └── social-chat.tsx              # Main chat page
├── components/
│   └── social-chat/
│       ├── index.ts                 # Export entry
│       ├── conversation-list.tsx    # Conversation list
│       ├── conversation-item.tsx    # Conversation list item
│       ├── conversation-panel.tsx   # Conversation panel (right side)
│       ├── conversation-header.tsx  # Conversation header
│       ├── social-message-list.tsx  # Message list
│       ├── social-message-item.tsx  # Message item
│       ├── search-bar.tsx           # Search bar
│       └── context-menu.tsx         # Context menu
├── hooks/
│   └── use-social-chat.ts           # Chat business logic Hook
├── stores/
│   └── social-chat-store.ts         # Zustand Store (see data-model.md)
└── types/
    └── social-chat.ts               # Type definitions (see data-model.md)
```

---

## 2. Main Page Implementation

### 2.1 Page Layout

```tsx
// apps/desktop/src/pages/social-chat.tsx

import { useState } from "react";
import { ConversationList } from "@/components/social-chat/conversation-list";
import { ConversationPanel } from "@/components/social-chat/conversation-panel";
import { useSocialChatStore } from "@/stores/social-chat-store";

export default function SocialChatPage() {
  const { activeConversationId, setActiveConversation } = useSocialChatStore();
  const [listWidth] = useState(300);

  return (
    <div className="flex h-full">
      {/* Left conversation list */}
      <div
        className="flex-shrink-0 border-r border-border"
        style={{ width: listWidth }}
      >
        <ConversationList
          onSelect={setActiveConversation}
          activeId={activeConversationId}
        />
      </div>

      {/* Right conversation panel */}
      <div className="flex-1 min-w-0">
        {activeConversationId ? (
          <ConversationPanel conversationId={activeConversationId} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <MessageSquare className="w-12 h-12 mb-4" />
      <p>Select a conversation to start chatting</p>
    </div>
  );
}
```

### 2.2 Responsive Handling

```tsx
// Use useMediaQuery for responsive handling
import { useMediaQuery } from "@/hooks/use-media-query";

export default function SocialChatPage() {
  const isMobile = useMediaQuery("(max-width: 800px)");
  const { activeConversationId, setActiveConversation } = useSocialChatStore();

  // Mobile: Single column mode
  if (isMobile) {
    return activeConversationId ? (
      <ConversationPanel
        conversationId={activeConversationId}
        onBack={() => setActiveConversation(null)}
        showBackButton
      />
    ) : (
      <ConversationList onSelect={setActiveConversation} />
    );
  }

  // Desktop: Two column mode
  return (
    <div className="flex h-full">
      {/* ... same as above */}
    </div>
  );
}
```

---

## 3. Conversation List Components

### 3.1 ConversationList

```tsx
// apps/desktop/src/components/social-chat/conversation-list.tsx

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ConversationItem } from "./conversation-item";
import { useSocialChatStore } from "@/stores/social-chat-store";

interface ConversationListProps {
  onSelect: (id: string) => void;
  activeId: string | null;
}

export function ConversationList({ onSelect, activeId }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { getSortedConversations } = useSocialChatStore();

  const conversations = getSortedConversations();

  // Filter search results
  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Group: Pinned + Regular
  const pinned = filteredConversations.filter((c) => c.is_pinned);
  const unpinned = filteredConversations.filter((c) => !c.is_pinned);

  return (
    <div className="flex flex-col h-full">
      {/* Search box */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {/* Pinned conversations */}
        {pinned.length > 0 && (
          <div className="py-2">
            {pinned.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeId}
                onClick={() => onSelect(conversation.id)}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        {pinned.length > 0 && unpinned.length > 0 && (
          <div className="h-px bg-border mx-3" />
        )}

        {/* Regular conversations */}
        <div className="py-2">
          {unpinned.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeId}
              onClick={() => onSelect(conversation.id)}
            />
          ))}
        </div>

        {/* Empty state */}
        {filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>No conversations</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

### 3.2 ConversationItem

```tsx
// apps/desktop/src/components/social-chat/conversation-item.tsx

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Pin, BellOff, Trash2, Check } from "lucide-react";
import { Conversation } from "@/types/social-chat";
import { useSocialChatStore } from "@/stores/social-chat-store";
import { formatRelativeTime } from "@/lib/utils";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const {
    pinConversation,
    muteConversation,
    deleteConversation,
    markAsRead,
  } = useSocialChatStore();

  const handlePin = useCallback(() => {
    pinConversation(conversation.id, !conversation.is_pinned);
  }, [conversation.id, conversation.is_pinned, pinConversation]);

  const handleMute = useCallback(() => {
    muteConversation(conversation.id, !conversation.is_muted);
  }, [conversation.id, conversation.is_muted, muteConversation]);

  const handleDelete = useCallback(() => {
    // TODO: Add confirmation dialog
    deleteConversation(conversation.id);
  }, [conversation.id, deleteConversation]);

  const handleMarkAsRead = useCallback(() => {
    markAsRead(conversation.id);
  }, [conversation.id, markAsRead]);

  // Conversation type icon
  const typeIcon = getConversationTypeIcon(conversation.type);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
            "hover:bg-accent/50",
            isActive && "bg-accent"
          )}
          onClick={onClick}
        >
          {/* Avatar */}
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={conversation.avatar} />
            <AvatarFallback>
              {typeIcon}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{conversation.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {conversation.last_message &&
                  formatRelativeTime(conversation.last_message.timestamp)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-sm text-muted-foreground truncate">
                {conversation.last_message?.content || "No messages"}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {conversation.is_pinned && (
                  <Pin className="w-3 h-3 text-muted-foreground" />
                )}
                {conversation.is_muted && (
                  <BellOff className="w-3 h-3 text-muted-foreground" />
                )}
                {conversation.unread_count > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5">
                    {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={handlePin}>
          <Pin className="w-4 h-4 mr-2" />
          {conversation.is_pinned ? "Unpin" : "Pin"}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMute}>
          <BellOff className="w-4 h-4 mr-2" />
          {conversation.is_muted ? "Unmute" : "Mute"}
        </ContextMenuItem>
        {conversation.unread_count > 0 && (
          <ContextMenuItem onClick={handleMarkAsRead}>
            <Check className="w-4 h-4 mr-2" />
            Mark as read
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete conversation
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function getConversationTypeIcon(type: Conversation["type"]) {
  switch (type) {
    case "agent":
      return "🤖";
    case "private":
      return "👤";
    case "group":
      return "👥";
    case "workspace":
      return "📁";
  }
}
```

---

## 4. Conversation Panel Components

### 4.1 ConversationPanel

```tsx
// apps/desktop/src/components/social-chat/conversation-panel.tsx

import { useCallback } from "react";
import { ConversationHeader } from "./conversation-header";
import { SocialMessageList } from "./social-message-list";
import { useSocialChat } from "@/hooks/use-social-chat";
import { useSocialChatStore } from "@/stores/social-chat-store";

// Reuse existing ChatInput component
import { ChatInput } from "@/components/chat/chat-input";
import { AgentChatInput } from "@/components/chat/agent-chat-input";

interface ConversationPanelProps {
  conversationId: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ConversationPanel({
  conversationId,
  onBack,
  showBackButton,
}: ConversationPanelProps) {
  const { getConversation, messages } = useSocialChatStore();
  const conversation = getConversation(conversationId);
  const conversationMessages = messages[conversationId] || [];

  const {
    sendMessage,
    isLoading,
    agentPhase,
    participants,
  } = useSocialChat(conversationId);

  const handleSend = useCallback(
    (content: string, attachments?: MessageAttachment[]) => {
      sendMessage(content, attachments);
    },
    [sendMessage]
  );

  if (!conversation) {
    return <div>Conversation not found</div>;
  }

  // Select input component based on conversation type
  const InputComponent =
    conversation.type === "agent" ? AgentChatInput : ChatInput;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ConversationHeader
        conversation={conversation}
        onBack={onBack}
        showBackButton={showBackButton}
      />

      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <SocialMessageList
          messages={conversationMessages}
          conversationType={conversation.type}
          participants={participants}
        />
      </div>

      {/* Input area */}
      <div className="border-t border-border">
        {conversation.type === "agent" ? (
          <AgentChatInput
            onSend={handleSend}
            isLoading={isLoading}
            // Agent-specific props
          />
        ) : (
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            placeholder={
              conversation.type === "group"
                ? "Type a message, @agent to trigger response..."
                : "Type a message..."
            }
          />
        )}
      </div>
    </div>
  );
}
```

### 4.2 ConversationHeader

```tsx
// apps/desktop/src/components/social-chat/conversation-header.tsx

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreVertical, UserPlus, Settings, Trash2 } from "lucide-react";
import { Conversation } from "@/types/social-chat";

interface ConversationHeaderProps {
  conversation: Conversation;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ConversationHeader({
  conversation,
  onBack,
  showBackButton,
}: ConversationHeaderProps) {
  // Subtitle
  const subtitle = getSubtitle(conversation);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}

        <Avatar className="w-10 h-10">
          <AvatarImage src={conversation.avatar} />
          <AvatarFallback>
            {getConversationTypeIcon(conversation.type)}
          </AvatarFallback>
        </Avatar>

        <div>
          <h2 className="font-medium">{conversation.name}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {conversation.type === "group" && (
            <DropdownMenuItem>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite members
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            {conversation.type === "group" ? "Leave group" : "Delete conversation"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getSubtitle(conversation: Conversation): string | null {
  switch (conversation.type) {
    case "agent":
      // Display model information
      return "Claude 3.5 Sonnet";  // TODO: Get from agent info
    case "group":
      return `${conversation.participants.length} members`;
    case "workspace":
      return "Workspace conversation";
    default:
      return null;
  }
}
```

---

## 5. Message List Components

### 5.1 SocialMessageList

```tsx
// apps/desktop/src/components/social-chat/social-message-list.tsx

import { useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SocialMessageItem } from "./social-message-item";
import { SocialMessage, ConversationType, ConversationParticipant } from "@/types/social-chat";
import { formatDate, isSameDay } from "@/lib/utils";

interface SocialMessageListProps {
  messages: SocialMessage[];
  conversationType: ConversationType;
  participants: ConversationParticipant[];
}

export function SocialMessageList({
  messages,
  conversationType,
  participants,
}: SocialMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Group by time, insert date separators
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <ScrollArea ref={scrollRef} className="h-full">
      <div className="flex flex-col gap-2 p-4">
        {groupedMessages.map((group, groupIndex) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex justify-center my-4">
              <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                {formatDate(group.date)}
              </span>
            </div>

            {/* Message list */}
            {group.messages.map((message, messageIndex) => {
              const prevMessage = messageIndex > 0
                ? group.messages[messageIndex - 1]
                : groupIndex > 0
                  ? groupedMessages[groupIndex - 1].messages.slice(-1)[0]
                  : null;

              // Whether to show timestamp (over 5 minutes)
              const showTimestamp = shouldShowTimestamp(message, prevMessage);

              return (
                <SocialMessageItem
                  key={message.id}
                  message={message}
                  showTimestamp={showTimestamp}
                  conversationType={conversationType}
                  participants={participants}
                />
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

function groupMessagesByDate(messages: SocialMessage[]) {
  const groups: { date: string; messages: SocialMessage[] }[] = [];

  messages.forEach((message) => {
    const date = message.created_at.split("T")[0];
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ date, messages: [message] });
    }
  });

  return groups;
}

function shouldShowTimestamp(
  current: SocialMessage,
  prev: SocialMessage | null
): boolean {
  if (!prev) return true;

  const currentTime = new Date(current.created_at).getTime();
  const prevTime = new Date(prev.created_at).getTime();

  // Show time if over 5 minutes
  return currentTime - prevTime > 5 * 60 * 1000;
}
```

### 5.2 SocialMessageItem

```tsx
// apps/desktop/src/components/social-chat/social-message-item.tsx

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SocialMessage, ConversationType, ConversationParticipant } from "@/types/social-chat";
import { formatTime } from "@/lib/utils";

// Reuse existing message rendering components
import { MessageContent } from "@/components/chat/message-content";
import { ToolExecutionItem } from "@/components/chat/tool-execution-item";

interface SocialMessageItemProps {
  message: SocialMessage;
  showTimestamp: boolean;
  conversationType: ConversationType;
  participants: ConversationParticipant[];
}

export function SocialMessageItem({
  message,
  showTimestamp,
  conversationType,
  participants,
}: SocialMessageItemProps) {
  const isOwnMessage = message.sender_type === "user";
  const isSystemMessage = message.sender_type === "system";

  // System message
  if (isSystemMessage) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 text-xs text-muted-foreground bg-muted/50 rounded">
          {message.content}
        </span>
      </div>
    );
  }

  // Get sender info
  const sender = participants.find((p) => p.contact_id === message.sender_id);

  return (
    <div
      className={cn(
        "flex gap-2",
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar - show for messages from others */}
      {!isOwnMessage && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback>
            {message.sender_type === "agent" ? "🤖" : "👤"}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex flex-col max-w-[70%]",
          isOwnMessage ? "items-end" : "items-start"
        )}
      >
        {/* Sender name - show in group chats */}
        {conversationType === "group" && !isOwnMessage && sender && (
          <span className="text-xs text-muted-foreground mb-1">
            {sender.nickname || message.sender_id}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2",
            isOwnMessage
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {/* Render based on message type */}
          {renderMessageContent(message)}
        </div>

        {/* Timestamp */}
        {showTimestamp && (
          <span className="text-xs text-muted-foreground mt-1">
            {formatTime(message.created_at)}
            {isOwnMessage && (
              <span className="ml-1">
                {message.status === "sent" ? "✓" : ""}
                {message.status === "delivered" ? "✓✓" : ""}
                {message.status === "read" ? "✓✓" : ""}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function renderMessageContent(message: SocialMessage) {
  switch (message.type) {
    case "text":
    case "agent_response":
      return <MessageContent content={message.content} />;

    case "image":
      return (
        <img
          src={message.attachments?.[0]?.url}
          alt=""
          className="max-w-full rounded"
        />
      );

    case "file":
      return (
        <div className="flex items-center gap-2">
          <FileIcon className="w-8 h-8" />
          <div>
            <p className="font-medium">{message.attachments?.[0]?.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(message.attachments?.[0]?.size || 0)}
            </p>
          </div>
        </div>
      );

    case "code":
      return (
        <pre className="text-sm overflow-x-auto">
          <code>{message.content}</code>
        </pre>
      );

    case "tool_use":
    case "tool_result":
      return (
        <ToolExecutionItem
          name={message.agent_metadata?.tool_calls?.[0]?.tool_name || ""}
          input={message.agent_metadata?.tool_calls?.[0]?.input}
          output={message.agent_metadata?.tool_calls?.[0]?.output}
        />
      );

    default:
      return <p>{message.content}</p>;
  }
}
```

---

## 6. Business Logic Hook

### 6.1 useSocialChat

```tsx
// apps/desktop/src/hooks/use-social-chat.ts

import { useState, useCallback, useEffect } from "react";
import { nanoid } from "nanoid";
import { useSocialChatStore } from "@/stores/social-chat-store";
import { useAgent } from "@/hooks/use-agent";
import { SocialMessage, MessageAttachment, Conversation } from "@/types/social-chat";

export function useSocialChat(conversationId: string) {
  const {
    getConversation,
    messages,
    addMessage,
    updateMessage,
    updateConversation,
  } = useSocialChatStore();

  const conversation = getConversation(conversationId);
  const conversationMessages = messages[conversationId] || [];

  // For agent conversations, reuse existing useAgent hook
  const agentHook = conversation?.type === "agent" ? useAgent() : null;

  const [isLoading, setIsLoading] = useState(false);

  // Send message
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      if (!conversation) return;

      // Create user message
      const userMessage: SocialMessage = {
        id: nanoid(),
        conversation_id: conversationId,
        sender_id: "current-user", // TODO: Get from auth store
        sender_type: "user",
        type: "text",
        content,
        attachments,
        status: "sending",
        created_at: new Date().toISOString(),
      };

      addMessage(conversationId, userMessage);
      updateMessage(conversationId, userMessage.id, { status: "sent" });

      setIsLoading(true);

      try {
        // Handle based on conversation type
        switch (conversation.type) {
          case "agent":
            await handleAgentMessage(content, attachments);
            break;

          case "group":
            await handleGroupMessage(content, attachments);
            break;

          case "private":
            await handlePrivateMessage(content, attachments);
            break;

          case "workspace":
            await handleWorkspaceMessage(content, attachments);
            break;
        }

        // Update conversation's last message
        updateConversation(conversationId, {
          last_message: {
            id: userMessage.id,
            sender_name: "Me",
            content: content.slice(0, 50),
            timestamp: userMessage.created_at,
          },
        });
      } catch (error) {
        console.error("Failed to send message:", error);
        updateMessage(conversationId, userMessage.id, { status: "failed" });
      } finally {
        setIsLoading(false);
      }
    },
    [conversation, conversationId, addMessage, updateMessage, updateConversation]
  );

  // Handle agent message
  const handleAgentMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    if (!agentHook) return;

    // Use existing agent hook to send message
    await agentHook.sendMessage(content, attachments);

    // Listen to agent response and convert to SocialMessage
    // ... handle changes in agentHook.messages
  };

  // Handle group message - detect @mentions
  const handleGroupMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    // Parse @mentions
    const mentions = parseMentions(content);

    // If an agent is mentioned, trigger agent response
    for (const mention of mentions) {
      if (mention.contact_type === "agent") {
        await triggerAgentInGroup(mention.contact_id, content);
      }
    }
  };

  // Trigger agent response in group
  const triggerAgentInGroup = async (agentId: string, context: string) => {
    // TODO: Call agent API, pass group chat context
    const agentResponse: SocialMessage = {
      id: nanoid(),
      conversation_id: conversationId,
      sender_id: agentId,
      sender_type: "agent",
      type: "agent_response",
      content: "Agent response...", // Actually get from API
      status: "sent",
      created_at: new Date().toISOString(),
    };

    addMessage(conversationId, agentResponse);
  };

  // Handle private message
  const handlePrivateMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    // TODO: Send to server / P2P
  };

  // Handle Workspace message - reuse existing logic
  const handleWorkspaceMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    if (!agentHook) return;
    await agentHook.sendMessage(content, attachments);
  };

  return {
    conversation,
    messages: conversationMessages,
    sendMessage,
    isLoading,
    agentPhase: agentHook?.phase || "idle",
    participants: conversation?.participants || [],
  };
}

// Parse @mentions
function parseMentions(content: string) {
  const mentions: { contact_id: string; contact_type: "user" | "agent" }[] = [];
  const regex = /@(\w+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // TODO: Look up contact by name
    mentions.push({
      contact_id: match[1],
      contact_type: "agent", // Need actual query
    });
  }

  return mentions;
}
```

---

## 7. Navigation Integration

### 7.1 Sidebar Configuration

```tsx
// apps/desktop/src/components/layout/sidebar.tsx

// Add chat and contacts navigation items
const navigationItems = [
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    href: "/chat",
  },
  {
    id: "contacts",
    label: "Contacts",
    icon: Users,
    href: "/contacts",
  },
  // ... other navigation items
];
```

### 7.2 Route Configuration

```tsx
// apps/desktop/src/App.tsx or route configuration file

import SocialChatPage from "@/pages/social-chat";
import ContactsPage from "@/pages/contacts";

const routes = [
  {
    path: "/chat",
    element: <SocialChatPage />,
  },
  {
    path: "/contacts",
    element: <ContactsPage />,
  },
  // ...
];
```

---

## 8. Style Guidelines

### 8.1 Color Usage

```css
/* Follow Design System */
.message-own {
  /* Use theme color */
  @apply bg-primary text-primary-foreground;
}

.message-other {
  /* Use muted background */
  @apply bg-muted text-foreground;
}

.unread-badge {
  /* Use destructive color */
  @apply bg-destructive text-destructive-foreground;
}
```

### 8.2 Animations

```css
/* Message appearance animation */
.message-enter {
  animation: message-slide-in 0.2s ease-out;
}

@keyframes message-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 9. Testing Points

### 9.1 Unit Tests

```typescript
// __tests__/components/social-chat/conversation-item.test.tsx

describe("ConversationItem", () => {
  it("should display unread badge when unread_count > 0", () => {
    // ...
  });

  it("should show pin icon when is_pinned is true", () => {
    // ...
  });

  it("should truncate long message preview", () => {
    // ...
  });
});
```

### 9.2 Integration Tests

```typescript
// __tests__/hooks/use-social-chat.test.tsx

describe("useSocialChat", () => {
  it("should send message and update conversation", async () => {
    // ...
  });

  it("should trigger agent when @mentioned in group", async () => {
    // ...
  });
});
```

---

## 10. Performance Optimization

### 10.1 Virtual List

For large numbers of messages, use virtual scrolling:

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualMessageList({ messages }: { messages: SocialMessage[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  // ...
}
```

### 10.2 Message Pagination

```typescript
// Load more history messages
const loadMoreMessages = async (beforeMessageId: string) => {
  const olderMessages = await fetchMessages(conversationId, {
    before: beforeMessageId,
    limit: 50,
  });
  // Merge with existing messages
};
```
