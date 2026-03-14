# 任务系统改进设计

> 本文档描述 Viben 任务系统的改进方案，包括状态机变更、暂停恢复机制、SSE 事件重放、任务模板和批量操作。

## 概述

基于对现有 `.trellis/spec/modules/task-system.md` 规范的审查，发现以下需要改进的问题：

1. 终止状态语义不完整（缺少取消状态）
2. 暂停/恢复机制存在状态丢失风险
3. SSE 断连后事件丢失
4. 缺少任务模板和复制功能
5. 缺少批量操作支持

## 第 1 节：状态机改进

### 状态定义变更

**移除的状态：**
- `pr_created` - PR 创建是动作，不是状态

**重命名的状态：**
- `done` → `completed` - 更清晰的完成语义
- `error` → `failed` - 更准确的失败语义

**新增的状态：**
- `cancelled` - 主动取消的任务

**更新后的 TaskStatus：**

```typescript
type TaskStatus =
  | "backlog"       // 待办
  | "queue"         // 排队中
  | "in_progress"   // 执行中（含子状态）
  | "paused"        // 已暂停
  | "review"  // 人工审查
  | "completed"     // 成功完成
  | "failed"        // 执行失败
  | "cancelled";    // 已取消
```

**终止状态对比：**

| 旧设计 | 新设计 | 说明 |
|--------|--------|------|
| `done` | `completed` | 重命名 |
| `error` | `failed` | 重命名 |
| `pr_created` | (移除) | PR 创建记录在 `pr_url` 字段 |
| - | `cancelled` | 新增取消状态 |

## 第 2 节：状态流转变更

### 新增事件类型

| 事件 | 描述 | 触发转换 |
|------|------|----------|
| `CANCEL` | 取消任务 | `backlog`/`queue`/`paused`/`review` → `cancelled` |

### 移除的事件

| 事件 | 原因 |
|------|------|
| `CREATE_PR` | `pr_created` 状态已移除 |

### 变更的事件

| 事件 | 旧转换 | 新转换 |
|------|--------|--------|
| `APPROVED` | `review` → `done` | `review` → `completed` |
| `RETRY` | `error` → `in_progress` | `failed` → `in_progress` |
| `ABANDON` | `error`/`paused` → `backlog` | `failed`/`paused` → `backlog` |

### 更新后的状态流转图

```
                    ┌──────────────────────────────────────────────────────┐
                    │                   in_progress                        │
                    │  ┌─────────┐  ┌───────────┐  ┌───────┐  ┌─────────┐ │
                    │  │  plan   │→ │ implement │→ │ check │→ │   fix   │ │
                    │  └─────────┘  └───────────┘  └───────┘  └─────────┘ │
                    └────────────────────┬─────────────────────────────────┘
                           │             │
┌───────┐  QUEUE  ┌───────┐│ START      │ CHECK_PASSED
│backlog│────────→│ queue │┼────────────┘        │
└───┬───┘         └───┬───┘                      ▼
    │                 │                    ┌─────────────┐
    │ CANCEL          │ PAUSE              │review │
    │                 ▼                    └──────┬──────┘
    │            ┌─────────┐                     │
    │            │ paused  │←────────────────────┤ (PAUSE)
    │            └────┬────┘                     │
    │                 │                    ┌─────┴─────┬───────────┐
    │                 │ CANCEL             │ APPROVED  │ REJECTED  │
    ▼                 ▼                    ▼           ▼           │
┌───────────┐   ┌───────────┐        ┌───────────┐  implement ◄───┘
│ cancelled │   │ cancelled │        │ completed │
└───────────┘   └───────────┘        └───────────┘

    *_FAILED 事件 → failed
    failed + RETRY → in_progress
    failed + ABANDON → backlog
```

## 第 3 节：暂停/恢复机制改进

### 问题

当前 `paused_from_state` 只保存状态值，恢复时可能丢失执行上下文。

### 改进方案

扩展 `TaskMachineContext`，在暂停时保存完整快照：

```typescript
interface TaskMachineContext {
  task_id: string;
  review_reason?: ReviewReason;
  current_subtask_index: number;
  requires_plan_review: boolean;

  // 暂停快照（改进）
  paused_snapshot?: {
    from_state: XStateValue;           // 暂停前的状态
    subtask_index: number;             // 当前子任务索引
    execution_context?: Record<string, unknown>;  // 执行器上下文
    paused_at: string;                 // 暂停时间
  };
}
```

### 恢复语义明确化

| 场景 | 恢复行为 |
|------|----------|
| `paused` from `plan` | 继续 plan，保留已有计划草稿 |
| `paused` from `implement` | 继续当前子任务（`subtask_index` 不变） |
| `paused` from `check` | 重新开始 QA 审查 |
| `paused` from `fix` | 继续修复当前问题 |
| `paused` from `queue` | 回到 `queue`，等待重新调度 |

### RESUME 事件处理

```typescript
// 状态机 action
function restoreFromPause(context: TaskMachineContext): Partial<TaskMachineContext> {
  if (!context.paused_snapshot) {
    throw new Error('No pause snapshot to restore from');
  }

  return {
    current_subtask_index: context.paused_snapshot.subtask_index,
    // 清除快照
    paused_snapshot: undefined,
  };
}
```

## 第 4 节：SSE 事件重放机制

### 问题

客户端断连期间发生的事件会丢失，重连后状态不同步。

### 改进方案

SSE 订阅端点支持 `last_sequence` 参数：

```
GET /api/tasks/:task_id/events/stream?workspace_path=<path>&last_sequence=<n>
GET /api/tasks/events/stream?workspace_path=<path>&last_sequence=<n>
```

### 重连流程

