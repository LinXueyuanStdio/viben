---
sidebar_position: 5
title: 聊天集成
description: 工作空间聊天页面集成规范（仅限桌面端）
---

# 聊天页面集成规范

> **目标**: 将 workany 风格的任务执行聊天页面集成到 viben 工作空间页面。
>
> **参考**: `/Users/lxy/Documents/GitHub/others/workany`
>
> **平台**: 仅限桌面端 (apps/desktop)

---

## 重要说明：平台边界

> **警告**: 聊天集成**仅限桌面端**，不应在 apps/web 中实现。
>
> **原因**: 桌面应用中的工作空间是**本地文件系统文件夹**，包含智能体配置（.claude/、.codex/ 等）。这与 Web 应用的"工作空间"概念有本质区别，后者是存储在数据库中的云端协作空间。
>
> 聊天功能需要：
> - 访问本地文件系统（用于工作文件、产物）
> - 本地智能体配置文件
> - Tauri 命令用于执行工具
> - SQLite 数据库用于消息持久化
>
> 这些在 Web 环境中都不可用。

---

## 概述

在工作空间详情页添加"对话"按钮，导航到用于 AI 智能体交互的聊天界面。聊天页面应该镜像 workany 的 TaskDetail 设计。

---

## UI 变更

### 1. 工作空间详情页 - 添加对话按钮

**位置**: `apps/desktop/src/pages/workspace-detail.tsx`

**位置**: 在头部操作区域（约第 239 行），与"刷新"和"移除"按钮并排。

```tsx
import { MessageSquare } from "lucide-react";

// 在头部操作区域：
<div className="flex items-center gap-2">
  {/* 新增：对话按钮 */}
  <Button
    variant="outline"
    size="sm"
    onClick={() => navigate(`/workspace/${workspaceId}/chat`)}
  >
    <MessageSquare className="h-4 w-4 mr-2" />
    {t("workspace.chat")}
  </Button>

  {/* 现有按钮 */}
  <Button variant="outline" size="sm" onClick={loadAgents}>
    ...
  </Button>
</div>
```

### 2. 新增聊天页面路由

**文件**: `apps/desktop/src/App.tsx`

```tsx
<Route path="workspace/:workspaceId/chat" element={<WorkspaceChatPage />} />
<Route path="workspace/:workspaceId/chat/:taskId" element={<WorkspaceChatPage />} />
```

---

## 聊天页面结构（来自 workany）

### 核心布局

```
+------------------------------------------------------------------+
|  头部: 返回 | 工作空间名称 | 运行指示器 | 操作                     |
+------------------------------------------------------------------+
|                                              |                    |
|  聊天消息区域（可滚动）                        |  右侧边栏          |
|    - 用户消息                                |    - 产物           |
|    - AI 文本响应                              |    - 工作空间       |
|    - 工具执行（可折叠）                        |    - MCP 工具       |
|    - 计划审批 UI                              |    - 技能           |
|    - 问题输入                                 |                    |
|                                              |                    |
+------------------------------------------------------------------+
|  回复输入: 文本区域 + 文件附加 + 发送/停止                          |
+------------------------------------------------------------------+
```

### 需要创建/移植的关键组件

| 组件 | 来源 (workany) | 描述 |
|------|----------------|------|
| `ChatPage` | `TaskDetail.tsx` | 编排所有聊天 UI 的主页面 |
| `ChatInput` | `ChatInput.tsx` | 带文件/图片支持的统一输入 |
| `MessageList` | `TaskDetail.tsx` | 消息分组和渲染 |
| `ToolExecutionItem` | `ToolExecutionItem.tsx` | 单个工具调用显示 |
| `PlanApproval` | `PlanApproval.tsx` | 带批准/拒绝的执行计划 |
| `QuestionInput` | `QuestionInput.tsx` | 交互式问题表单 |
| `RightSidebar` | `RightSidebar.tsx` | 产物、工作空间文件、工具 |
| `ArtifactPreview` | `ArtifactPreview.tsx` | 文件预览面板 |

---

## 状态管理

### useAgent Hook

核心状态管理应从 workany 的 `useAgent.ts` 移植：

**关键状态**：
```typescript
interface AgentState {
  messages: AgentMessage[];
  isRunning: boolean;
  phase: 'idle' | 'planning' | 'awaiting_approval' | 'executing';
  plan: Plan | null;
  pendingQuestion: Question | null;
  sessionFolder: string;
  backgroundTasks: BackgroundTask[];
}

type MessageType = 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'user' | 'plan';
```

**关键操作**：
```typescript
interface AgentActions {
  runAgent(prompt: string, attachments?: MessageAttachment[]): Promise<void>;
  continueConversation(message: string, attachments?: MessageAttachment[]): Promise<void>;
  stopAgent(): void;
  loadTask(taskId: string): Promise<void>;
  approvePlan(): void;
  rejectPlan(): void;
  respondToQuestion(answers: Record<string, string>): void;
}
```

### 后端通信

- 使用 SSE（服务器发送事件）进行流式响应
- 端点：`POST /agent/run`（新任务）或 `POST /agent/continue`（回复）
- 流式消息类型：text、tool_use、tool_result、plan、result、error

---

## 数据库 Schema

### 需要添加的表（通过 Tauri SQL 插件使用 SQLite）

