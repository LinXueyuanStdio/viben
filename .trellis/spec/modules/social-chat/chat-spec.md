# 聊天功能开发规范

> 开发规范：Desktop 聊天页面实现指南

---

## 1. 文件结构

```
apps/desktop/src/
├── pages/
│   └── social-chat.tsx              # 聊天主页面
├── components/
│   └── social-chat/
│       ├── index.ts                 # 导出入口
│       ├── conversation-list.tsx    # 对话列表
│       ├── conversation-item.tsx    # 对话列表项
│       ├── conversation-panel.tsx   # 对话面板（右侧）
│       ├── conversation-header.tsx  # 对话标题栏
│       ├── social-message-list.tsx  # 消息列表
│       ├── social-message-item.tsx  # 消息项
│       ├── search-bar.tsx           # 搜索框
│       └── context-menu.tsx         # 右键菜单
├── hooks/
│   └── use-social-chat.ts           # 聊天业务逻辑 Hook
├── stores/
│   └── social-chat-store.ts         # Zustand Store（见 data-model.md）
└── types/
    └── social-chat.ts               # 类型定义（见 data-model.md）
```

---

## 2. 主页面实现

### 2.1 页面布局

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
      {/* 左侧对话列表 */}
      <div
        className="flex-shrink-0 border-r border-border"
        style={{ width: listWidth }}
      >
        <ConversationList
          onSelect={setActiveConversation}
          activeId={activeConversationId}
        />
      </div>

      {/* 右侧对话面板 */}
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
      <p>选择一个对话开始聊天</p>
    </div>
  );
}
```

### 2.2 响应式处理

```tsx
// 使用 useMediaQuery 处理响应式
import { useMediaQuery } from "@/hooks/use-media-query";

export default function SocialChatPage() {
  const isMobile = useMediaQuery("(max-width: 800px)");
  const { activeConversationId, setActiveConversation } = useSocialChatStore();

  // 移动端：单栏模式
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

  // 桌面端：双栏模式
  return (
    <div className="flex h-full">
      {/* ... 同上 */}
    </div>
  );
}
```

---

## 3. 对话列表组件

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

  // 过滤搜索结果
  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // 分组：置顶 + 普通
  const pinned = filteredConversations.filter((c) => c.is_pinned);
  const unpinned = filteredConversations.filter((c) => !c.is_pinned);

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 对话列表 */}
      <ScrollArea className="flex-1">
        {/* 置顶对话 */}
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

        {/* 分隔线 */}
        {pinned.length > 0 && unpinned.length > 0 && (
          <div className="h-px bg-border mx-3" />
        )}

        {/* 普通对话 */}
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

        {/* 空状态 */}
        {filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>暂无对话</p>
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
    // TODO: 添加确认对话框
    deleteConversation(conversation.id);
  }, [conversation.id, deleteConversation]);

  const handleMarkAsRead = useCallback(() => {
    markAsRead(conversation.id);
  }, [conversation.id, markAsRead]);

  // 对话类型图标
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
          {/* 头像 */}
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={conversation.avatar} />
            <AvatarFallback>
              {typeIcon}
            </AvatarFallback>
          </Avatar>

          {/* 内容 */}
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
                {conversation.last_message?.content || "暂无消息"}
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
          {conversation.is_pinned ? "取消置顶" : "置顶"}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMute}>
          <BellOff className="w-4 h-4 mr-2" />
          {conversation.is_muted ? "取消静音" : "静音"}
        </ContextMenuItem>
        {conversation.unread_count > 0 && (
          <ContextMenuItem onClick={handleMarkAsRead}>
            <Check className="w-4 h-4 mr-2" />
            标记为已读
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          删除对话
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

## 4. 对话面板组件

### 4.1 ConversationPanel

```tsx
// apps/desktop/src/components/social-chat/conversation-panel.tsx

import { useCallback } from "react";
import { ConversationHeader } from "./conversation-header";
import { SocialMessageList } from "./social-message-list";
import { useSocialChat } from "@/hooks/use-social-chat";
import { useSocialChatStore } from "@/stores/social-chat-store";

