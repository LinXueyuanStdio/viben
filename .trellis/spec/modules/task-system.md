# Viben 任务系统规范

> 本文档描述 Viben 任务系统的完整架构，包括状态机、事件系统、恢复机制和 API 接口。

## 概述

Viben 任务系统是一个基于事件驱动的状态机架构，用于管理 AI 智能体执行的任务生命周期。系统采用 XState v5 实现状态管理，使用文件系统进行持久化存储，并通过 Server-Sent Events (SSE) 提供实时状态更新。

## 核心架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Gateway (Fastify)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Task Routes │  │ Event Routes│  │ SSE Manager             │  │
│  │ /api/tasks  │  │ /api/events │  │ 实时状态广播            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Task Service Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │TaskService  │  │EventStore   │  │RecoveryService          │  │
│  │CRUD 操作    │  │事件验证/应用│  │卡住检测/恢复            │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      XState State Machine                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  backlog → queue → in_progress → human_review → completed │  │
│  │     │        ↓    (planning/coding/qa)    ↑       ↑       │  │
│  │     │     paused ─────────────────────────┘       │       │  │
│  │     └─────→ cancelled   failed ←──────────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       File System Storage                        │
│  <workspace>/.viben/tasks/<date>-<slug>/                        │
│  ├── task.json        # 主任务文件（不含 eventHistory）          │
│  └── events.jsonl     # 事件历史（追加写入）                     │
└─────────────────────────────────────────────────────────────────┘
```

## 状态机定义

### 状态 (TaskStatus)

| 状态 | 中文 | 描述 |
|------|------|------|
| `backlog` | 待办 | 任务等待开始 |
| `queue` | 队列 | 任务排队等待执行容量 |
| `in_progress` | 执行中 | 任务正在执行（含子状态） |
| `paused` | 已暂停 | 任务暂停，保留当前进度 |
| `human_review` | 人工审查 | 需要人工审核 |
| `completed` | 已完成 | 任务成功完成 |
| `failed` | 失败 | 任务执行失败 |
| `cancelled` | 已取消 | 任务被主动取消 |

> **注意**:
> - `ai_review` 状态已移除，AI 审查通过 `executionPhase` 表示（`qa_review`、`qa_fixing`）
> - `pr_created` 状态已移除，PR 创建记录在 `pr_url` 字段
> - `done` → `completed`、`error` → `failed` 重命名以提供更清晰的语义

### 执行阶段 (ExecutionPhase) - in_progress 子状态

| 阶段 | 描述 |
|------|------|
| `planning` | 生成实现计划 |
| `coding` | 执行子任务编码 |
| `qa_review` | AI 质量审查 |
| `qa_fixing` | 修复 QA 发现的问题 |

### 状态流转图

```
                    ┌──────────────────────────────────────────────────────┐
                    │                   in_progress                        │
                    │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐ │
                    │  │planning │→ │ coding  │→ │qa_review │→ │qa_fixing│→│
                    │  └────┬────┘  └────┬────┘  └────┬─────┘  └───┬────┘ │
                    │       │            │            │             │      │
                    │       └────────────┴────────────┴─────────────┘      │
                    │                        │ PAUSE                       │
                    └────────────────────────┼─────────────────────────────┘
                           │               │            │           │
                           ▼               ▼            ▼           ▼
┌───────┐  QUEUE  ┌───────┐  START  ┌─────────────────────────────────┐
│backlog│────────→│ queue │────────→│           (see above)           │
└───────┘         └───┬───┘         └─────────────────────────────────┘
                      │                              │
         DEQUEUE      │ PAUSE                        │ QA_PASSED
    ┌─────────────────┤                              ▼
    │                 ▼                        ┌─────────────┐
    │            ┌─────────┐                   │human_review │
    └───────────→│ paused  │←──────────────────└─────────────┘
                 └────┬────┘                   APPROVED │    │  REJECTED
                      │ RESUME                     ┌────┘    └────┐
                      └────────────────────────────▼              ▼
                                             ┌───────────┐    ┌─────────┐
                                             │ completed │    │ coding  │
                                             └───────────┘    └─────────┘

    CANCEL 事件: backlog/queue/paused/human_review → cancelled
    *_FAILED 事件 → failed
    failed + RETRY → in_progress
    failed + ABANDON → backlog