```sql
-- 会话分组相关任务
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 单个聊天任务
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  cost REAL DEFAULT 0,
  duration INTEGER DEFAULT 0,
  favorite INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 聊天消息
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  name TEXT,           -- 工具名称用于 tool_use
  input TEXT,          -- 工具输入的 JSON
  output TEXT,         -- 工具结果
  tool_use_id TEXT,    -- 链接 tool_result 到 tool_use
  plan TEXT,           -- 计划消息的 JSON
  attachments TEXT,    -- 用户附件的 JSON
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 生成的产物/文件
CREATE TABLE library_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT,
  preview TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

---

## 国际化键

**文件**: `apps/desktop/src/i18n/locales/en.json`

```json
{
  "workspace": {
    "chat": "Chat",
    "chatPlaceholder": "Ask anything...",
    "replyPlaceholder": "Continue the conversation...",
    "stopAgent": "Stop",
    "sendMessage": "Send"
  },
  "chat": {
    "newChat": "New Chat",
    "hideSteps": "Hide steps",
    "showSteps": "Show {count} steps",
    "planTitle": "Execution Plan",
    "approvePlan": "Approve",
    "rejectPlan": "Reject",
    "addFilesOrPhotos": "Add files or photos",
    "noMessages": "Start a conversation",
    "running": "Running..."
  }
}
```

**文件**: `apps/desktop/src/i18n/locales/zh-CN.json`

```json
{
  "workspace": {
    "chat": "对话",
    "chatPlaceholder": "问我任何问题...",
    "replyPlaceholder": "继续对话...",
    "stopAgent": "停止",
    "sendMessage": "发送"
  },
  "chat": {
    "newChat": "新对话",
    "hideSteps": "隐藏步骤",
    "showSteps": "显示 {count} 个步骤",
    "planTitle": "执行计划",
    "approvePlan": "批准",
    "rejectPlan": "拒绝",
    "addFilesOrPhotos": "添加文件或图片",
    "noMessages": "开始对话",
    "running": "运行中..."
  }
}
```

---

## 依赖项

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0"
  }
}
```

---

## 文件结构

```
apps/desktop/src/
├── pages/
│   ├── workspace-chat.tsx          # 主聊天页面
│   └── index.ts                    # 导出新页面
├── components/
│   └── chat/
│       ├── index.ts
│       ├── chat-input.tsx          # 带附件的输入
│       ├── message-list.tsx        # 消息分组
│       ├── message-item.tsx        # 单个消息
│       ├── tool-execution-item.tsx # 工具调用显示
│       ├── plan-approval.tsx       # 计划 UI
│       ├── question-input.tsx      # 问题表单
│       └── right-sidebar.tsx       # 产物面板
├── hooks/
│   ├── use-agent.ts               # 智能体状态管理
│   └── use-vite-preview.ts        # 实时预览（可选）
└── db/
    ├── index.ts
    ├── types.ts                   # Task、Message、Session 类型
    ├── database.ts                # SQLite 操作
    └── migrations/                # Schema 迁移
```

---

## 实现阶段

### 阶段 1：基础
1. 在工作空间详情页添加"对话"按钮
2. 创建聊天页面路由和基本布局
3. 设置数据库 schema 和迁移

### 阶段 2：核心聊天
1. 移植 `ChatInput` 组件
2. 使用模拟数据实现 `useAgent` hook
3. 构建消息列表渲染

### 阶段 3：后端集成
1. 连接智能体后端（SSE 流式）
2. 实现任务创建和继续
3. 添加消息持久化

### 阶段 4：丰富功能
1. 移植带展开/折叠的 `ToolExecutionItem`
2. 添加 `PlanApproval` 组件
3. 实现用于交互式查询的 `QuestionInput`

### 阶段 5：润色
1. 添加带产物的 `RightSidebar`
2. 实现实时预览（可选）
3. 添加动画和加载状态

---

## 设计说明

### 遵循 Viben 设计系统

- 使用温暖的琥珀/橙色调色板
- 使用 Crimson Pro（衬线）作为标题，Inter（无衬线）作为正文
- 应用来自 `design-system.md` 的编排动画
- 使用现有的 Card、Button 和 UI 组件

### 与 workany 的差异

| 方面 | workany | viben（适配后） |
|------|---------|------------------|
| 配色方案 | 中性灰色 | 温暖琥珀/橙色 |
| 字体 | 单一无衬线 | 衬线 + 无衬线 |
| 动画 | 基础 | 编排式序列 |
| 聊天位置 | 独立路由 | 嵌套在工作空间下 |

---

## 后端要求

聊天功能需要后端智能体服务。可以是：

1. **现有 Claude API 代理** - 如果 viben 已有后端
2. **新智能体服务** - 从 workany 的 Rust 后端移植
3. **直接 API 调用** - 从前端直接使用 Anthropic API（更简单但灵活性较低）

**建议**：MVP 阶段使用直接 API 调用，然后为以下功能添加专用后端：
- 工具执行
- 文件系统访问
- MCP 服务器集成

---

## 测试清单

- [ ] 聊天按钮出现在工作空间详情页
- [ ] 点击按钮导航到聊天页面
- [ ] 可以发送文本消息
- [ ] 可以附加文件/图片
- [ ] 消息正确渲染（markdown、代码块）
- [ ] 工具执行带展开/折叠显示
- [ ] 计划审批 UI 工作
- [ ] 问题输入处理多个问题
- [ ] 停止按钮取消运行中的智能体
- [ ] 消息在页面刷新后持久化
- [ ] 国际化支持英文和中文
