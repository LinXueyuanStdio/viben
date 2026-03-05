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
│  │  backlog → queue → in_progress → ai_review → human_review │  │
│  │                    (planning/coding/qa)        → done/pr  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       File System Storage                        │
│  <workspace>/.viben/tasks/<date>-<slug>/task.json               │
└─────────────────────────────────────────────────────────────────┘
```

## 状态机定义

### 状态 (TaskStatus)

| 状态 | 中文 | 描述 |
|------|------|------|
| `backlog` | 待办 | 任务等待开始 |
| `queue` | 队列 | 任务排队等待执行容量 |
| `in_progress` | 执行中 | 任务正在执行（含子状态） |
| `ai_review` | AI审查 | AI 自动审查阶段 |
| `human_review` | 人工审查 | 需要人工审核 |
| `done` | 完成 | 任务已完成 |
| `pr_created` | PR已创建 | Pull Request 已创建 |
| `error` | 错误 | 任务执行出错 |

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
                    │  └─────────┘  └─────────┘  └──────────┘  └────────┘ │
                    └──────────────────────────────────────────────────────┘
                           │               │            │           │
                           ▼               ▼            ▼           ▼
┌───────┐  QUEUE  ┌───────┐  START  ┌─────────────────────────────────┐
│backlog│────────→│ queue │────────→│           (see above)           │
└───────┘         └───────┘         └─────────────────────────────────┘
    ▲                │                              │
    │    DEQUEUE     │                              │ QA_PASSED
    └────────────────┘                              ▼
                                              ┌─────────────┐
                                              │human_review │
                                              └─────────────┘
                                    APPROVED     │    │  REJECTED
                                        ┌────────┘    └────────┐
                                        ▼                      ▼
                                  ┌─────────┐            ┌─────────┐
                                  │  done   │            │ coding  │
                                  └─────────┘            └─────────┘
                                  CREATE_PR
                                        │
                                        ▼
                                  ┌──────────┐
                                  │pr_created│
                                  └──────────┘
```

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
| `PLANNING_FAILED` | 计划失败 | planning → error |

#### 编码阶段事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `SUBTASK_COMPLETE` | 子任务完成 | 保持 coding，递增索引 |
| `ALL_SUBTASKS_DONE` | 所有子任务完成 | coding → qa_review |
| `CODING_FAILED` | 编码失败 | coding → error |

#### QA 阶段事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `QA_PASSED` | QA 通过 | qa_review → human_review |
| `QA_FAILED` | QA 发现问题 | qa_review → qa_fixing |
| `QA_FIXING_COMPLETE` | 修复完成 | qa_fixing → qa_review |
| `QA_FIXING_FAILED` | 修复失败 | qa_fixing → error |

#### 用户交互事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `USER_STOPPED` | 用户手动停止 | * → backlog 或 human_review |
| `APPROVED` | 人工批准 | human_review → done |
| `REJECTED` | 人工拒绝 | human_review → coding |
| `CREATE_PR` | 创建 PR | human_review → pr_created |

#### 恢复事件
| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `RETRY` | 重试 | error → in_progress |
| `ABANDON` | 放弃 | error → backlog |

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
  executionPhase?: ExecutionPhase;
  reviewReason?: ReviewReason;   // human_review 原因

  // 组织信息
  priority?: "P0" | "P1" | "P2" | "P3";
  devType?: "feature" | "bugfix" | "refactor" | "docs";
  scope?: string;

  // Git 集成
  branch?: string;
  prUrl?: string;
  worktreePath?: string;

  // 智能体/会话集成
  agent?: string;
  sessionId?: string;
  taskIndex?: number;
  executor?: string;

  // 执行追踪
  cost?: number;
  duration?: number;
  hasInProgressAttempt?: boolean;
  lastAttemptFailed?: boolean;

  // XState 集成
  xstateState?: XStateValue;
  lastEvent?: TaskEvent;
  eventHistory?: TaskEvent[];

  // 时间戳
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // 扩展元数据
  metadata?: TaskMetadata;
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
}
```

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
    ├── task.json              # 主任务文件
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
  "xstateState": { "in_progress": "coding" },
  "lastEvent": {
    "eventId": "...",
    "sequence": 5,
    "type": "SUBTASK_COMPLETE",
    "timestamp": "2026-03-08T14:00:00.000Z"
  },
  "eventHistory": [...],
  "createdAt": "2026-03-08T10:00:00.000Z",
  "updatedAt": "2026-03-08T14:00:00.000Z"
}
```

