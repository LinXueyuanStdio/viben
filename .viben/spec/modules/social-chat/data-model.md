# 数据模型设计

> Social Chat 模块的数据结构定义

---

## 1. 核心实体

### 1.1 实体关系图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Contact   │     │Conversation │     │   Message   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ id          │     │ id          │
│ type        │◀────│ type        │────▶│ conv_id     │
│ name        │     │ participants│     │ sender_id   │
│ avatar      │     │ name        │     │ type        │
│ ...         │     │ ...         │     │ content     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│    Agent    │     │ AgentTeam   │
├─────────────┤     ├─────────────┤
│ id          │     │ id          │
│ name        │     │ name        │
│ model       │     │ workflow    │
│ system_prompt│     │ nodes       │
│ ...         │     │ ...         │
└─────────────┘     └─────────────┘
```

---

## 2. 类型定义

### 2.1 联系人 (Contact)

```typescript
// apps/desktop/src/types/social-chat.ts

/**
 * 联系人类型
 */
export type ContactType = "agent" | "user" | "group" | "team";

/**
 * 联系人实体
 */
export interface Contact {
  id: string;
  type: ContactType;
  name: string;
  avatar?: string;
  description?: string;
  created_at: string;
  updated_at: string;

  // 根据类型的特定字段
  agent?: AgentInfo;      // type === "agent"
  user?: UserInfo;        // type === "user"
  group?: GroupInfo;      // type === "group"
  team?: TeamInfo;        // type === "team"
}

/**
 * 智能体信息
 */
export interface AgentInfo {
  model: string;
  system_prompt: string;
  capabilities: AgentCapability[];
  temperature?: number;
  max_tokens?: number;
}

export type AgentCapability =
  | "web_search"
  | "code_execution"
  | "file_access"
  | "image_generation";

/**
 * 用户信息
 */
export interface UserInfo {
  email?: string;
  online_status: "online" | "offline" | "away";
  last_seen_at?: string;
}

/**
 * 群聊信息
 */
export interface GroupInfo {
  member_count: number;
  owner_id: string;
  admins: string[];
  announcement?: string;
}

/**
 * 智能体团队信息
 */
export interface TeamInfo {
  node_count: number;
  last_execution_at?: string;
  execution_count: number;
}
```

### 2.2 对话 (Conversation)

```typescript
/**
 * 对话类型
 */
export type ConversationType =
  | "agent"      // 与智能体一对一
  | "private"    // 与用户私聊
  | "group"      // 群聊
  | "workspace"; // Workspace 上下文

/**
 * 对话实体
 */
export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  avatar?: string;

  // 参与者
  participants: ConversationParticipant[];

  // 状态
  is_pinned: boolean;
  is_muted: boolean;
  unread_count: number;

  // 最新消息预览
  last_message?: MessagePreview;

  // 元数据
  created_at: string;
  updated_at: string;

  // 特定类型的附加数据
  workspace_id?: string;  // type === "workspace"
  group_settings?: GroupSettings;
}

export interface ConversationParticipant {
  contact_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  nickname?: string;  // 群昵称
}

export interface GroupSettings {
  allow_invite: boolean;
  show_member_nickname: boolean;
  announcement?: string;
}

export interface MessagePreview {
  id: string;
  sender_name: string;
  content: string;
  timestamp: string;
}
```

### 2.3 消息 (Message)

```typescript
/**
 * 消息类型
 */
export type SocialMessageType =
  | "text"           // 文本消息
  | "image"          // 图片消息
  | "file"           // 文件消息
  | "code"           // 代码消息
  | "agent_response" // 智能体响应
  | "tool_use"       // 工具调用
  | "tool_result"    // 工具结果
  | "system";        // 系统消息

/**
 * 消息实体
 */
export interface SocialMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: "user" | "agent" | "system";

  type: SocialMessageType;
  content: string;

  // 附件
  attachments?: MessageAttachment[];

  // @提及
  mentions?: MessageMention[];

  // 引用回复
  reply_to?: string;

  // 状态
  status: "sending" | "sent" | "delivered" | "read" | "failed";

  // 时间
  created_at: string;
  updated_at?: string;

  // 智能体特定
  agent_metadata?: AgentMessageMetadata;
}