```

> **注意**:
> - `backlog` 状态只能通过 `QUEUE` 事件进入 `queue` 状态，不能直接 `START`
> - 前端待办列的"开始"按钮应发送 `QUEUE` 事件
> - `CANCEL` 事件可从多个非执行状态直接进入 `cancelled` 终止状态

### 事件类型 (TaskEventType)

#### 队列管理事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `QUEUE` | 将任务从待办移到队列 | backlog → queue |
| `START` | 开始执行任务 | queue → in_progress.planning |
| `DEQUEUE` | 将任务移回待办 | queue → backlog |

#### 计划阶段事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `PLANNING_COMPLETE` | 计划完成 | planning → coding 或 human_review |
| `PLANNING_FAILED` | 计划失败 | planning → failed |

#### 编码阶段事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `SUBTASK_COMPLETE` | 子任务完成 | 保持 coding，递增索引 |
| `ALL_SUBTASKS_DONE` | 所有子任务完成 | coding → qa_review |
| `CODING_FAILED` | 编码失败 | coding → failed |

#### QA 阶段事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `QA_PASSED` | QA 通过 | qa_review → human_review |
| `QA_FAILED` | QA 发现问题 | qa_review → qa_fixing |
| `QA_FIXING_COMPLETE` | 修复完成 | qa_fixing → qa_review |
| `QA_FIXING_FAILED` | 修复失败 | qa_fixing → failed |

#### 用户交互事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `USER_STOPPED` | 用户手动停止 | * → backlog 或 human_review |
| `APPROVED` | 人工批准 | human_review → completed |
| `REJECTED` | 人工拒绝 | human_review → coding |
| `CANCEL` | 取消任务 | backlog/queue/paused/human_review → cancelled |

#### 暂停/恢复事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `PAUSE` | 暂停任务 | queue/in_progress.* → paused |
| `RESUME` | 恢复任务 | paused → 暂停前的状态 |

#### 恢复事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `RETRY` | 重试 | failed → in_progress |
| `ABANDON` | 放弃 | failed/paused → backlog |

## 核心类型定义

### UnifiedTask - 统一任务接口

```typescript
interface UnifiedTask {
  // 核心标识
  id: string;                    // UUID
  name: string;                  // 目录名 (date-slug)
  title: string;                 // 显示标题
  description?: string;          // 任务描述

  // 状态跟踪
  status: TaskStatus;
  executionProgress?: {          // 执行进度追踪
    phase: ExecutionPhase;       // 当前执行阶段
    phaseProgress?: number;      // 阶段进度 0-100
  };
  reviewReason?: ReviewReason;   // human_review 原因

  // 组织信息
  priority?: "P0" | "P1" | "P2" | "P3";
  dev_type?: "feature" | "bugfix" | "refactor" | "docs";  // snake_case 与 API 一致
  scope?: string;

  // 任务关系
  dependsOn?: string[];          // 依赖的任务 ID 列表
  parentTaskId?: string;         // 父任务 ID（用于任务拆分）
  childTaskIds?: string[];       // 子任务 ID 列表（反向引用）

  // 调度信息
  queuedAt?: string;             // 入队时间，用于 FIFO 排序（QUEUE 事件时自动设置）

  // Git 集成
  branch?: string;
  pr_url?: string;               // snake_case 与 API 一致
  worktree_path?: string;        // snake_case 与 API 一致

  // 智能体/会话/执行配置（入队后锁定）
  agent?: string;                // 执行智能体 ID（入队后不可更改）
  sessionId?: string;            // 唯一绑定的会话 ID（入队后不可更改）
  executor?: string;             // 执行器类型（入队后不可更改）
  model?: string;                // 模型 ID（入队后不可更改）
  taskIndex?: number;

  // 执行追踪
  cost?: number;
  duration?: number;
  hasInProgressAttempt?: boolean;
  lastAttemptFailed?: boolean;

  // XState 集成
  xstateState?: XStateValue;
  lastEvent?: TaskEvent;
  // eventHistory 已移至 events.jsonl

  // 时间戳
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // 扩展元数据
  metadata?: TaskMetadata;

