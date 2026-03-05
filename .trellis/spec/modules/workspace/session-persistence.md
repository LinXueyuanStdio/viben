# Session 持久化设计规范

> **参考实现**: `/Users/lxy/Documents/GitHub/others/workany`

---

## 参考文件索引

### WorkAny 核心文件

| 文件 | 绝对路径 | 行数 | 说明 |
|------|----------|------|------|
| useAgent.ts | `/Users/lxy/Documents/GitHub/others/workany/src/shared/hooks/useAgent.ts` | ~2400 | SSE 流处理、消息持久化、后台任务管理 |
| database.ts | `/Users/lxy/Documents/GitHub/others/workany/src/shared/db/database.ts` | ~806 | 数据库 CRUD 操作 (SQLite/IndexedDB) |
| types.ts | `/Users/lxy/Documents/GitHub/others/workany/src/shared/db/types.ts` | ~115 | 数据库类型定义 |
| session.ts | `/Users/lxy/Documents/GitHub/others/workany/src/shared/lib/session.ts` | ~50 | Session ID 生成 |
| background-tasks.ts | `/Users/lxy/Documents/GitHub/others/workany/src/shared/lib/background-tasks.ts` | ~100 | 后台任务管理 |

### WorkAny 关键代码位置

| 功能 | 文件 | 行号 | 函数/代码块 |
|------|------|------|------------|
| SSE 流处理 | useAgent.ts | 1382-1619 | `processStream()` |
| 消息实时保存 | useAgent.ts | 1577-1609 | `createMessage()` 调用 |
| 任务状态更新 | useAgent.ts | 1599-1606 | `updateTaskFromMessage()` |
| 后台任务切换 | useAgent.ts | 1629-1640 | `addBackgroundTask()` |
| 任务恢复 | useAgent.ts | 800-850 | `loadMessages()` |
| Session ID 生成 | session.ts | 10-25 | `generateSessionId()` |

### Viben 目标文件

| 文件 | 绝对路径 | 说明 |
|------|----------|------|
| session-store.ts | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/services/session-store.ts` | 文件系统持久化 (需扩展) |
| use-agent-conversation.ts | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/apps/desktop/src/hooks/use-agent-conversation.ts` | 前端 Hook (需修改) |
| agent-run.ts | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/agent-run.ts` | API 端点 (需修改) |
| agent.ts | `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/services/agent.ts` | 内存 Session (待移除) |

---

## 问题背景

### 当前 Viben 的问题

Viben 存在**两套独立的 Session 系统**，没有任何数据同步：

```
┌─────────────────────────────────────────────────────────────────────┐
│  AgentService (内存)           ❌ 无连接    SessionStore (文件)      │
│  ┌───────────────────┐                    ┌───────────────────────┐ │
│  │ sessions: Map     │                    │ ~/.viben/agents/      │ │
│  │ plans: Map        │                    │   <id>/.agent_sessions│ │
│  │ 进程重启后丢失     │                    │     config.yaml       │ │
│  └───────────────────┘                    │     messages.ui.jsonl │ │
│                                           └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

问题：
1. /api/agent/run 使用 AgentService 创建临时内存 session
2. 前端使用 SessionStore 创建文件 session
3. 执行结果不会保存到文件系统
4. 刷新页面后消息丢失
```

### WorkAny 的解决方案

WorkAny 使用**统一的数据库层**，在 SSE 流处理过程中**实时持久化**每条消息：

```typescript
// workany/src/shared/hooks/useAgent.ts:1577-1609
// 每收到一条 SSE 消息立即保存
await createMessage({
  task_id: currentTaskId,
  type: data.type,
  content: data.content,
  tool_name: data.name,
  tool_input: data.input ? JSON.stringify(data.input) : undefined,
  tool_output: data.output,
  tool_use_id: data.toolUseId,
});
```

---

## 设计目标

将 WorkAny 的数据库持久化方案**改造为文件系统实现**，保持相同的架构优势：

1. **SSE 流中实时持久化** - 每条消息立即追加到文件
2. **统一的数据模型** - Session → Task → Message 三层结构
3. **支持后台任务** - 任务切换时保持执行并持久化
4. **支持任务恢复** - 应用重启后可恢复状态

---

## 文件存储结构

```
~/.viben/
├── agents/
│   └── <agent-id>/
│       ├── config.yaml                    # Agent 配置
│       └── .agent_sessions/
│           └── <session-id>/
│               ├── config.yaml            # Session 配置
│               ├── messages.ui.jsonl      # UI 渲染消息 (append-only)
│               ├── messages.rollout.jsonl # 发送给 Agent 的消息
│               └── messages.agent.jsonl   # Agent 原始响应
├── tasks/
│   └── <task-id>.yaml                     # Task 配置
└── files/
    └── <file-id>/
        ├── meta.yaml                      # 文件元数据
        └── <filename>                     # 实际文件