export interface MessageAttachment {
  id: string;
  type: "image" | "file" | "code";
  name: string;
  size?: number;
  url?: string;
  mime_type?: string;

  // 代码附件
  language?: string;
  code?: string;
}

export interface MessageMention {
  contact_id: string;
  contact_type: "user" | "agent";
  start_index: number;
  end_index: number;
}

export interface AgentMessageMetadata {
  model: string;
  tokens_used?: number;
  tool_calls?: ToolCallInfo[];
  thinking_time_ms?: number;
}

export interface ToolCallInfo {
  tool_name: string;
  input: Record<string, unknown>;
  output?: string;
  duration_ms?: number;
}
```

### 2.4 智能体团队 (AgentTeam)

```typescript
/**
 * 智能体团队（工作流）
 */
export interface AgentTeam {
  id: string;
  name: string;
  description?: string;
  avatar?: string;

  // 工作流定义
  workflow: Workflow;

  // 统计
  execution_count: number;
  success_count: number;
  last_execution_at?: string;

  // 元数据
  created_at: string;
  updated_at: string;
}

/**
 * 工作流定义
 */
export interface Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

/**
 * 工作流节点类型
 */
export type WorkflowNodeType =
  | "trigger"   // 触发器
  | "agent"     // 智能体
  | "condition" // 条件分支
  | "loop"      // 循环
  | "parallel"  // 并行
  | "merge"     // 合并
  | "http"      // HTTP 请求
  | "code"      // 代码执行
  | "transform" // 数据转换
  | "output";   // 输出

/**
 * 工作流节点
 */
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export type WorkflowNodeData =
  | TriggerNodeData
  | AgentNodeData
  | ConditionNodeData
  | LoopNodeData
  | HttpNodeData
  | CodeNodeData
  | OutputNodeData;

export interface TriggerNodeData {
  type: "trigger";
  trigger_type: "manual" | "cron" | "webhook" | "event";
  config: Record<string, unknown>;
}

export interface AgentNodeData {
  type: "agent";
  agent_id: string;
  input_template: string;
  output_format: "text" | "json" | "custom";
  output_schema?: Record<string, unknown>;
}

export interface ConditionNodeData {
  type: "condition";
  expression: string;  // e.g., "{{input.score}} > 80"
}

export interface LoopNodeData {
  type: "loop";
  iterator: string;  // e.g., "{{input.items}}"
  max_iterations?: number;
}

export interface HttpNodeData {
  type: "http";
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface CodeNodeData {
  type: "code";
  language: "javascript" | "python";
  code: string;
}

export interface OutputNodeData {
  type: "output";
  output_type: "message" | "file" | "api";
  config: Record<string, unknown>;
}

/**
 * 工作流边（连接）
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  source_handle?: string;  // 用于条件节点的 true/false 分支
  target_handle?: string;
}

/**
 * 工作流执行记录
 */
export interface WorkflowExecution {
  id: string;
  team_id: string;
  status: "running" | "completed" | "failed" | "cancelled";

  // 触发信息
  trigger_type: string;
  trigger_data?: Record<string, unknown>;

  // 执行结果
  node_results: NodeExecutionResult[];
  output?: unknown;
  error?: string;

  // 时间
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

export interface NodeExecutionResult {
  node_id: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}
```

---

## 3. 数据库 Schema

### 3.1 SQLite Schema (Desktop)

```sql
-- 联系人表
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('agent', 'user', 'group', 'team')),
  name TEXT NOT NULL,
  avatar TEXT,
  description TEXT,
  metadata TEXT,  -- JSON: AgentInfo | UserInfo | GroupInfo | TeamInfo
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_contacts_type ON contacts(type);

-- 对话表
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('agent', 'private', 'group', 'workspace')),
  name TEXT NOT NULL,
  avatar TEXT,
  workspace_id TEXT,

  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_muted INTEGER NOT NULL DEFAULT 0,
  unread_count INTEGER NOT NULL DEFAULT 0,

  last_message_id TEXT,
  last_message_preview TEXT,
  last_message_at TEXT,

  settings TEXT,  -- JSON: GroupSettings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_pinned ON conversations(is_pinned, updated_at);