  // 模板标记
  is_template?: boolean;          // 是否为模板任务（snake_case 与 API 一致）
}
```

### TaskEvent - 任务事件

```typescript
interface TaskEvent {
  eventId: string;      // UUID
  sequence: number;     // 单调递增序列号
  type: TaskEventType;  // 事件类型
  timestamp: string;    // ISO 时间戳
  payload?: Record<string, unknown>;
}
```

### TaskMachineContext - 状态机上下文

```typescript
interface TaskMachineContext {
  taskId: string;
  reviewReason?: ReviewReason;
  currentSubtaskIndex: number;
  requiresPlanReview: boolean;

  // 暂停快照（用于 RESUME 恢复完整上下文）
  pausedSnapshot?: {
    fromState: XStateValue;           // 暂停前的状态
    subtaskIndex: number;             // 当前子任务索引
    executionContext?: Record<string, unknown>;  // 执行器上下文
    pausedAt: string;                 // 暂停时间 ISO 格式
  };
}
```

### 暂停/恢复语义

| 暂停前状态 | 恢复行为 |
|-----------|----------|
| `planning` | 继续 planning，保留已有计划草稿 |
| `coding` | 继续当前子任务（`subtaskIndex` 不变） |
| `qa_review` | 重新开始 QA 审查 |
| `qa_fixing` | 继续修复当前问题 |
| `queue` | 回到 `queue`，等待重新调度 |

### ReviewReason - 审查原因

| 值 | 描述 |
|----|------|
| `completed` | 所有子任务完成，QA 通过 |
| `errors` | 执行过程中出错 |
| `qa_rejected` | QA 发现问题 |
| `plan_review` | 计划等待审批 |
| `stopped` | 用户手动停止 |

## 文件存储结构

### 任务目录结构

```
<workspace>/.viben/tasks/
└── <date>-<slug>/
    ├── task.json              # 主任务文件（不含 eventHistory）
    ├── events.jsonl           # 事件历史（追加写入）
    ├── prd.md                 # 产品需求文档
    ├── implementation_plan.json  # 实现计划
    └── logs/                  # 执行日志
        ├── planning.json
        ├── coding.json
        └── qa.json
```

### task.json 示例

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "2026-03-08-implement-feature",
  "title": "实现用户认证功能",
  "status": "in_progress",
  "executionPhase": "coding",
  "priority": "P1",
  "dependsOn": ["task-uuid-1", "task-uuid-2"],
  "queuedAt": "2026-03-08T09:55:00.000Z",
  "xstateState": { "in_progress": "coding" },
  "lastEvent": {
    "eventId": "...",
    "sequence": 5,
    "type": "SUBTASK_COMPLETE",
    "timestamp": "2026-03-08T14:00:00.000Z"
  },
  "createdAt": "2026-03-08T10:00:00.000Z",
  "updatedAt": "2026-03-08T14:00:00.000Z"
}
```

### events.jsonl 格式

事件历史使用 JSONL 格式存储，每行一个 JSON 对象，支持追加写入：

```jsonl
{"eventId":"uuid-1","sequence":1,"type":"QUEUE","timestamp":"2026-03-08T10:00:00Z"}
{"eventId":"uuid-2","sequence":2,"type":"START","timestamp":"2026-03-08T10:00:05Z"}
{"eventId":"uuid-3","sequence":3,"type":"PLANNING_COMPLETE","timestamp":"2026-03-08T10:05:00Z","payload":{"planId":"..."}}
{"eventId":"uuid-4","sequence":4,"type":"PAUSE","timestamp":"2026-03-08T10:10:00Z"}
{"eventId":"uuid-5","sequence":5,"type":"RESUME","timestamp":"2026-03-08T10:15:00Z"}
```

**迁移兼容性**: 系统优先从 `events.jsonl` 读取事件历史，如不存在则回退到 `task.json` 中的 `eventHistory` 字段。

## Gateway API 接口

### 任务 CRUD 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/tasks?workspace_path=<path>` | 列出所有任务 |
| `GET` | `/api/tasks/:id?workspace_path=<path>` | 获取任务详情 |
| `POST` | `/api/tasks` | 创建任务（支持 `copy_from` 复制、`is_template` 模板标记） |
| `PATCH` | `/api/tasks/:id` | 更新任务（支持 `is_template` 模板标记） |
| `DELETE` | `/api/tasks/:id?workspace_path=<path>` | 删除任务 |
| `GET` | `/api/tasks/:id/specs?workspace_path=<path>` | 获取任务规格 |
| `GET` | `/api/tasks?workspace_path=<path>&is_template=true` | 列出模板任务 |
| `GET` | `/api/tasks?workspace_path=<path>&is_template=false` | 列出普通任务（排除模板） |