```

---

## 数据模型

### Session

**存储位置**: `~/.viben/agents/<agent-id>/.agent_sessions/<session-id>/config.yaml`

```yaml
# Session 配置
id: "20260224153000_hello-world"  # 格式: YYYYMMDDHHmmss_slug
agent_id: "个人助手"
prompt: "Hello world"              # 初始提示
task_count: 3                      # 该 session 包含的任务数
status: "active"                   # active | completed | error
workspace_path: "/Users/xxx/project"
created_at: "2026-02-24T07:30:00.000Z"
updated_at: "2026-02-24T07:35:00.000Z"
metadata: {}
```

**TypeScript 类型**:

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

**存储位置**: `~/.viben/tasks/<task-id>.yaml`

```yaml
# Task 配置
id: "task_1708771800000_abc123"
session_id: "20260224153000_hello-world"
agent_id: "个人助手"
task_index: 1                      # 在 session 中的序号
prompt: "请帮我写一个 Hello World"
status: "completed"                # running | completed | error | stopped
cost: 0.0023                       # API 调用成本 (USD)
duration: 12500                    # 执行时长 (ms)
favorite: false
created_at: "2026-02-24T07:30:00.000Z"
updated_at: "2026-02-24T07:30:12.500Z"
```

**TypeScript 类型**:

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

**存储位置**: `~/.viben/agents/<agent-id>/.agent_sessions/<session-id>/messages.ui.jsonl`

**格式**: JSON Lines (每行一条消息，append-only)

```jsonl
{"id":"msg_1","taskId":"task_1","type":"user","content":"Hello","timestamp":"2026-02-24T07:30:00.000Z"}
{"id":"msg_2","taskId":"task_1","type":"text","content":"Hi there!","timestamp":"2026-02-24T07:30:01.000Z"}
{"id":"msg_3","taskId":"task_1","type":"tool_use","toolName":"Read","toolUseId":"tu_1","toolInput":{"file_path":"/tmp/test.txt"},"timestamp":"2026-02-24T07:30:02.000Z"}
{"id":"msg_4","taskId":"task_1","type":"tool_result","toolUseId":"tu_1","toolOutput":"File content...","timestamp":"2026-02-24T07:30:03.000Z"}
```

**TypeScript 类型** (Discriminated Union):

```typescript
// 基础消息字段
interface UIMessageBase {
  id: string;
  taskId: string;                  // 关联到 Task
  timestamp: string;
}

// 用户消息
interface UIUserMessage extends UIMessageBase {
  type: 'user';
  content: string;
  attachments?: AttachmentReference[];  // 附件引用
}

// 文本消息 (Assistant 回复)
interface UITextMessage extends UIMessageBase {
  type: 'text';
  content: string;
}

// 工具调用
interface UIToolUseMessage extends UIMessageBase {
  type: 'tool_use';
  toolUseId: string;
  toolName: string;
  toolInput: unknown;
}

// 工具结果
interface UIToolResultMessage extends UIMessageBase {
  type: 'tool_result';
  toolUseId: string;               // 关联到 tool_use
  toolOutput: string;
  isError?: boolean;
}

// 执行计划
interface UIPlanMessage extends UIMessageBase {
  type: 'plan';
  plan: {
    id: string;
    goal: string;
    steps: Array<{
      id: string;
      description: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    }>;
    notes?: string;
  };
}

