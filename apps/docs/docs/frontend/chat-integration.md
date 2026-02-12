# Chat Page Integration Spec

> **Goal**: Integrate workany-style task execution chat page into viben workspace page.
>
> **Reference**: `/Users/lxy/Documents/GitHub/others/workany`
>
> **Platform**: Desktop only (apps/desktop)

---

## Important: Platform Boundary

> **Warning**: Chat integration is **desktop-only** and should NOT be implemented in apps/web.
>
> **Reason**: Workspaces in the desktop app are **local filesystem folders** that contain agent configurations (.claude/, .codex/, etc.). This is fundamentally different from the web app's concept of "workspaces" which are cloud-based collaborative spaces stored in the database.
>
> The chat feature requires:
> - Access to local filesystem (for working files, artifacts)
> - Local agent configuration files
> - Tauri commands for executing tools
> - SQLite database for message persistence
>
> None of these are available in the web environment.

---

## Overview

Add a "Chat" button to the workspace detail page that navigates to a chat interface for AI agent interaction. The chat page should mirror the workany TaskDetail design.

---

## UI Changes

### 1. Workspace Detail Page - Add Chat Button

**Location**: `apps/desktop/src/pages/workspace-detail.tsx`

**Position**: In the header actions area (line ~239), alongside "Refresh" and "Remove" buttons.

```tsx
import { MessageSquare } from "lucide-react";

// In header actions section:
<div className="flex items-center gap-2">
  {/* NEW: Chat Button */}
  <Button
    variant="outline"
    size="sm"
    onClick={() => navigate(`/workspace/${workspaceId}/chat`)}
  >
    <MessageSquare className="h-4 w-4 mr-2" />
    {t("workspace.chat")}
  </Button>

  {/* Existing buttons */}
  <Button variant="outline" size="sm" onClick={loadAgents}>
    ...
  </Button>
</div>
```

### 2. New Chat Page Route

**File**: `apps/desktop/src/App.tsx`

```tsx
<Route path="workspace/:workspaceId/chat" element={<WorkspaceChatPage />} />
<Route path="workspace/:workspaceId/chat/:taskId" element={<WorkspaceChatPage />} />
```

---

## Chat Page Structure (from workany)

### Core Layout

```
+------------------------------------------------------------------+
|  Header: Back | Workspace Name | Running Indicator | Actions     |
+------------------------------------------------------------------+
|                                              |                    |
|  Chat Messages Area (scrollable)             |  Right Sidebar     |
|    - User messages                           |    - Artifacts     |
|    - AI text responses                       |    - Workspace     |
|    - Tool executions (collapsible)           |    - MCP Tools     |
|    - Plan approval UI                        |    - Skills        |
|    - Question input                          |                    |
|                                              |                    |
+------------------------------------------------------------------+
|  Reply Input: Textarea + File Attach + Send/Stop                 |
+------------------------------------------------------------------+
```

### Key Components to Create/Port

| Component | Source (workany) | Description |
|-----------|------------------|-------------|
| `ChatPage` | `TaskDetail.tsx` | Main page orchestrating all chat UI |
| `ChatInput` | `ChatInput.tsx` | Unified input with file/image support |
| `MessageList` | `TaskDetail.tsx` | Message grouping and rendering |
| `ToolExecutionItem` | `ToolExecutionItem.tsx` | Individual tool call display |
| `PlanApproval` | `PlanApproval.tsx` | Execution plan with approve/reject |
| `QuestionInput` | `QuestionInput.tsx` | Interactive question form |
| `RightSidebar` | `RightSidebar.tsx` | Artifacts, workspace files, tools |
| `ArtifactPreview` | `ArtifactPreview.tsx` | File preview panel |

---

## State Management

### useAgent Hook

The core state management should be ported from workany's `useAgent.ts`:

**Key State**:
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

**Key Actions**:
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

### Backend Communication

- Uses SSE (Server-Sent Events) for streaming responses
- Endpoint: `POST /agent/run` (new task) or `POST /agent/continue` (reply)
- Message types streamed: text, tool_use, tool_result, plan, result, error