### 事件管理端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/tasks/:task_id/events` | 提交状态机事件 |
| `GET` | `/api/tasks/:task_id/events/stream` | SSE 单任务订阅 |
| `GET` | `/api/tasks/:task_id/state` | 获取当前状态 |
| `GET` | `/api/tasks/:task_id/events` | 获取事件历史 |
| `POST` | `/api/tasks/:task_id/events/validate` | 验证事件（干运行） |

### SSE 订阅端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/tasks/events/stream?workspace_path=<path>` | 全局订阅（工作区所有任务） |
| `GET` | `/api/tasks/events/stream?workspace_path=<path>&task_ids=id1,id2` | 批量订阅（指定任务） |
| `GET` | `/api/tasks/:task_id/events/stream?workspace_path=<path>` | 单任务订阅（保持向后兼容） |

**SSE 事件重放**：所有订阅端点支持 `last_sequence` 查询参数，用于断线重连时补发错过的事件：

```
GET /api/tasks/:task_id/events/stream?workspace_path=<path>&last_sequence=<n>
GET /api/tasks/events/stream?workspace_path=<path>&last_sequence=<n>
```

### 批量操作端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/tasks/batch/events` | 批量发送事件 |

**批量事件请求/响应格式**：

```typescript
// 请求
interface BatchEventRequest {
  workspace_path: string;
  task_dirs: string[];       // 目标任务列表
  event_type: TaskEventType; // 要发送的事件类型
  payload?: Record<string, unknown>;
}

// 响应
interface BatchEventResponse {
  results: {
    task_dir: string;
    success: boolean;
    error?: string;          // 失败原因
    new_state?: string;      // 成功后的新状态
  }[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
```

**支持的批量操作**：

| 操作 | 事件 | 适用状态 |
|------|------|----------|
| 批量入队 | `QUEUE` | `backlog` |
| 批量暂停 | `PAUSE` | `queue`, `in_progress` |
| 批量恢复 | `RESUME` | `paused` |
| 批量取消 | `CANCEL` | `backlog`, `queue`, `paused`, `human_review` |
| 批量移回待办 | `DEQUEUE` | `queue` |

> **注意**：批量操作采用**尽力执行**策略，部分失败不影响其他任务，不支持事务回滚。

### 队列管理端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/queue/status` | 获取队列状态（运行/停止、任务数等） |
| `GET` | `/api/queue/config` | 获取队列配置 |
| `GET` | `/api/queue/tasks/:id` | 获取队列中的任务详情 |
| `GET` | `/api/queue/tasks/:id/running` | 检查任务是否正在执行（用于卡住检测） |
| `POST` | `/api/queue/start` | 启动队列处理 |
| `POST` | `/api/queue/shutdown` | 停止队列处理 |
| `POST` | `/api/queue/clear-history` | 清理已完成任务历史 |
| `PUT` | `/api/queue/tasks/:id/pause` | 暂停指定任务 |
| `DELETE` | `/api/queue/tasks/:id` | 取消/移除任务 |

### API 命名约定

> **重要**: 所有 Gateway API 查询参数使用 **snake_case** 格式

```typescript
// 正确
/api/tasks?workspace_path=/path/to/workspace
/api/tasks/:id/events?session_id=abc123
/api/tasks/events/stream?workspace_path=/path&task_ids=id1,id2

// 错误
/api/tasks?workspacePath=/path/to/workspace  // 不要使用 camelCase
```

## SSE 实时更新

### TaskSSEManager

SSE 管理器负责向客户端广播任务状态变更，支持四种订阅模式：

1. **单任务订阅**: `subscribe(taskId, listener, workspacePath?)` - 订阅单个任务
2. **工作区订阅**: `subscribeWorkspace(workspacePath, listener)` - 订阅工作区所有任务
3. **批量订阅**: `subscribeTasks(taskIds, listener, workspacePath?)` - 订阅多个指定任务
4. **全局订阅**: `subscribeAll(listener)` - 订阅所有任务事件（跨工作区）