```
1. 客户端记录收到的最后一个事件的 sequence
2. 连接断开
3. 重连时携带 last_sequence 参数
4. 服务端返回 sequence > last_sequence 的所有事件
5. 客户端处理补发的事件，恢复同步
```

### 服务端实现

```typescript
// TaskSSEManager 扩展
interface SSESubscribeOptions {
  workspace_path: string;
  task_ids?: string[];
  last_sequence?: number;  // 新增：用于事件重放
}

async function handleSSEConnection(options: SSESubscribeOptions, reply: FastifyReply) {
  // 1. 如果有 last_sequence，先发送补发事件
  if (options.last_sequence !== undefined) {
    const missed_events = await getMissedEvents(options.workspace_path, options.last_sequence);
    for (const event of missed_events) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  // 2. 发送 CONNECTED 事件
  reply.raw.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);

  // 3. 注册实时订阅
  // ...
}
```

### 客户端实现

```typescript
function useTaskSSE(task_id: string) {
  const lastSequenceRef = useRef<number>(0);

  const connect = useCallback(() => {
    const url = new URL(`/api/tasks/${task_id}/events/stream`);
    url.searchParams.set('last_sequence', String(lastSequenceRef.current));

    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.sequence) {
        lastSequenceRef.current = data.sequence;
      }
      // 处理事件...
    };
  }, [task_id]);
}
```

## 第 5 节：任务模板与复制

### 任务模板

**数据模型扩展：**

```typescript
interface UnifiedTask {
  // ... 现有字段 ...

  is_template?: boolean;      // 是否为模板（模板名称即 title）
}
```

### API 设计

**复用现有端点：**

```typescript
// POST /api/tasks - 创建任务
interface CreateTaskRequest {
  // 现有字段
  title: string;
  description?: string;
  priority?: Priority;
  // ...

  // 新增字段
  copy_from?: string;         // 源任务的 task_dir，复制该任务的配置
  is_template?: boolean;      // 将此任务标记为模板
}

// PATCH /api/tasks?task_dir=<dir> - 更新任务
interface UpdateTaskRequest {
  // 现有字段 ...

  is_template?: boolean;      // 设置/取消模板标记
}
```

### 查询

```typescript
// 列出所有模板
GET /api/tasks?workspace_path=<path>&is_template=true

// 列出普通任务（排除模板）
GET /api/tasks?workspace_path=<path>&is_template=false
```

### 使用流程

1. **创建模板**：创建任务时设置 `is_template: true`，或更新现有任务设置该标记
2. **从模板/任务创建**：创建任务时设置 `copy_from: <task_dir>`

## 第 6 节：批量操作

### 支持的批量操作

| 操作 | 事件 | 适用状态 |
|------|------|----------|
| 批量入队 | `QUEUE` | `backlog` |
| 批量暂停 | `PAUSE` | `queue`, `in_progress` |
| 批量恢复 | `RESUME` | `paused` |
| 批量取消 | `CANCEL` | `backlog`, `queue`, `paused`, `review` |
| 批量移回待办 | `DEQUEUE` | `queue` |

### API 设计

**新增批量事件端点：**

```typescript
// POST /api/tasks/batch/events
interface BatchEventRequest {
  workspace_path: string;
  task_dirs: string[];       // 目标任务列表
  event_type: TaskEventType; // 要发送的事件类型
  payload?: Record<string, unknown>;
}

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

### 执行逻辑

```typescript
async function batchApplyEvent(request: BatchEventRequest): Promise<BatchEventResponse> {
  const results = await Promise.all(
    request.task_dirs.map(async (task_dir) => {
      try {
        const result = await eventStore.applyEvent(task_dir, {
          type: request.event_type,
          payload: request.payload,
        });
        return {
          task_dir: task_dir,
          success: result.success,
          error: result.error,
          new_state: result.new_state,
        };
      } catch (e) {
        return {
          task_dir: task_dir,
          success: false,
          error: e.message,
        };
      }
    })
  );

  return {
    results,
    summary: {
      total: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
  };
}
```

### 错误处理

- 批量操作采用**尽力执行**策略，部分失败不影响其他任务
- 返回每个任务的执行结果，前端可展示成功/失败详情
- 不支持事务回滚（任务相互独立）

## 第 7 节：变更摘要

### 状态机变更

| 变更类型 | 内容 |
|----------|------|
| 重命名 | `done` → `completed`, `error` → `failed` |
| 移除 | `pr_created` |
| 新增 | `cancelled` |
| 新增事件 | `CANCEL` |
| 移除事件 | `CREATE_PR` |

### 数据模型变更

```typescript
interface UnifiedTask {
  // 新增字段
  is_template?: boolean;
}

interface TaskMachineContext {
  // 扩展 paused_snapshot
  paused_snapshot?: {
    from_state: XStateValue;
    subtask_index: number;
    execution_context?: Record<string, unknown>;
    paused_at: string;
  };
}
```

### API 变更

| 端点 | 变更 |
|------|------|
| `POST /api/tasks` | 新增 `copy_from`, `is_template` 字段 |
| `PATCH /api/tasks?task_dir=<dir>` | 新增 `is_template` 字段 |
| `GET /api/tasks` | 新增 `is_template` 查询参数 |
| `GET /api/tasks/events/stream` | 新增 `last_sequence` 查询参数 |
| `POST /api/tasks/batch/events` | 新增批量事件端点 |

### 迁移注意事项

1. **状态迁移**：现有 `done` 任务需映射为 `completed`，`error` 映射为 `failed`
2. **事件兼容**：事件历史中的旧状态名称需要兼容处理
3. **pr_created 处理**：现有 `pr_created` 任务可映射为 `completed`
