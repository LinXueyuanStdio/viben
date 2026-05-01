---
sidebar_position: 23
title: "Session Persistence"
description: "File-system based session persistence design for real-time message saving during SSE streaming"
---

# Session Persistence

File-system based session persistence design for real-time message saving during SSE streaming.

---

## Overview

The session persistence system unifies the two independent session systems (in-memory `AgentService` sessions and file-based `SessionStore` sessions) into a single file-system-based persistence layer that saves messages in real-time during SSE streaming.

### Design Goals

1. **Real-time persistence during SSE streaming** - Each message is immediately appended to file
2. **Unified data model** - Session -> Task -> Message three-layer structure
3. **Background task support** - Tasks continue executing and persisting when user switches away
4. **Task recovery** - Application state can be restored after restart

---

## File Storage Structure

```
~/.viben/
+-- agents/
|   +-- <agent-id>/
|       +-- config.yaml                    # Agent configuration
|       +-- .agent_sessions/
|           +-- <session-id>/
|               +-- config.yaml            # Session configuration
|               +-- messages.ui.jsonl      # UI rendering messages (append-only)
|               +-- messages.rollout.jsonl # Messages sent to Agent
|               +-- messages.agent.jsonl   # Agent raw responses
+-- tasks/
|   +-- <task-id>.yaml                     # Task configuration
+-- files/
    +-- <file-id>/
        +-- meta.yaml                      # File metadata
        +-- <filename>                     # Actual file
```

---

## Data Model

### Session

**Storage**: `~/.viben/agents/<agent-id>/.agent_sessions/<session-id>/config.yaml`

```yaml
id: "20260224153000_hello-world"  # Format: YYYYMMDDHHmmss_slug
agent_id: "personal-assistant"
prompt: "Hello world"
task_count: 3
status: "active"                   # active | completed | error
workspace_path: "/Users/xxx/project"
created_at: "2026-02-24T07:30:00.000Z"
updated_at: "2026-02-24T07:35:00.000Z"
```

```typescript
interface SessionConfig {
  id: string;
  agentId: string;
  prompt: string;
  taskCount: number;
  status: 'active' | 'completed' | 'error';
  workspacePath?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
```

### Task

**Storage**: `~/.viben/tasks/<task-id>.yaml`

```yaml
id: "task_1708771800000_abc123"
session_id: "20260224153000_hello-world"
agent_id: "personal-assistant"
task_index: 1
prompt: "Please write a Hello World"
status: "completed"                # running | completed | error | stopped
cost: 0.0023
duration: 12500
favorite: false
created_at: "2026-02-24T07:30:00.000Z"
updated_at: "2026-02-24T07:30:12.500Z"
```

```typescript
interface TaskConfig {
  id: string;
  sessionId: string;
  agentId: string;
  taskIndex: number;
  prompt: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  cost?: number;
  duration?: number;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Message (UI)

**Storage**: `messages.ui.jsonl` (JSON Lines, append-only)

```jsonl
{"id":"msg_1","taskId":"task_1","type":"user","content":"Hello","timestamp":"2026-02-24T07:30:00.000Z"}
{"id":"msg_2","taskId":"task_1","type":"text","content":"Hi there!","timestamp":"2026-02-24T07:30:01.000Z"}
{"id":"msg_3","taskId":"task_1","type":"tool_use","toolName":"Read","toolUseId":"tu_1","toolInput":{"file_path":"/tmp/test.txt"},"timestamp":"2026-02-24T07:30:02.000Z"}
{"id":"msg_4","taskId":"task_1","type":"tool_result","toolUseId":"tu_1","toolOutput":"File content...","timestamp":"2026-02-24T07:30:03.000Z"}
```

**TypeScript Types** (Discriminated Union):

```typescript
type UIMessage =
  | UIUserMessage
  | UITextMessage
  | UIToolUseMessage
  | UIToolResultMessage
  | UIPlanMessage
  | UIQuestionMessage
  | UIErrorMessage
  | UIResultMessage;