```typescript
interface TaskSSEEvent {
  type: TaskSSEEventType;
  task_id: string;
  workspace_path?: string;    // 支持多工作区场景
  timestamp: number;
  data?: unknown;
}

type TaskSSEEventType =
  | "STATE_CHANGED"   // 状态变更
  | "TASK_RECOVERED"  // 任务恢复
  | "TASK_UPDATED"    // 任务更新
  | "TASK_DELETED"    // 任务删除
  | "CONNECTED"       // 连接建立
  | "HEARTBEAT";      // 心跳
```

### SSE 连接管理

| 配置 | 默认值 | 描述 |
|------|--------|------|
| 心跳间隔 | 30秒 | 保持连接活跃 |
| 过期超时 | 2分钟 | 清理死连接 |
| 最大失败次数 | 3次 | 连续失败后清理 |
| 清理间隔 | 1分钟 | 自动清理周期 |

### SSE 广播逻辑

```typescript
// 事件广播分发
broadcast(taskId: string, event: TaskSSEEvent, workspacePath?: string): void {
  // 1. 发送给该任务的单任务订阅者
  // 2. 发送给该工作区的全局订阅者
  // 3. 发送给包含该任务的批量订阅者
}
```

### SSE 事件重放机制

客户端断连期间发生的事件会丢失，重连后状态不同步。通过 `last_sequence` 参数支持事件补发：

**重连流程**：

```
1. 客户端记录收到的最后一个事件的 sequence
2. 连接断开
3. 重连时携带 last_sequence 参数
4. 服务端返回 sequence > last_sequence 的所有事件
5. 客户端处理补发的事件，恢复同步
```

**服务端实现**：

```typescript
interface SSESubscribeOptions {
  workspace_path: string;
  task_ids?: string[];
  last_sequence?: number;  // 用于事件重放
}

async function handleSSEConnection(options: SSESubscribeOptions, reply: FastifyReply) {
  // 1. 如果有 last_sequence，先发送补发事件
  if (options.last_sequence !== undefined) {
    const missedEvents = await getMissedEvents(options.workspace_path, options.last_sequence);
    for (const event of missedEvents) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  // 2. 发送 CONNECTED 事件
  reply.raw.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  // 3. 注册实时订阅
  // ...
}
```

**客户端实现**：

```typescript
function useTaskSSE(taskId: string) {
  const lastSequenceRef = useRef<number>(0);

  const connect = useCallback(() => {
    const url = new URL(`/api/tasks/${taskId}/events/stream`);
    url.searchParams.set('last_sequence', String(lastSequenceRef.current));

    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.sequence) {
        lastSequenceRef.current = data.sequence;
      }
      // 处理事件...
    };
  }, [taskId]);
}
```

## 事件存储与并发控制

### TaskEventStore

事件存储负责验证和应用事件，支持 JSONL 格式的追加写入：

```typescript
interface ApplyEventResult {
  success: boolean;
  error?: "SEQUENCE_MISMATCH" | "INVALID_TRANSITION" |
          "INVALID_EVENT_TYPE" | "TASK_NOT_FOUND";
  expected?: number;    // 预期序列号
  received?: number;    // 实际序列号
  currentState?: string;
  newState?: string;
  task?: UnifiedTask;
}

// 事件存储 API
class TaskEventStore {
  // 追加事件到 events.jsonl
  private async appendEvent(taskDir: string, event: TaskEvent): Promise<void>;

  // 读取事件历史（按需加载，支持增量读取）
  async getEventHistory(taskDir: string, since?: number): Promise<TaskEvent[]>;

  // 迁移旧格式到 events.jsonl
  async migrateEventHistory(taskDir: string): Promise<void>;
}
```

### 并发控制

使用 `AsyncLock` 保护任务文件操作：

```typescript
// 锁键: 任务目录路径
const lock = new AsyncLock();

// 所有写操作使用锁
await lock.withLock(taskDir, async () => {
  const task = await taskService.getTask(taskDir);
  // 修改任务...
  await taskService.updateTask(taskDir, updates);
});
```

**特性:**
- 基于键的细粒度锁（每个任务独立）
- 30秒超时防止死锁
- FIFO 队列保证公平性
- 自动清理空闲锁

## 任务依赖与优先级调度

### 依赖规则

1. **依赖检查**: 任务从 `queue` → `in_progress` 时，所有 `dependsOn` 任务必须为 `done` 或 `pr_created`
2. **循环检测**: 创建/更新依赖时检测循环，返回 400 错误
3. **级联通知**: 任务完成时通知依赖它的任务

