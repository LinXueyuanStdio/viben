# Task API 重构设计

## 背景

将 `/api/queue/*` 和 `/api/tasks/*` 合并为统一的 `/api/task/*` 端点，采用 CLI-first 设计，所有接口使用 POST 方法，通过 `task_dir` query 参数指定任务。

## 设计原则

1. **CLI-First**: API 端点与 CLI 命令一一对应（命名完全匹配）
2. **统一 POST**: 所有端点使用 POST 方法（简化前端调用）
3. **task_dir 参数**: 使用 `?task_dir=/path/to/task` 标识任务
4. **workspace_path 必需**: 列表类操作需要 `workspace_path`

## API 端点设计

### 基础 URL

```
POST /api/task/{action}?task_dir=<path>&workspace_path=<path>
```

### 端点清单

#### CRUD 操作

| 端点 | 对应 CLI | 参数 | 描述 |
|------|----------|------|------|
| `POST /api/task/list` | `viben task list` | Query: `workspace_path` (必需), `status?`, `assignee?` | 列出任务 |
| `POST /api/task/create` | `viben task create` | Query: `workspace_path`, Body: `CreateTaskInput` | 创建任务 |
| `POST /api/task/view` | `viben task view` | Query: `task_dir` | 查看任务详情 |
| `POST /api/task/edit` | `viben task edit` | Query: `task_dir`, Body: `UpdateTaskInput` | 编辑任务 |
| `POST /api/task/delete` | `viben task delete` | Query: `task_dir`, Body: `force?` | 删除任务 |

#### 状态生命周期操作

| 端点 | 对应 CLI | 参数 | 事件 | 描述 |
|------|----------|------|------|------|
| `POST /api/task/enqueue` | `viben task enqueue` | Query: `task_dir`, Body: `agent?`, `executor?`, `model?`, `priority?` | QUEUE | backlog → queue |
| `POST /api/task/dequeue` | `viben task dequeue` | Query: `task_dir` | DEQUEUE | queue → backlog |
| `POST /api/task/start` | `viben task start` | Query: `task_dir`, Body: `resume?` | START | 设为当前任务 + queue → in_progress + 触发执行 |
| `POST /api/task/finish` | `viben task finish <task>` | Query: `task_dir` | - | 完成指定任务 |
| `POST /api/task/pause` | `viben task pause` | Query: `task_dir` | PAUSE | in_progress/queue → paused |
| `POST /api/task/resume` | `viben task resume` | Query: `task_dir` | RESUME | paused → queue/in_progress |
| `POST /api/task/approve` | `viben task approve` | Query: `task_dir` | APPROVED | review → completed |
| `POST /api/task/reject` | `viben task reject` | Query: `task_dir`, Body: `reason?` | REJECTED | review → backlog |
| `POST /api/task/retry` | `viben task retry` | Query: `task_dir` | RETRY | failed → queue |
| `POST /api/task/cancel` | - | Query: `task_dir` | CANCEL | * → cancelled |
| `POST /api/task/archive` | `viben task archive` | Query: `task_dir` | ARCHIVE | completed → archived |
| `POST /api/task/list-archive` | `viben task list-archive` | Query: `workspace_path`, Body: `month?` | - | 列出归档任务 |

#### 配置操作

| 端点 | 对应 CLI | 参数 | 描述 |
|------|----------|------|------|
| `POST /api/task/set-branch` | `viben task set-branch` | Query: `task_dir`, Body: `branch` | 设置 Git 分支 |
| `POST /api/task/set-base` | `viben task set-base` | Query: `task_dir`, Body: `branch` | 设置 PR 目标分支 |
| `POST /api/task/set-agent` | `viben task set-agent` | Query: `task_dir`, Body: `agent` | 设置关联 agent |

#### 上下文管理操作

| 端点 | 对应 CLI | 参数 | 描述 |
|------|----------|------|------|
| `POST /api/task/init-context` | `viben task init-context` | Query: `task_dir`, Body: `type` (backend/frontend/fullstack) | 初始化上下文 |
| `POST /api/task/add-context` | `viben task add-context` | Query: `task_dir`, Body: `files[]`, `reason?`, `recursive?` | 添加上下文 |
| `POST /api/task/remove-context` | `viben task remove-context` | Query: `task_dir`, Body: `files[]` | 移除上下文 |
| `POST /api/task/list-context` | `viben task list-context` | Query: `task_dir` | 列出上下文 |
| `POST /api/task/validate-context` | `viben task validate-context` | Query: `task_dir` | 验证上下文 |

#### 规划与监控操作

| 端点 | 对应 CLI | 参数 | 描述 |
|------|----------|------|------|
| `POST /api/task/plan` | `viben task plan` | Body: `name`, `type`, `requirement`, `platform?` | 启动 Plan Agent |
| `POST /api/task/status` | `viben task status` | Query: `task_dir?` 或 `workspace_path?`, Body: `options` | 获取状态详情 |
| `POST /api/task/create-pr` | `viben task create-pr` | Query: `task_dir?`, Body: `dry_run?` | 从任务创建 PR |
| `POST /api/task/review` | `viben task review` | Query: `task_dir` | 查看待审核任务详情 |

#### 会话操作

| 端点 | 对应 CLI | 参数 | 描述 |
|------|----------|------|------|
| `POST /api/task/context` | `viben task context <task>` | Query: `task_dir`, Body: `json?` | 获取指定任务的 AI 会话上下文 |
| `POST /api/task/add-session` | `viben task add-session` | Query: `workspace_path?`, Body: `title`, `commit?`, `summary?`, `content?` | 添加会话记录 |

#### 执行控制操作 (原 Queue 功能整合)