```

Each message type extends a base interface with `id`, `taskId`, and `timestamp` fields.

---

## Core Interface

### SessionStore

**Location**: `packages/core/src/services/session-store.ts`

```typescript
export class SessionStore {
  // Session Operations
  async createSession(config: SessionConfig): Promise<void>;
  async getSession(agentId: string, sessionId: string): Promise<SessionConfig>;
  async listSessions(agentId: string): Promise<SessionConfig[]>;
  async updateSession(agentId: string, sessionId: string, updates: Partial<SessionConfig>): Promise<void>;
  async deleteSession(agentId: string, sessionId: string): Promise<void>;

  // Message Operations (UI) - append-only, no buffering
  async appendUIMessage(agentId: string, sessionId: string, message: UIMessage): Promise<void>;
  async readUIMessages(agentId: string, sessionId: string): Promise<UIMessage[]>;
  async readUIMessagesByTask(agentId: string, sessionId: string, taskId: string): Promise<UIMessage[]>;

  // Task Operations
  async createTask(config: TaskConfig): Promise<void>;
  async getTask(taskId: string): Promise<TaskConfig | null>;
  async listTasksBySession(sessionId: string): Promise<TaskConfig[]>;
  async updateTask(taskId: string, updates: Partial<TaskConfig>): Promise<void>;

  // File Operations
  async createFile(file: LibraryFile, content?: Buffer): Promise<void>;
  async getFile(fileId: string): Promise<LibraryFile | null>;
  async listFilesByTask(taskId: string): Promise<LibraryFile[]>;
}
```

### Key Implementation Details

**Session ID Generation**: Uses timestamp + slug format `YYYYMMDDHHmmss_slug`.

**Message Append** (append-only):

```typescript
async appendUIMessage(agentId: string, sessionId: string, message: UIMessage): Promise<void> {
  const messagesPath = this.uiMessagesPath(agentId, sessionId);
  const json = JSON.stringify(message);
  await appendFile(messagesPath, json + '\n');
}
```

**Message Read** (with fallback): If `messages.ui.jsonl` is empty, falls back to reading `messages.rollout.jsonl` and converting.

---

## SSE Stream Persistence

During SSE stream processing, each message is persisted immediately:

```typescript
const processStream = async (response: Response, currentTaskId: string) => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));

        // 1. Update UI state (active task only)
        if (isActiveTask()) {
          setMessages(prev => [...prev, data]);
        }

        // 2. Immediately persist to file system (all tasks)
        await sessionStore.appendUIMessage(agentId, sessionId, {
          id: generateId(),
          taskId: currentTaskId,
          type: data.type,
          content: data.content,
          timestamp: new Date().toISOString(),
        });

        // 3. Update task status
        await updateTaskFromMessage(currentTaskId, data);
      }
    }
  }
};
```

---

## API Endpoint Changes

### `/api/agent/run` Modifications

**New request fields**:

```typescript
interface AgentRunRequest {
  prompt: string;
  cwd?: string;
  agentConfigPath?: string;
  agentConfig?: AgentConfigPayload;
  sessionId?: string;    // File system session ID
  taskId?: string;       // File system task ID
}
```

**Behavior changes**:
1. `agentId` is automatically derived from `agentConfigPath` or `agentConfig`
2. If `sessionId` and `taskId` are provided, messages are persisted in real-time
3. Backward compatible: without `sessionId`/`taskId`, behavior is unchanged

### New Endpoints

```
GET /api/agent/:agentId/sessions/:sessionId/tasks
GET /api/agent/:agentId/sessions/:sessionId/tasks/:taskId/messages
PATCH /api/tasks/:taskId
```

---

## Migration Plan

1. **Phase 1**: Extend SessionStore with Task and File operations
2. **Phase 2**: Modify API endpoints for real-time persistence
3. **Phase 3**: Modify frontend hooks for background task support
4. **Phase 4**: Remove duplicate in-memory session system

---

## Related Documentation

- [SSE Streaming](./sse-streaming.md) - SSE communication protocol
- [Background Tasks](./background-tasks.md) - Background task management
- [Sessions API](./sessions.md) - Session management endpoints