// 交互式问题
interface UIQuestionMessage extends UIMessageBase {
  type: 'question';
  toolUseId: string;               // AskUserQuestion 的 tool_use_id
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
}

// 错误消息
interface UIErrorMessage extends UIMessageBase {
  type: 'error';
  message: string;
  code?: string;
}

// 任务结果
interface UIResultMessage extends UIMessageBase {
  type: 'result';
  subtype: 'success' | 'error' | 'error_max_turns';
  cost?: number;                   // API 调用成本 (USD)
  duration?: number;               // 执行时长 (ms)
}

// 附件引用
interface AttachmentReference {
  id: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  path: string;                    // 文件系统路径
}

// Union 类型
type UIMessage =
  | UIUserMessage
  | UITextMessage
  | UIToolUseMessage
  | UIToolResultMessage
  | UIPlanMessage
  | UIQuestionMessage
  | UIErrorMessage
  | UIResultMessage;

// 类型守卫
function isUserMessage(msg: UIMessage): msg is UIUserMessage {
  return msg.type === 'user';
}

function isToolUseMessage(msg: UIMessage): msg is UIToolUseMessage {
  return msg.type === 'tool_use';
}

// ... 其他类型守卫
```

### File (Library)

**存储位置**: `~/.viben/files/<file-id>/meta.yaml` + 实际文件

```yaml
# 文件元数据
id: "file_1708771800000"
task_id: "task_1708771800000_abc123"
name: "output.html"
type: "html"                       # html | jsx | css | json | image | pdf | ...
path: "~/.viben/files/file_1708771800000/output.html"
preview: "..."                     # 预览内容 (可选)
thumbnail: "..."                   # 缩略图 base64 (可选)
is_favorite: false
created_at: "2026-02-24T07:30:05.000Z"
```

**TypeScript 类型**:

```typescript
interface LibraryFile {
  id: string;
  taskId: string;
  name: string;
  type: ArtifactType;
  path: string;
  preview?: string;
  thumbnail?: string;
  isFavorite?: boolean;
  createdAt: string;
}

type ArtifactType =
  | 'html' | 'jsx' | 'css' | 'json' | 'text' | 'image' | 'code'
  | 'markdown' | 'csv' | 'document' | 'spreadsheet' | 'presentation'
  | 'pdf' | 'audio' | 'video' | 'font' | 'websearch';
```

---

## 核心接口设计

### SessionStore (文件系统实现)

**文件位置**: `packages/core/src/services/session-store.ts`

```typescript
export class SessionStore {
  private stateDir: string;

  // ============ Session Operations ============

  async createSession(config: SessionConfig): Promise<void>;
  async getSession(agentId: string, sessionId: string): Promise<SessionConfig>;
  async listSessions(agentId: string): Promise<SessionConfig[]>;
  async updateSession(agentId: string, sessionId: string, updates: Partial<SessionConfig>): Promise<void>;
  async deleteSession(agentId: string, sessionId: string): Promise<void>;

  // ============ Message Operations (UI) ============

  /**
   * 追加 UI 消息 (append-only)
   * 每条消息立即写入文件，不缓冲
   */
  async appendUIMessage(agentId: string, sessionId: string, message: UIMessage): Promise<void>;

  /**
   * 读取所有 UI 消息
   * 如果 ui.jsonl 为空，回退到读取 rollout.jsonl 并转换
   */
  async readUIMessages(agentId: string, sessionId: string): Promise<UIMessage[]>;

  /**
   * 按 taskId 过滤消息
   */
  async readUIMessagesByTask(agentId: string, sessionId: string, taskId: string): Promise<UIMessage[]>;

  // ============ Task Operations ============

  async createTask(config: TaskConfig): Promise<void>;
  async getTask(taskId: string): Promise<TaskConfig | null>;
  async listTasksBySession(sessionId: string): Promise<TaskConfig[]>;
  async updateTask(taskId: string, updates: Partial<TaskConfig>): Promise<void>;
  async deleteTask(taskId: string): Promise<void>;

