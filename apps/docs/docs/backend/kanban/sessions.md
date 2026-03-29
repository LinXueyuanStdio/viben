---
sidebar_position: 6
---

# Kanban Sessions

> Manage agent sessions within workspaces with message history and execution control

## Overview

Sessions represent conversations between users and AI agents within a workspace. Each session maintains a message history and can be controlled with follow-up messages, resets, and message queuing.

## Directory Structure

```
<workspace>/.viben/kanban/workspaces/<workspace-id>/sessions/
+-- <session-id>/
    +-- config.yaml          # Session configuration
    +-- messages.jsonl       # Message history (JSONL format)
```

## Session Schema

### KanbanSession

```typescript
interface KanbanSession {
  id: string;
  workspace_id: string;

  // Executor info
  executor_type: string;
  executor_profile_id?: string;

  // Status
  status: SessionStatus;

  // Message statistics
  message_count: number;
  token_usage?: TokenUsage;

  // Timing
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

type SessionStatus =
  | "active"      // Active
  | "paused"      // Paused
  | "completed"   // Completed
  | "failed";     // Failed

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
```

### Message

```typescript
interface Message {
  id: string;
  session_id: string;

  // Role
  role: MessageRole;

  // Content
  content: string;
  content_type?: ContentType;

  // Metadata
  metadata?: MessageMetadata;

  // Timing
  timestamp: string;
}

type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "tool";

type ContentType =
  | "text"
  | "markdown"
  | "code"
  | "tool_call"
  | "tool_result";

interface MessageMetadata {
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
  tokens?: {
    input: number;
    output: number;
  };
  execution_time_ms?: number;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface ToolResult {
  tool_call_id: string;
  content: string;
  is_error?: boolean;
}
```

### SessionWithMessages

Extended session with messages:

```typescript
interface SessionWithMessages extends KanbanSession {
  messages: Message[];
  workspace?: {
    id: string;
    name: string;
    status: WorkspaceStatus;
  };
}
```

## File Examples

### config.yaml

```yaml
id: "sess-1707821100-ghi789"
workspace_id: "ws-1707821000-def456"

executor_type: "claude-code"
executor_profile_id: "default"

status: "active"

message_count: 15
token_usage:
  input_tokens: 12500
  output_tokens: 8300
  total_tokens: 20800

created_at: "2026-02-13T10:35:00Z"
updated_at: "2026-02-13T11:00:00Z"
last_message_at: "2026-02-13T11:00:00Z"
```

### messages.jsonl

```jsonl
{"id":"msg-1","session_id":"sess-1707821100-ghi789","role":"user","content":"Implement user login feature","timestamp":"2026-02-13T10:35:00Z"}
{"id":"msg-2","session_id":"sess-1707821100-ghi789","role":"assistant","content":"I'll help you implement the login feature...","content_type":"markdown","metadata":{"tokens":{"input":150,"output":500}},"timestamp":"2026-02-13T10:35:30Z"}
{"id":"msg-3","session_id":"sess-1707821100-ghi789","role":"assistant","content_type":"tool_call","metadata":{"tool_calls":[{"id":"call-1","name":"write_file","arguments":"{\"path\":\"src/auth/login.ts\"}"}]},"timestamp":"2026-02-13T10:35:45Z"}
{"id":"msg-4","session_id":"sess-1707821100-ghi789","role":"tool","content":"File created","metadata":{"tool_result":{"tool_call_id":"call-1","content":"Success"}},"timestamp":"2026-02-13T10:35:46Z"}
```

## Message Flow

### Send Message Flow

```
+----------+     +-----------------+     +-----------------+
|   User   |---->| SessionService  |---->|ContainerService |
+----------+     +--------+--------+     +--------+--------+
                          |                       |
                          | 1. Append to JSONL    |
                          |                       |
                          | 2. Create execution   |
                          |---------------------->|
                          |                       |
                          | 3. Start executor     |
                          |                       |
                          |<----------------------|
                          |    Streaming response |
                          |                       |
                          | 4. Append response    |
                          |                       |
```

### Follow-up Flow

```
1. Check current session status
2. If process running -> use spawn_follow_up
3. If not -> create new process
4. Append user message
5. Start executor
6. Stream response
7. Append assistant message
```

### Reset Flow

```
1. Find target message
2. Read messages.jsonl
3. Truncate to target message
4. Rewrite messages.jsonl
5. Update session status
```

## Service Interface

### KanbanSessionService