-- 对话参与者表
CREATE TABLE conversation_participants (
  conversation_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  nickname TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (conversation_id, contact_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- 消息表
CREATE TABLE social_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),

  type TEXT NOT NULL,
  content TEXT NOT NULL,

  attachments TEXT,  -- JSON: MessageAttachment[]
  mentions TEXT,     -- JSON: MessageMention[]
  reply_to TEXT,

  status TEXT NOT NULL DEFAULT 'sent',
  agent_metadata TEXT,  -- JSON: AgentMessageMetadata

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX idx_messages_conversation ON social_messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON social_messages(sender_id);

-- 智能体团队表
CREATE TABLE agent_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,

  workflow TEXT NOT NULL,  -- JSON: Workflow

  execution_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_execution_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 工作流执行记录表
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

  trigger_type TEXT NOT NULL,
  trigger_data TEXT,  -- JSON

  node_results TEXT,  -- JSON: NodeExecutionResult[]
  output TEXT,        -- JSON
  error TEXT,

  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  duration_ms INTEGER,

  FOREIGN KEY (team_id) REFERENCES agent_teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_executions_team ON workflow_executions(team_id, started_at);
```

---

## 4. Store 定义

### 4.1 Social Chat Store

```typescript
// apps/desktop/src/stores/social-chat-store.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SocialChatState {
  // 联系人
  contacts: Contact[];
  contactsLoading: boolean;

  // 对话
  conversations: Conversation[];
  activeConversationId: string | null;
  conversationsLoading: boolean;

  // 消息
  messages: Record<string, SocialMessage[]>;  // conversationId -> messages
  messagesLoading: boolean;

  // 智能体团队
  teams: AgentTeam[];
  teamsLoading: boolean;

  // 分组折叠状态
  collapsedGroups: {
    agents: boolean;
    groups: boolean;
    teams: boolean;
  };
}

interface SocialChatActions {
  // 联系人
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;

  // 对话
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  createConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  pinConversation: (id: string, pinned: boolean) => void;
  muteConversation: (id: string, muted: boolean) => void;
  markAsRead: (id: string) => void;

  // 消息
  setMessages: (conversationId: string, messages: SocialMessage[]) => void;
  addMessage: (conversationId: string, message: SocialMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<SocialMessage>) => void;

  // 智能体团队
  setTeams: (teams: AgentTeam[]) => void;
  addTeam: (team: AgentTeam) => void;
  updateTeam: (id: string, updates: Partial<AgentTeam>) => void;
  deleteTeam: (id: string) => void;

  // UI 状态
  toggleGroup: (group: "agents" | "groups" | "teams") => void;

  // Getters
  getConversation: (id: string) => Conversation | undefined;
  getContact: (id: string) => Contact | undefined;
  getAgents: () => Contact[];
  getGroups: () => Contact[];
  getTeams: () => AgentTeam[];
  getSortedConversations: () => Conversation[];
}