  // ============ File Operations ============

  async createFile(file: LibraryFile, content?: Buffer): Promise<void>;
  async getFile(fileId: string): Promise<LibraryFile | null>;
  async listFilesByTask(taskId: string): Promise<LibraryFile[]>;
  async deleteFile(fileId: string): Promise<void>;
}
```

### 关键实现细节

#### 1. Session ID 生成

参考 WorkAny 的实现，使用时间戳 + slug 格式：

```typescript
// workany/src/shared/lib/session.ts
export function generateSessionId(prompt: string): string {
  const timestamp = generateTimestamp(); // YYYYMMDDHHmmss
  const slug = promptToSlug(prompt);      // 从 prompt 提取关键词
  return `${timestamp}_${slug}`;
}

function promptToSlug(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 30);
}
```

#### 2. 消息追加 (Append-Only)

```typescript
async appendUIMessage(agentId: string, sessionId: string, message: UIMessage): Promise<void> {
  const messagesPath = this.uiMessagesPath(agentId, sessionId);
  const json = JSON.stringify(message);
  await appendFile(messagesPath, json + '\n');
}
```

#### 3. 消息读取 (带回退)

```typescript
async readUIMessages(agentId: string, sessionId: string): Promise<UIMessage[]> {
  const uiPath = this.uiMessagesPath(agentId, sessionId);

  // 尝试读取 UI 消息
  if (existsSync(uiPath)) {
    const content = await readFile(uiPath, 'utf-8');
    const messages = content.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    if (messages.length > 0) {
      return messages;
    }
  }

  // 回退：从 rollout 消息转换
  const rolloutMessages = await this.readRolloutMessages(agentId, sessionId);
  return rolloutMessages.map(this.rolloutToUIMessage);
}
```

---

## SSE 流处理中的持久化

### 关键代码位置

- **WorkAny 参考**: `workany/src/shared/hooks/useAgent.ts:1382-1619` (`processStream` 函数)
- **Viben 目标**: `apps/desktop/src/hooks/use-agent-conversation.ts`

### 实现模式

```typescript
const processStream = useCallback(
  async (response: Response, currentTaskId: string) => {
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

          // 1. 更新 UI 状态 (仅活跃任务)
          if (isActiveTask()) {
            setMessages(prev => [...prev, data]);
          }

          // 2. 立即持久化到文件系统 (所有任务)
          try {
            await sessionStore.appendUIMessage(agentId, sessionId, {
              id: generateId(),
              taskId: currentTaskId,
              type: data.type,
              content: data.content,
              toolName: data.name,
              toolInput: data.input,
              toolOutput: data.output,
              toolUseId: data.toolUseId,
              timestamp: new Date().toISOString(),
            });

            // 3. 更新任务状态
            await updateTaskFromMessage(currentTaskId, data.type, data.subtype, data.cost, data.duration);
          } catch (dbError) {
            console.error('Failed to save message:', dbError);
          }
        }
      }
    }
  },
  []
);
```

### 后台任务支持

```typescript
// 当用户切换任务时，当前运行的任务移到后台继续执行
if (abortControllerRef.current && currentTaskId && currentIsRunning) {
  addBackgroundTask({
    taskId: currentTaskId,
    sessionId: sessionIdRef.current,
    abortController: abortControllerRef.current,
    isRunning: true,
  });
}

// 后台任务继续执行并持久化
// UI 更新通过 isActiveTask() 检查来跳过
const isActiveTask = () => activeTaskIdRef.current === currentTaskId;
```

---

## API 端点修改

### `/api/agent/run` 修改

**文件位置**: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/agent-run.ts`

**请求参数**:

```typescript
interface AgentRunRequest {
  /** 用户输入的 prompt */
  prompt: string;

  /** 工作目录 (可选，默认 process.cwd()) */
  cwd?: string;

  /**
   * Agent 配置来源 (二选一，至少提供一个)
   * - agentPath: 指向 agent config.yaml 的路径，后端从磁盘读取
   * - agentConfig: 内联的 agent 配置对象
   *
   * 如果两者都提供，agentPath 优先
   */
  agentPath?: string;
  agentConfig?: AgentConfigPayload;

  /**
   * Session 关联 (用于消息持久化)
   * agentId 可以从 agentPath 或 agentConfig 推导，不需要显式传递
   */
  sessionId?: string;    // 文件系统中的 session ID
  taskId?: string;       // 文件系统中的 task ID
}

interface AgentConfigPayload {
  name?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
}
```