```typescript
class KanbanSessionService {
  // Session CRUD
  async list(workspaceId: string): Promise<KanbanSession[]>;
  async get(workspaceId: string, sessionId: string): Promise<SessionWithMessages>;
  async create(workspaceId: string, data: CreateSession): Promise<KanbanSession>;
  async delete(workspaceId: string, sessionId: string): Promise<void>;

  // Message operations
  async getMessages(
    workspaceId: string,
    sessionId: string,
    options?: GetMessagesOptions
  ): Promise<Message[]>;

  async sendMessage(
    workspaceId: string,
    sessionId: string,
    message: string
  ): Promise<ExecutionProcess>;

  async followUp(
    workspaceId: string,
    sessionId: string,
    message: string
  ): Promise<ExecutionProcess>;

  async resetToMessage(
    workspaceId: string,
    sessionId: string,
    messageId: string
  ): Promise<void>;

  async clearMessages(workspaceId: string, sessionId: string): Promise<void>;

  // Queue operations
  async queueMessage(
    workspaceId: string,
    sessionId: string,
    message: string
  ): Promise<QueuedMessage>;

  async getQueuedMessages(
    workspaceId: string,
    sessionId: string
  ): Promise<QueuedMessage[]>;

  async cancelQueuedMessage(
    workspaceId: string,
    sessionId: string,
    messageId: string
  ): Promise<void>;

  // Review
  async requestReview(
    workspaceId: string,
    sessionId: string,
    options?: ReviewOptions
  ): Promise<ReviewResult>;

  // Streaming
  watchMessages(
    workspaceId: string,
    sessionId: string
  ): AsyncIterable<MessageEvent>;
}
```

### Type Definitions

```typescript
interface CreateSession {
  executor_type: string;
  executor_profile_id?: string;
  initial_prompt?: string;
}

interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  after?: string;    // message ID
  before?: string;   // message ID
}

interface QueuedMessage {
  id: string;
  content: string;
  queued_at: string;
  position: number;
}

interface ReviewOptions {
  include_diff?: boolean;
  reviewers?: string[];
}

interface ReviewResult {
  diff?: string;
  summary?: string;
  suggestions?: string[];
}

interface MessageEvent {
  type: "message_added" | "message_updated" | "streaming_chunk";
  message?: Message;
  chunk?: {
    content: string;
    is_final: boolean;
  };
  timestamp: string;
}
```

## API Endpoints

### List Sessions

```http
GET /api/kanban/workspaces/:workspaceId/sessions
```

### Get Session

```http
GET /api/kanban/workspaces/:workspaceId/sessions/:sessionId
```

Response includes messages:
```json
{
  "id": "sess-123",
  "status": "active",
  "message_count": 15,
  "messages": [...],
  "workspace": {
    "id": "ws-456",
    "name": "feature-workspace"
  }
}
```

### Create Session

```http
POST /api/kanban/workspaces/:workspaceId/sessions
```

Request body:
```json
{
  "executor_type": "claude-code",
  "executor_profile_id": "default",
  "initial_prompt": "Help me implement login"
}
```

### Delete Session

```http
DELETE /api/kanban/workspaces/:workspaceId/sessions/:sessionId
```

### Get Messages

```http
GET /api/kanban/workspaces/:workspaceId/sessions/:sessionId/messages
```

Query parameters:
- `limit`: Number of messages
- `offset`: Skip count
- `after`: Get messages after this ID
- `before`: Get messages before this ID

### Send Message

```http
POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/messages
```

Request body:
```json
{
  "content": "Please implement the login form"
}
```

### Follow-up

```http
POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/follow-up
```

Request body:
```json
{
  "content": "Now add validation"
}
```

### Reset to Message

```http
POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/reset
```

Request body:
```json
{
  "message_id": "msg-5"
}
```

### Clear Messages

```http
DELETE /api/kanban/workspaces/:workspaceId/sessions/:sessionId/messages
```

### Queue Operations

```http
POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/queue
GET /api/kanban/workspaces/:workspaceId/sessions/:sessionId/queue
DELETE /api/kanban/workspaces/:workspaceId/sessions/:sessionId/queue/:messageId
```

### Request Review

```http
POST /api/kanban/workspaces/:workspaceId/sessions/:sessionId/review
```

### WebSocket Stream

```
WebSocket: /api/kanban/workspaces/:workspaceId/sessions/:sessionId/stream
```

Message events:
```json
{
  "type": "message_added",
  "message": { ... },
  "timestamp": "2026-02-13T11:00:00Z"
}
```

Streaming chunks:
```json
{
  "type": "streaming_chunk",
  "chunk": {
    "content": "partial response...",
    "is_final": false
  },
  "timestamp": "2026-02-13T11:00:00Z"
}
```

## Related Documentation

- [Storage System](./storage.md) - Storage design
- [Workspaces](./workspaces.md) - Workspace management