| 端点 | 原端点 | 参数 | 描述 |
|------|--------|------|------|
| `POST /api/task/execute` | `POST /api/queue/enqueue` | Query: `task_dir`, Body: `ExecuteInput` | 触发任务执行 |
| `POST /api/task/stop` | `DELETE /api/queue/tasks/:id` | Query: `task_dir` | 停止任务执行 |
| `POST /api/task/running` | `GET /api/queue/tasks/:id/running` | Query: `task_dir` | 检查执行状态 |

#### 队列管理操作

| 端点 | 原端点 | 参数 | 描述 |
|------|--------|------|------|
| `POST /api/task/queue-status` | `GET /api/queue/status` | Query: `workspace_path?` | 获取队列状态 |
| `POST /api/task/queue-config` | `GET/PUT /api/queue/config` | Body: `config?` (有则更新) | 获取/更新队列配置 |
| `POST /api/task/batch-enqueue` | `POST /api/queue/enqueue-batch` | Query: `workspace_path`, Body: `task_dirs[]` | 批量入队 |
| `POST /api/task/clear-history` | `POST /api/queue/clear-history` | - | 清除执行历史 |

#### 事件操作

| 端点 | 描述 |
|------|------|
| `POST /api/task/events` | Query: `task_dir`, Body: `since?` | 获取事件历史 |
| `POST /api/task/specs` | Query: `task_dir` | 获取 PRD/子任务/日志 |

#### 流式端点 (保持 GET)

| 端点 | 描述 |
|------|------|
| `GET /api/task/events-stream?task_dir=<path>` | SSE 事件订阅 |
| `GET /api/task/execution-stream?task_dir=<path>` | SSE 执行进度 |

---

## 请求/响应格式

### 通用响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### 主要输入类型

```typescript
// 创建任务
interface CreateTaskInput {
  title: string;
  slug?: string;
  description?: string;
  assignee?: string;
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  agent?: string;
  dev_type?: 'frontend' | 'backend' | 'fullstack';
}

// 更新任务
interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  // ... 其他可更新字段
}

// 执行任务
interface ExecuteInput {
  agent_id: string;
  input?: string;           // 初始 prompt
  model?: string;           // 模型 ID
  executor?: string;        // 执行器类型
  max_retries?: number;
  attachments?: Attachment[];
}

// 队列配置
interface QueueConfig {
  max_concurrency: number;
  persist_debounce_ms?: number;
  auto_retry?: boolean;
  max_retry_count?: number;
}
```

---

## 状态转换图

```
              QUEUE                  START
  backlog ─────────► queue ─────────► in_progress
     ▲                 │                   │
     │    DEQUEUE      │                   │ (内部事件)
     └─────────────────┘                   ▼
     ▲                              review
     │    REJECTED                        │
     └────────────────────────────────────┤
                                          │ APPROVED
                                          ▼
                                      completed
                                          │ ARCHIVE
                                          ▼
                                       archived

  暂停/恢复:
    queue/in_progress ──PAUSE──► paused ──RESUME──► queue/in_progress

  失败/重试:
    in_progress ──FAIL──► failed ──RETRY──► queue

  取消:
    任意状态 ──CANCEL──► cancelled
```

---

## 实现状态

### ✅ 全部实现完成 (43/43)

#### task.ts (7 个)
- ✅ `list`, `create`, `view`, `edit`, `delete`
- ✅ `enqueue`, `dequeue`

#### tasks.ts (36 个)
- ✅ 状态生命周期: `start`, `finish`, `pause`, `resume`, `approve`, `reject`, `retry`, `cancel`, `archive`, `list-archive`
- ✅ 配置: `set-branch`, `set-base`, `set-agent`
- ✅ 上下文: `init-context`, `add-context`, `remove-context`, `list-context`, `validate-context`
- ✅ 执行控制: `execute`, `stop`, `running`
- ✅ 队列管理: `queue-status`, `queue-config`, `batch-enqueue`, `clear-history`
- ✅ 事件: `events`, `specs`
- ✅ 流式: `events-stream`, `execution-stream`
- ✅ 规划监控: `plan`, `status`, `create-pr`, `review`
- ✅ 会话: `context`, `add-session`

---

## 迁移计划

### Phase 1: 创建新路由文件 ✅ 完成

1. ✅ 创建 `packages/core/src/gateway/routes/task.ts`
2. ✅ 实现全部 43 个端点，复用现有 `taskService` 和 `TaskQueueManager`
3. ✅ 保持旧端点工作 (向后兼容)

### Phase 2: 迁移前端调用

1. 更新 `apps/desktop/src/lib/gateway/modules/tasks.ts`
2. 更新所有调用方 (kanban, action-buttons 等)
3. 测试所有功能

### Phase 3: 移除旧端点

1. 标记旧端点为 deprecated
2. 下个版本移除 `/api/queue/*` 和旧 `/api/tasks/*`

---

## 文件变更清单

### 新增文件

- ✅ `packages/core/src/gateway/routes/task.ts` - 新 Task API 路由 (7 个端点)

### 修改文件

- ✅ `packages/core/src/gateway/routes/index.ts` - 注册新路由
- ✅ `packages/core/src/gateway/routes/tasks.ts` - 添加 30 个新端点
- ⏳ `apps/desktop/src/lib/gateway/modules/tasks.ts` - 前端客户端
- ⏳ `apps/desktop/src/lib/gateway/client.ts` - GatewayClient 类
- ⏳ `apps/desktop/src/components/workspace/kanban/*.tsx` - 看板组件
- ⏳ `packages/core/src/cli/commands/queue.ts` - CLI queue 命令 (调用新 API)

### 废弃文件 (Phase 3 移除)

- `packages/core/src/gateway/routes/queue.ts`
- `packages/core/src/gateway/routes/task-events.ts`