## Gateway API 接口

### 任务 CRUD 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/tasks?workspace_path=<path>` | 列出所有任务 |
| `GET` | `/api/tasks/:id?workspace_path=<path>` | 获取任务详情 |
| `POST` | `/api/tasks` | 创建任务 |
| `PATCH` | `/api/tasks/:id` | 更新任务 |
| `DELETE` | `/api/tasks/:id?workspace_path=<path>` | 删除任务 |
| `GET` | `/api/tasks/:id/specs?workspace_path=<path>` | 获取任务规格 |

### 事件管理端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/tasks/:task_id/events` | 提交状态机事件 |
| `GET` | `/api/tasks/:task_id/events/stream` | SSE 实时订阅 |
| `GET` | `/api/tasks/:task_id/state` | 获取当前状态 |
| `GET` | `/api/tasks/:task_id/events` | 获取事件历史 |
| `POST` | `/api/tasks/:task_id/events/validate` | 验证事件（干运行） |

### API 命名约定

> **重要**: 所有 Gateway API 查询参数使用 **snake_case** 格式

```typescript
// 正确
/api/tasks?workspace_path=/path/to/workspace
/api/tasks/:id/events?session_id=abc123

// 错误
/api/tasks?workspacePath=/path/to/workspace  // 不要使用 camelCase
```

## SSE 实时更新

### TaskSSEManager

SSE 管理器负责向客户端广播任务状态变更：

```typescript
interface TaskSSEEvent {
  type: TaskSSEEventType;
  task_id: string;
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

### SSE 端点

```
GET /api/tasks/:task_id/events/stream?workspace_path=<path>

响应头:
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## 事件存储与并发控制

### TaskEventStore

事件存储负责验证和应用事件：

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

## 任务恢复机制

### TaskRecoveryService

恢复服务处理以下场景：

1. **Gateway 重启恢复**: 从 task.json 恢复状态
2. **卡住检测**: 将不活跃任务移至 human_review
3. **智能体崩溃**: 使用 USER_STOPPED 事件自动恢复

### 恢复配置

```typescript
interface RecoveryConfig {
  stuckThresholdMs?: number;  // 默认: 2分钟
  autoRecover?: boolean;      // 默认: true
}
```

### 恢复流程

```
1. Gateway 启动
   ↓
2. 扫描所有工作区任务
   ↓
3. 检查活跃任务 (queue, in_progress, ai_review)
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
3. **Layer 3**: 向 Gateway 验证进程是否实际运行

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

### 队列任务状态

| 状态 | 描述 |
|------|------|
| `pending` | 等待执行 |
| `running` | 正在执行 |
| `retrying` | 重试中 |
| `completed` | 已完成 |
| `failed` | 已失败 |

## 最佳实践

### 事件提交

1. **总是使用递增的序列号**: 从 `lastEvent.sequence + 1` 开始
2. **验证后再提交**: 使用 `/events/validate` 端点预检查
3. **处理 409 冲突**: 重新获取任务状态后重试

### 状态监听

1. **使用 SSE 而非轮询**: 减少服务器负载
2. **实现重连逻辑**: 处理网络断开
3. **消费心跳事件**: 检测连接健康

### 错误处理

1. **捕获序列号不匹配**: 可能有并发修改
2. **处理无效转换**: 检查当前状态是否允许该事件
3. **实现幂等操作**: 使用 eventId 防止重复处理

## 相关文件

| 路径 | 描述 |
|------|------|
| `packages/core/src/task/machine/task-machine.ts` | XState 状态机定义 |
| `packages/core/src/task/events/event-store.ts` | 事件存储实现 |
| `packages/core/src/task/events/event-types.ts` | 事件类型定义 |
| `packages/core/src/task/recovery/task-recovery.ts` | 恢复服务 |
| `packages/core/src/services/task-service.ts` | 任务服务 |
| `packages/core/src/gateway/routes/tasks.ts` | 任务 API 路由 |
| `packages/core/src/gateway/routes/task-events.ts` | 事件 API 路由 |
| `packages/core/src/gateway/sse/task-sse-manager.ts` | SSE 管理器 |
| `packages/core/src/utils/async-lock.ts` | 异步锁工具 |
| `apps/desktop/src/hooks/use-stuck-detection.ts` | 前端卡住检测 |