// 复用现有的 ChatInput 组件
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
    return <div>对话不存在</div>;
  }

  // 根据对话类型选择输入组件
  const InputComponent =
    conversation.type === "agent" ? AgentChatInput : ChatInput;

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <ConversationHeader
        conversation={conversation}
        onBack={onBack}
        showBackButton={showBackButton}
      />

      {/* 消息列表 */}
      <div className="flex-1 overflow-hidden">
        <SocialMessageList
          messages={conversationMessages}
          conversationType={conversation.type}
          participants={participants}
        />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-border">
        {conversation.type === "agent" ? (
          <AgentChatInput
            onSend={handleSend}
            isLoading={isLoading}
            // 智能体特定 props
          />
        ) : (
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            placeholder={
              conversation.type === "group"
                ? "输入消息，@智能体 可触发响应..."
                : "输入消息..."
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
  // 副标题
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
              邀请成员
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>
            <Settings className="w-4 h-4 mr-2" />
            设置
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            {conversation.type === "group" ? "退出群聊" : "删除对话"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getSubtitle(conversation: Conversation): string | null {
  switch (conversation.type) {
    case "agent":
      // 显示模型信息
      return "Claude 3.5 Sonnet";  // TODO: 从 agent 信息获取
    case "group":
      return `${conversation.participants.length} 位成员`;
    case "workspace":
      return "工作空间对话";
    default:
      return null;
  }
}
```

---

## 5. 消息列表组件

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

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 按时间分组，插入日期分隔
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <ScrollArea ref={scrollRef} className="h-full">
      <div className="flex flex-col gap-2 p-4">
        {groupedMessages.map((group, groupIndex) => (
          <div key={group.date}>
            {/* 日期分隔 */}
            <div className="flex justify-center my-4">
              <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                {formatDate(group.date)}
              </span>
            </div>

            {/* 消息列表 */}
            {group.messages.map((message, messageIndex) => {
              const prevMessage = messageIndex > 0
                ? group.messages[messageIndex - 1]
                : groupIndex > 0
                  ? groupedMessages[groupIndex - 1].messages.slice(-1)[0]
                  : null;

              // 是否显示时间戳（超过 5 分钟）
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

  // 超过 5 分钟显示时间
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

// 复用现有的消息渲染组件
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

  // 系统消息
  if (isSystemMessage) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 text-xs text-muted-foreground bg-muted/50 rounded">
          {message.content}
        </span>
      </div>
    );
  }

  // 获取发送者信息
  const sender = participants.find((p) => p.contact_id === message.sender_id);

  return (
    <div
      className={cn(
        "flex gap-2",
        isOwnMessage ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* 头像 - 非自己的消息显示 */}
      {!isOwnMessage && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback>
            {message.sender_type === "agent" ? "🤖" : "👤"}
          </AvatarFallback>
        </Avatar>
      )}

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col max-w-[70%]",
          isOwnMessage ? "items-end" : "items-start"
        )}
      >
        {/* 发送者名称 - 群聊中显示 */}
        {conversationType === "group" && !isOwnMessage && sender && (
          <span className="text-xs text-muted-foreground mb-1">
            {sender.nickname || message.sender_id}
          </span>
        )}

        {/* 消息气泡 */}
        <div
          className={cn(
            "rounded-lg px-3 py-2",
            isOwnMessage
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {/* 根据消息类型渲染 */}
          {renderMessageContent(message)}
        </div>

        {/* 时间戳 */}
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

## 6. 业务逻辑 Hook

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

  // 对于智能体对话，复用现有的 useAgent hook
  const agentHook = conversation?.type === "agent" ? useAgent() : null;

  const [isLoading, setIsLoading] = useState(false);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      if (!conversation) return;

      // 创建用户消息
      const userMessage: SocialMessage = {
        id: nanoid(),
        conversation_id: conversationId,
        sender_id: "current-user", // TODO: 从 auth store 获取
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
        // 根据对话类型处理
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

        // 更新对话的最后消息
        updateConversation(conversationId, {
          last_message: {
            id: userMessage.id,
            sender_name: "我",
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

  // 处理智能体消息
  const handleAgentMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    if (!agentHook) return;

    // 使用现有的 agent hook 发送消息
    await agentHook.sendMessage(content, attachments);

    // 监听 agent 响应并转换为 SocialMessage
    // ... 处理 agentHook.messages 的变化
  };

  // 处理群聊消息 - 检测 @提及
  const handleGroupMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    // 解析 @提及
    const mentions = parseMentions(content);

    // 如果提及了智能体，触发智能体响应
    for (const mention of mentions) {
      if (mention.contact_type === "agent") {
        await triggerAgentInGroup(mention.contact_id, content);
      }
    }
  };

  // 触发群内智能体响应
  const triggerAgentInGroup = async (agentId: string, context: string) => {
    // TODO: 调用智能体 API，传入群聊上下文
    const agentResponse: SocialMessage = {
      id: nanoid(),
      conversation_id: conversationId,
      sender_id: agentId,
      sender_type: "agent",
      type: "agent_response",
      content: "智能体响应...", // 实际从 API 获取
      status: "sent",
      created_at: new Date().toISOString(),
    };

    addMessage(conversationId, agentResponse);
  };

  // 处理私聊消息
  const handlePrivateMessage = async (
    content: string,
    attachments?: MessageAttachment[]
  ) => {
    // TODO: 发送到服务器 / P2P
  };

  // 处理 Workspace 消息 - 复用现有逻辑
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

// 解析 @提及
function parseMentions(content: string) {
  const mentions: { contact_id: string; contact_type: "user" | "agent" }[] = [];
  const regex = /@(\w+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // TODO: 根据名称查找联系人
    mentions.push({
      contact_id: match[1],
      contact_type: "agent", // 需要实际查询
    });
  }

  return mentions;
}
```

---

## 7. 导航集成

### 7.1 侧边栏配置

```tsx
// apps/desktop/src/components/layout/sidebar.tsx

// 添加聊天和联系人导航项
const navigationItems = [
  {
    id: "chat",
    label: "聊天",
    icon: MessageSquare,
    href: "/chat",
  },
  {
    id: "contacts",
    label: "联系人",
    icon: Users,
    href: "/contacts",
  },
  // ... 其他导航项
];
```

### 7.2 路由配置

```tsx
// apps/desktop/src/App.tsx 或路由配置文件

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

## 8. 样式规范

### 8.1 颜色使用

```css
/* 遵循 Design System */
.message-own {
  /* 使用主题色 */
  @apply bg-primary text-primary-foreground;
}

.message-other {
  /* 使用 muted 背景 */
  @apply bg-muted text-foreground;
}

.unread-badge {
  /* 使用 destructive 颜色 */
  @apply bg-destructive text-destructive-foreground;
}
```

### 8.2 动画

```css
/* 消息出现动画 */
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

## 9. 测试要点

### 9.1 单元测试

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

### 9.2 集成测试

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

## 10. 性能优化

### 10.1 虚拟列表

对于大量消息，使用虚拟滚动：

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

### 10.2 消息分页加载

```typescript
// 加载更多历史消息
const loadMoreMessages = async (beforeMessageId: string) => {
  const olderMessages = await fetchMessages(conversationId, {
    before: beforeMessageId,
    limit: 50,
  });
  // 合并到现有消息
};
```