**agentId 推导逻辑**:

```typescript
// 在 /api/agent/run 处理中
function resolveAgentId(request: AgentRunRequest): string {
  // 1. 从 agentPath 推导
  if (request.agentPath) {
    // agentPath 格式: ~/.viben/agents/<agent-id>/config.yaml
    // 或: /path/to/project/.viben/agents/<agent-id>/config.yaml
    const match = request.agentPath.match(/agents\/([^/]+)\/config\.yaml$/);
    if (match) {
      return match[1];  // 返回 agent-id
    }
  }

  // 2. 从 agentConfig.name 推导
  if (request.agentConfig?.name) {
    return request.agentConfig.name;
  }

  // 3. 默认值
  return 'default';
}
```

**行为变更**:

1. **agentId 自动推导**: 不再需要前端显式传递 `agentId`，从 `agentPath` 或 `agentConfig` 自动推导
2. **消息持久化**: 如果提供了 `sessionId` 和 `taskId`，在流处理中实时保存消息到文件系统
3. **向后兼容**: 如果不提供 `sessionId`/`taskId`，行为与现有实现相同（仅内存 session）

### 新增端点

```typescript
// 列出 session 下的所有 tasks
GET /api/agent/:agentId/sessions/:sessionId/tasks

// 获取 task 的所有消息
GET /api/agent/:agentId/sessions/:sessionId/tasks/:taskId/messages

// 更新 task 状态
PATCH /api/tasks/:taskId
```

---

## 迁移计划

### Phase 1: 扩展 SessionStore

- [ ] 添加 Task 相关方法 (`createTask`, `getTask`, `listTasksBySession`, `updateTask`)
- [ ] 添加 File 相关方法 (`createFile`, `getFile`, `listFilesByTask`)
- [ ] 修改 `appendUIMessage` 支持 `taskId` 字段

### Phase 2: 修改 API 端点

- [ ] 修改 `/api/agent/run` 接受 `agentId`、`sessionId`、`taskId`
- [ ] 在 SSE 流处理中调用 `sessionStore.appendUIMessage`
- [ ] 添加 Task 和 File 相关的 REST 端点

### Phase 3: 修改前端 Hook

- [ ] 修改 `useAgentConversation` 传递 `agentId`、`sessionId`、`taskId`
- [ ] 参考 WorkAny 的 `processStream` 实现实时持久化
- [ ] 添加后台任务管理

### Phase 4: 移除重复系统

- [ ] 移除 `agentService` 中的内存 session 管理
- [ ] 统一使用 `SessionStore` 作为唯一的持久化层

---

## 测试要点

1. **消息持久化**
   - 发送消息后立即刷新页面，消息应保留
   - 切换任务后，后台任务的消息应继续保存

2. **任务恢复**
   - 应用重启后，可以恢复到之前的对话状态
   - 运行中的任务可以继续显示进度

3. **多任务并行**
   - 同时运行多个任务，消息不应混淆
   - 每个任务的消息正确关联到对应的 task_id

---

## 与 WorkAny 的关键差异

| 方面 | WorkAny | Viben |
|------|---------|-------|
| 存储方式 | SQLite / IndexedDB | YAML + JSONL 文件 |
| Session ID | `YYYYMMDDHHmmss_slug` | `YYYYMMDDHHmmss_slug` (保持一致) |
| Task 存储 | 数据库表 | `~/.viben/tasks/<task-id>.yaml` |
| Message 存储 | 数据库表 | `messages.ui.jsonl` (append-only) |
| File 存储 | 数据库表 + 文件系统 | `~/.viben/files/<file-id>/` |

保持**相同的数据模型和流程**，只是将存储后端从数据库改为文件系统。