```typescript
function allDependenciesMet(task: UnifiedTask, allTasks: Map<string, UnifiedTask>): boolean {
  if (!task.dependsOn?.length) return true;

  return task.dependsOn.every(depId => {
    const dep = allTasks.get(depId);
    return dep && (dep.status === 'done' || dep.status === 'pr_created');
  });
}
```

### 软优先级调度

```typescript
function getNextTask(queue: UnifiedTask[], allTasks: Map<string, UnifiedTask>): UnifiedTask | null {
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };

  const ready = queue
    .filter(t => t.status === 'queue')
    .filter(t => allDependenciesMet(t, allTasks))
    .sort((a, b) => {
      // 1. 优先级排序 (P0 > P1 > P2 > P3)
      const pa = priorityOrder[a.priority ?? 'P2'];
      const pb = priorityOrder[b.priority ?? 'P2'];
      if (pa !== pb) return pa - pb;

      // 2. 同优先级按入队时间 FIFO
      const ta = new Date(a.queuedAt ?? a.createdAt).getTime();
      const tb = new Date(b.queuedAt ?? b.createdAt).getTime();
      return ta - tb;
    });

  return ready[0] ?? null;
}
```

**调度特性:**
- 高优先级任务优先调度
- 不抢占正在执行的任务
- 同优先级保持 FIFO 公平性
- 依赖未满足的任务跳过

### 循环依赖检测

```typescript
function hasCyclicDependency(
  taskId: string,
  dependsOn: string[],
  allTasks: Map<string, UnifiedTask>
): boolean {
  // 使用 DFS 检测是否形成环
  const visited = new Set<string>();
  const stack = [...dependsOn];

  while (stack.length > 0) {
    const depId = stack.pop()!;
    if (depId === taskId) return true;  // 发现环
    if (visited.has(depId)) continue;
    visited.add(depId);

    const dep = allTasks.get(depId);
    if (dep?.dependsOn) {
      stack.push(...dep.dependsOn);
    }
  }
  return false;
}
```

## 任务模板与复制

### 任务模板

任务可标记为模板，用于快速创建相似任务：

```typescript
interface UnifiedTask {
  // ...
  isTemplate?: boolean;  // 是否为模板（模板名称即 title）
}
```

### 创建任务 API 扩展

```typescript
// POST /api/tasks - 创建任务
interface CreateTaskRequest {
  // 现有字段
  title: string;
  description?: string;
  priority?: Priority;
  // ...

  // 模板/复制相关
  copy_from?: string;         // 源任务的 task_dir，复制该任务的配置
  is_template?: boolean;      // 将此任务标记为模板
}

// PATCH /api/tasks?task_dir=<dir> - 更新任务
interface UpdateTaskRequest {
  // 现有字段 ...
  is_template?: boolean;      // 设置/取消模板标记
}
```

### 使用流程

1. **创建模板**：创建任务时设置 `is_template: true`，或更新现有任务设置该标记
2. **从模板/任务创建**：创建任务时设置 `copy_from: <task_dir>`，复制源任务的配置
3. **查询模板**：使用 `GET /api/tasks?is_template=true` 获取所有模板

## 任务恢复机制

### TaskRecoveryService

恢复服务处理以下场景：

1. **Gateway 重启恢复**: 从 task.json 恢复状态
2. **卡住检测**: 将不活跃任务移至 human_review
3. **智能体崩溃**: 使用 USER_STOPPED 事件自动恢复

### 恢复配置

```typescript
interface RecoveryConfig {
  stuckThresholdMs?: number;  // 默认: 2分钟（服务默认值）
  autoRecover?: boolean;      // 默认: true
}
```

> **注意**: Gateway 实际使用 5 分钟阈值 (`state.ts`)，与前端多层检测配合使用。

### 恢复流程

```
1. Gateway 启动
   ↓
2. 扫描所有工作区任务
   ↓
3. 检查活跃任务 (queue, in_progress, paused)
   ↓
4. 检测卡住任务 (超过阈值无更新)
   ↓
5. 应用 USER_STOPPED 事件
   ↓
6. 广播 TASK_RECOVERED SSE 事件
```

### 多层卡住检测（前端）