---

## Database Schema

### Tables to Add (SQLite via Tauri SQL plugin)

```sql
-- Sessions group related tasks
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Individual chat tasks
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

-- Chat messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  name TEXT,           -- tool name for tool_use
  input TEXT,          -- JSON for tool input
  output TEXT,         -- tool result
  tool_use_id TEXT,    -- links tool_result to tool_use
  plan TEXT,           -- JSON for plan messages
  attachments TEXT,    -- JSON for user attachments
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Generated artifacts/files
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

## i18n Keys to Add

**File**: `apps/desktop/src/i18n/locales/en.json`

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

**File**: `apps/desktop/src/i18n/locales/zh-CN.json`

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

## Dependencies to Add

```json
{
  "dependencies": {
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0"
  }
}
```

---

## File Structure

```
apps/desktop/src/
├── pages/
│   ├── workspace-chat.tsx          # Main chat page
│   └── index.ts                    # Export new page
├── components/
│   └── chat/
│       ├── index.ts
│       ├── chat-input.tsx          # Input with attachments
│       ├── message-list.tsx        # Message grouping
│       ├── message-item.tsx        # Individual message
│       ├── tool-execution-item.tsx # Tool call display
│       ├── plan-approval.tsx       # Plan UI
│       ├── question-input.tsx      # Question form
│       └── right-sidebar.tsx       # Artifacts panel
├── hooks/
│   ├── use-agent.ts               # Agent state management
│   └── use-vite-preview.ts        # Live preview (optional)
└── db/
    ├── index.ts
    ├── types.ts                   # Task, Message, Session types
    ├── database.ts                # SQLite operations
    └── migrations/                # Schema migrations
```

---

## Implementation Phases

### Phase 1: Foundation
1. Add "Chat" button to workspace detail page
2. Create chat page route and basic layout
3. Set up database schema and migrations

### Phase 2: Core Chat
1. Port `ChatInput` component
2. Implement `useAgent` hook with mock data
3. Build message list rendering

### Phase 3: Backend Integration
1. Connect to agent backend (SSE streaming)
2. Implement task creation and continuation
3. Add message persistence

### Phase 4: Rich Features
1. Port `ToolExecutionItem` with expand/collapse
2. Add `PlanApproval` component
3. Implement `QuestionInput` for interactive queries

### Phase 5: Polish
1. Add `RightSidebar` with artifacts
2. Implement live preview (optional)
3. Add animations and loading states

---

## Design Notes

### Follow Viben Design System

- Use warm amber/orange color palette
- Use Crimson Pro (serif) for headings, Inter (sans-serif) for body
- Apply choreographed animations from `design-system.md`
- Use existing Card, Button, and UI components

### Differences from workany

| Aspect | workany | viben (adapt to) |
|--------|---------|------------------|
| Color scheme | Neutral grays | Warm amber/orange |
| Typography | Single sans-serif | Serif + sans-serif |
| Animation | Basic | Choreographed sequences |
| Chat location | Standalone route | Nested under workspace |

---

## Backend Requirements

The chat feature requires a backend agent service. This can be:

1. **Existing Claude API proxy** - If viben already has backend
2. **New agent service** - Port from workany's Rust backend
3. **Direct API calls** - Use Anthropic API directly from frontend (simpler but less flexible)

**Recommendation**: Start with direct API calls for MVP, then add dedicated backend for:
- Tool execution
- File system access
- MCP server integration

---

## Testing Checklist

- [ ] Chat button appears on workspace detail page
- [ ] Clicking button navigates to chat page
- [ ] Can send text messages
- [ ] Can attach files/images
- [ ] Messages render correctly (markdown, code blocks)
- [ ] Tool executions display with expand/collapse
- [ ] Plan approval UI works
- [ ] Question input handles multiple questions
- [ ] Stop button cancels running agent
- [ ] Messages persist across page refresh
- [ ] i18n works for both EN and ZH-CN