export const useSocialChatStore = create<SocialChatState & SocialChatActions>()(
  persist(
    (set, get) => ({
      // Initial state
      contacts: [],
      contactsLoading: false,
      conversations: [],
      activeConversationId: null,
      conversationsLoading: false,
      messages: {},
      messagesLoading: false,
      teams: [],
      teamsLoading: false,
      collapsedGroups: {
        agents: false,
        groups: false,
        teams: false,
      },

      // Actions
      setContacts: (contacts) => set({ contacts }),

      addContact: (contact) => set((state) => ({
        contacts: [...state.contacts, contact],
      })),

      updateContact: (id, updates) => set((state) => ({
        contacts: state.contacts.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),

      deleteContact: (id) => set((state) => ({
        contacts: state.contacts.filter((c) => c.id !== id),
      })),

      setConversations: (conversations) => set({ conversations }),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      createConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations],
      })),

      updateConversation: (id, updates) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
        ),
      })),

      deleteConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId:
          state.activeConversationId === id ? null : state.activeConversationId,
      })),

      pinConversation: (id, pinned) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, is_pinned: pinned } : c
        ),
      })),

      muteConversation: (id, muted) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, is_muted: muted } : c
        ),
      })),

      markAsRead: (id) => set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unread_count: 0 } : c
        ),
      })),

      setMessages: (conversationId, messages) => set((state) => ({
        messages: { ...state.messages, [conversationId]: messages },
      })),

      addMessage: (conversationId, message) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...(state.messages[conversationId] || []), message],
        },
      })),

      updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        },
      })),

      setTeams: (teams) => set({ teams }),

      addTeam: (team) => set((state) => ({
        teams: [...state.teams, team],
      })),

      updateTeam: (id, updates) => set((state) => ({
        teams: state.teams.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),

      deleteTeam: (id) => set((state) => ({
        teams: state.teams.filter((t) => t.id !== id),
      })),

      toggleGroup: (group) => set((state) => ({
        collapsedGroups: {
          ...state.collapsedGroups,
          [group]: !state.collapsedGroups[group],
        },
      })),

      // Getters
      getConversation: (id) => get().conversations.find((c) => c.id === id),

      getContact: (id) => get().contacts.find((c) => c.id === id),

      getAgents: () => get().contacts.filter((c) => c.type === "agent"),

      getGroups: () => get().contacts.filter((c) => c.type === "group"),

      getTeams: () => get().teams,

      getSortedConversations: () => {
        const conversations = get().conversations;
        const pinned = conversations
          .filter((c) => c.is_pinned)
          .sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        const unpinned = conversations
          .filter((c) => !c.is_pinned)
          .sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        return [...pinned, ...unpinned];
      },
    }),
    {
      name: "social-chat-storage",
      partialize: (state) => ({
        activeConversationId: state.activeConversationId,
        collapsedGroups: state.collapsedGroups,
      }),
    }
  )
);
```

---

## 5. 与现有系统的映射

### 5.1 与 Agent 系统集成

```typescript
// 从现有 Agent 转换为 Contact
function agentToContact(agent: LocalAgent): Contact {
  return {
    id: agent.id,
    type: "agent",
    name: agent.name,
    avatar: agent.avatar,
    description: agent.description,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    agent: {
      model: agent.model,
      system_prompt: agent.system_prompt,
      capabilities: agent.capabilities || [],
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
    },
  };
}
```

### 5.2 与 Workspace Chat 集成

```typescript
// Workspace 对话类型
interface WorkspaceConversation extends Conversation {
  type: "workspace";
  workspace_id: string;
  // 使用现有的 useAgent hook 处理消息
}

// 复用现有消息组件
// - MessageList
// - MessageItem
// - AgentChatInput (带模型选择)
```

---

## 6. 迁移说明

### 6.1 现有数据迁移

```sql
-- 从现有 tasks/messages 迁移到新的社交消息系统
-- 1. 为每个有 task 的 session 创建对应的 conversation
-- 2. 将 message 迁移到 social_messages

INSERT INTO conversations (id, type, name, workspace_id, created_at, updated_at)
SELECT
  s.id,
  'workspace',
  COALESCE(w.name, 'Workspace Chat'),
  s.workspace_id,
  s.created_at,
  s.updated_at
FROM sessions s
LEFT JOIN workspaces w ON s.workspace_id = w.id;
```

### 6.2 渐进式迁移策略

1. **Phase 1**: 新建 social_messages 表，保持原有 messages 表不变
2. **Phase 2**: 新消息写入两个表（双写）
3. **Phase 3**: 读取切换到新表
4. **Phase 4**: 历史数据迁移
5. **Phase 5**: 下线旧表