前端 `useStuckDetection` hook 实现多层检测：

1. **Layer 1**: 检查客户端活动追踪（SSE 事件、数据刷新）
2. **Layer 2**: 检查 lastUpdated 时间戳
3. **Layer 3**: 向 Gateway 验证进程是否实际运行（`GET /api/queue/tasks/:id/running`）

### 卡住检测阈值配置

多层检测使用不同的阈值，以平衡响应速度和准确性：

| 层级 | 阈值 | 位置 | 说明 |
|------|------|------|------|
| 前端客户端 | 60秒 | `constants.ts` | 快速响应用户 |
| 前端服务端检查 | 2分钟 | `constants.ts` | 网络延迟容错 |
| Gateway 恢复服务 | 5分钟 | `state.ts` | 避免误判，给予充足执行时间 |

**前端常量配置** (`apps/desktop/src/lib/vibe-kanban/constants.ts`):

```typescript
// 卡住检测
export const STUCK_THRESHOLD_MS = 60_000;           // 60秒 - 客户端阈值
export const SERVER_STUCK_THRESHOLD_MS = 2 * 60_000; // 2分钟 - 服务端验证阈值
export const STUCK_CHECK_INTERVAL_MS = 30_000;       // 30秒 - 检查间隔

// SSE 心跳
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;     // 30秒

// 活动记录清理
export const ACTIVITY_MAX_AGE_MS = 10 * 60_000;      // 10分钟 - 记录最大保留时间
export const ACTIVITY_CLEANUP_INTERVAL_MS = 5 * 60_000; // 5分钟 - 清理间隔

// 网络重试配置
export const NETWORK_RETRY_CONFIG = {
  maxRetries: 2,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  timeoutMs: 10_000,
};

// 异步操作安全超时
export const SAFETY_TIMEOUT_MS = 15_000;             // 15秒
```

## 会话绑定与配置锁定

### 会话绑定规则

每个任务绑定**唯一一个** `sessionId`，用于 executor 的使用：

1. **创建时绑定**: 任务创建时可以指定 `sessionId`，如未指定则在首次执行时自动生成
2. **唯一性**: 一个任务只能绑定一个会话，会话 ID 在任务生命周期内不变
3. **执行器使用**: Executor 通过 `sessionId` 恢复会话上下文，保持对话连续性

```typescript
// 任务首次执行时绑定会话
if (!task.sessionId) {
  task.sessionId = crypto.randomUUID();
  await taskService.updateTask(taskDir, { sessionId: task.sessionId });
}

// Executor 使用会话 ID
const result = await executor.run({
  sessionId: task.sessionId,
  agent: task.agent,
  // ...
});
```

### 配置锁定规则

任务入队后（`status !== 'backlog'`），以下配置**不可更改**：

| 字段 | 说明 | 锁定原因 |
|------|------|----------|
| `agent` | 执行智能体 ID | 更换 agent 会导致上下文不一致 |
| `sessionId` | 会话 ID | 会话已与特定 agent 绑定 |
| `executor` | 执行器类型 | 执行器决定运行方式 |
| `model` | 模型 ID | 模型能力影响执行策略 |

**前端实现**：
- `backlog` 状态：显示 agent/executor/model 选择器，允许用户配置
- 其他状态：隐藏选择器或显示为只读，防止误操作

```typescript
// 判断配置是否可编辑
const isConfigLocked = task.status !== 'backlog';

// 前端组件
<AgentSelector disabled={isConfigLocked} />
<ExecutorSelector disabled={isConfigLocked} />
<ModelSelector disabled={isConfigLocked} />
```

### 配置变更时机

| 操作 | 允许状态 | 说明 |
|------|----------|------|
| 修改 agent/executor/model | `backlog` | 任务尚未入队，可自由配置 |
| 修改 title/description | 任意 | 描述性字段始终可编辑 |
| 修改 priority | 任意 | 优先级可随时调整 |
| 修改 dependsOn | `backlog`, `queue` | 执行前可调整依赖 |

## 队列系统

### TaskQueueManager

队列管理器控制并发执行：

```typescript
interface QueueConfig {
  max_concurrency: number;      // 默认: 3
  default_max_retries: number;  // 默认: 3
  persist_debounce_ms: number;  // 默认: 500
  shutdown_timeout_ms: number;  // 默认: 30000
}
```

### 队列状态映射

队列系统使用统一的 TaskStatus，内部状态映射如下：

| 内部状态 | 统一 TaskStatus | 说明 |
|----------|-----------------|------|
| `pending` | `queue` | 等待执行 |
| `running` | `in_progress` | 正在执行 |
| `retrying` | `in_progress` | 重试中（带 retry 标记） |
| `completed` | `completed` | 已完成 |
| `failed` | `failed` | 已失败 |

## 最佳实践

### 事件提交

1. **总是使用递增的序列号**: 从 `lastEvent.sequence + 1` 开始
2. **验证后再提交**: 使用 `/events/validate` 端点预检查
3. **处理 409 冲突**: 重新获取任务状态后重试

### 状态监听

1. **使用 SSE 而非轮询**: 减少服务器负载
2. **实现重连逻辑**: 处理网络断开
3. **消费心跳事件**: 检测连接健康
4. **使用批量/工作区订阅**: 监控多任务时减少连接数

### 错误处理

1. **捕获序列号不匹配**: 可能有并发修改
2. **处理无效转换**: 检查当前状态是否允许该事件
3. **实现幂等操作**: 使用 eventId 防止重复处理

### 任务依赖

1. **检查循环依赖**: 设置依赖前验证不会形成环
2. **处理依赖阻塞**: 显示任务等待哪些依赖完成
3. **使用优先级**: P0 > P1 > P2 > P3，合理分配优先级

## 相关文件

| 路径 | 描述 |
|------|------|
| `packages/core/src/task/machine/task-machine.ts` | XState 状态机定义 |
| `packages/core/src/task/machine/guards.ts` | 状态机守卫函数 |
| `packages/core/src/task/machine/actions.ts` | 状态机动作函数 |
| `packages/core/src/task/events/event-store.ts` | 事件存储实现 |
| `packages/core/src/task/events/event-types.ts` | 事件类型定义 |
| `packages/core/src/task/recovery/task-recovery.ts` | 恢复服务 |
| `packages/core/src/services/task-service.ts` | 任务服务 |
| `packages/core/src/gateway/routes/tasks.ts` | 任务 API 路由 |
| `packages/core/src/gateway/routes/task-events.ts` | 事件 API 路由 |
| `packages/core/src/gateway/sse/task-sse-manager.ts` | SSE 管理器 |
| `packages/core/src/gateway/queue/scheduler.ts` | 优先级调度器 |
| `packages/core/src/gateway/queue/types.ts` | 队列类型定义 |
| `packages/core/src/gateway/queue/index.ts` | 队列管理器 |
| `packages/core/src/gateway/queue/worker.ts` | 队列工作线程 |
| `packages/core/src/gateway/routes/queue.ts` | 队列 API 路由 |
| `packages/core/src/gateway/state.ts` | Gateway 状态（含恢复服务配置） |
| `packages/core/src/utils/async-lock.ts` | 异步锁工具 |
| `apps/desktop/src/hooks/use-stuck-detection.ts` | 前端卡住检测 |
| `apps/desktop/src/lib/vibe-kanban/constants.ts` | 前端卡住检测常量 |
| `apps/desktop/src/stores/task-activity-store.ts` | 任务活动追踪存储 |

## 迁移注意事项

### 状态重命名迁移

从旧版本迁移时需要处理以下状态映射：

| 旧状态 | 新状态 | 处理方式 |
|--------|--------|----------|
| `done` | `completed` | 自动映射 |
| `error` | `failed` | 自动映射 |
| `pr_created` | `completed` | 映射为 completed，PR URL 保留在 `pr_url` 字段 |

### 事件兼容性

- 事件历史中的旧状态名称需要兼容处理
- `CREATE_PR` 事件已移除，现有事件可忽略或映射为无操作
- 新增 `CANCEL` 事件用于取消任务

### 暂停快照迁移

旧版本使用 `pausedFromState` 简单存储，新版本使用 `pausedSnapshot` 结构：

```typescript
// 旧格式
pausedFromState?: XStateValue;

// 新格式
pausedSnapshot?: {
  fromState: XStateValue;
  subtaskIndex: number;
  executionContext?: Record<string, unknown>;
  pausedAt: string;
};
```

迁移时，将 `pausedFromState` 转换为 `pausedSnapshot.fromState`，其他字段使用默认值。
