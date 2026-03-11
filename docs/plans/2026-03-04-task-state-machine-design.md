# Viben Task 状态机系统设计

> 日期: 2026-03-04
> 状态: 已批准

## 概述

为 Viben 引入 XState 状态机、事件序列号机制和丰富的 Metadata 系统，提升任务生命周期管理的可靠性和可追溯性。

## 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 实现范围 | 核心层 + Gateway | 核心统一管理状态，Gateway 负责实时推送 |
| 状态集 | 完全沿用 Auto-Claude | 经过实践验证，QA 循环更灵活 |
| 并发处理 | 严格拒绝 | 实现简单，强制客户端同步 |
| 文件结构 | 合并简化 | 减少碎片，保留 prd.md |
| 数据迁移 | 不迁移 | 新系统干净启动 |

## 现有类型复用分析

### ✅ 可直接复用的类型

以下类型已在 `packages/core/src/services/task-service.ts` 中定义：

```typescript
// 已有 - 直接复用
export type TaskStatus = "backlog" | "queue" | "in_progress" | "ai_review" | "human_review" | "done" | "pr_created" | "error";
export type ReviewReason = "completed" | "errors" | "qa_rejected" | "plan_review" | "stopped";
export type SubtaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type ExecutionPhase = "plan" | "implement" | "check" | "fix" | "complete";

export interface ExecutionProgress {
  phase: ExecutionPhase;
  phaseProgress?: number;
}

export interface SubtaskInfo {
  id: string;
  name: string;
  title?: string;
  status: SubtaskStatus;
  createdAt?: string;
  updatedAt?: string;
}

// 已有 - implementation_plan.json 结构
export interface ImplementationPlanSubtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  files?: string[];
  order?: number;
}

export interface ImplementationPlanFile {
  version?: string;
  task_id?: string;
  subtasks: ImplementationPlanSubtask[];
  created_at?: string;
  updated_at?: string;
}
```

### ✅ 可部分复用的类型

`UnifiedTask` 接口已有大部分字段，需要扩展：

```typescript
// 已有字段 (packages/core/src/services/task-service.ts:75-169)
export interface UnifiedTask {
  // Core Identity - ✅ 已有
  id: string;
  name: string;
  title: string;
  description?: string;

  // Status - ✅ 已有
  status: TaskStatus;
  reviewReason?: ReviewReason;
  current_phase?: number;
  next_action?: Array<{ phase: number; action: string }>;

  // Classification - ✅ 部分已有
  priority: string;           // ✅ 已有
  dev_type?: string;          // ✅ 已有 (backend, frontend, fullstack, test, docs)
  scope?: string;             // ✅ 已有

  // Git - ✅ 已有
  branch?: string;
  base_branch?: string;
  worktree_path?: string;
  commit?: string;
  pr_url?: string;

  // Subtasks - ✅ 已有
  subtasks?: string[];
  subtaskDetails?: SubtaskInfo[];
  executionProgress?: ExecutionProgress;

  // Timestamps - ✅ 已有
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}
```

### 🔨 需要新增的类型

```typescript
// 新增 - 事件系统
export interface TaskEvent {
  eventId: string;
  sequence: number;
  type: TaskEventType;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export type TaskEventType =
  | 'QUEUE' | 'START' | 'DEQUEUE'
  | 'PLAN_COMPLETE' | 'PLAN_FAILED'
  | 'SUBTASK_COMPLETE' | 'ALL_SUBTASKS_DONE' | 'IMPLEMENT_FAILED'
  | 'CHECK_PASSED' | 'CHECK_FAILED' | 'FIX_COMPLETE' | 'FIX_FAILED'
  | 'USER_STOPPED' | 'APPROVED' | 'REJECTED' | 'CREATE_PR'
  | 'RETRY' | 'ABANDON';

// 新增 - XState 状态存储 (ExecutionPhase: plan, implement, check, fix)
export type XStateValue = string | { in_progress: ExecutionPhase };

// 新增 - 元数据扩展
export interface TaskMetadata {
  source: TaskSource;
  classification: TaskClassification;
  agentConfig: AgentConfig;
  gitConfig: GitConfig;
}

export interface TaskSource {
  type: 'manual' | 'github_issue' | 'linear' | 'ideation';
  ref?: string;
  importedAt?: string;
}

export interface TaskClassification {
  category: 'feature' | 'bugfix' | 'refactor' | 'docs';
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: 'P0' | 'P1' | 'P2' | 'P3';  // 与已有 priority 字段对应
}

export interface AgentConfig {
  model?: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
  maxRetries?: number;
}

export interface GitConfig {
  baseBranch?: string;      // 复用已有 base_branch
  branchPrefix?: string;
  useWorktree?: boolean;
}
```

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Desktop App (UI)                        │
│              订阅 SSE 事件，展示状态变化                      │
└──────────────────────────┬──────────────────────────────────┘
                           │ SSE / HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                      Gateway Layer                          │
│  - TaskEventRouter: 接收事件，验证序列号，转发到核心层         │
│  - TaskSSEManager: 管理 SSE 连接，广播状态变化                │
│  - 不持有状态机实例，只做事件路由和推送                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ 函数调用
┌──────────────────────────▼──────────────────────────────────┐
│                       Core Layer                            │
│  - TaskStateMachine: XState 状态机实例，管理状态转换          │
│  - TaskEventStore: 事件序列号验证与持久化                     │
│  - TaskService: 已有，扩展支持新字段                          │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    File System                              │
│  .viben/tasks/<date>-<slug>/                                │
│  ├── task.json    (状态 + 元数据 + 事件历史)                  │
│  ├── implementation_plan.json  (subtasks，已有结构)          │
│  └── prd.md       (需求文档)                                 │
└─────────────────────────────────────────────────────────────┘
```

**数据流：**
1. Agent/UI 发送事件 → Gateway 验证序列号 → Core 执行状态转换 → 持久化 → Gateway SSE 广播

## XState 状态机定义

```typescript
// packages/core/src/task/machine/task-machine.ts
import { createMachine } from 'xstate';
import type { TaskStatus, ReviewReason, ExecutionPhase } from '../services/task-service';

/** 状态机上下文 */
interface TaskMachineContext {
  taskId: string;
  reviewReason?: ReviewReason;
  currentSubtaskIndex: number;
  requiresPlanReview: boolean;
}

export const taskMachine = createMachine({
  id: 'task',
  initial: 'backlog',
  context: {
    taskId: '',
    reviewReason: undefined,
    currentSubtaskIndex: 0,
    requiresPlanReview: false,
  },

  states: {
    backlog: {
      on: {
        QUEUE: 'queue',
        START: 'in_progress',
      }
    },

    queue: {
      on: {
        START: 'in_progress',
        DEQUEUE: 'backlog',
      }
    },

    in_progress: {
      initial: 'plan',
      states: {
        plan: {
          on: {
            PLAN_COMPLETE: [
              { target: 'implement', guard: 'noPlanReviewRequired' },
              { target: '#task.human_review', actions: 'setReviewReason_planReview' }
            ],
            PLAN_FAILED: '#task.error',
          }
        },
        implement: {
          on: {
            SUBTASK_COMPLETE: { target: 'implement', actions: 'markSubtaskDone' },
            ALL_SUBTASKS_DONE: 'check',
            IMPLEMENT_FAILED: '#task.error',
          }
        },
        check: {
          on: {
            CHECK_PASSED: '#task.human_review',
            CHECK_FAILED: 'fix',
          }
        },
        fix: {
          on: {
            FIX_COMPLETE: 'check',
            FIX_FAILED: '#task.error',
          }
        },
      },
      on: {
        USER_STOPPED: [
          { target: 'backlog', guard: 'noProgress' },
          { target: 'human_review', actions: 'setReviewReason_stopped' }
        ],
      }
    },

    human_review: {
      on: {
        APPROVED: 'done',
        REJECTED: 'in_progress.implement',
        CREATE_PR: 'pr_created',
      }
    },

    done: { type: 'final' },
    pr_created: { type: 'final' },
    error: {
      on: {
        RETRY: 'in_progress',
        ABANDON: 'backlog',
      }
    },
  }
});

/** 将 XState 状态值转换为 TaskStatus */
export function xstateToTaskStatus(value: XStateValue): TaskStatus {
  if (typeof value === 'string') {
    return value as TaskStatus;
  }
  // 子状态映射
  if ('in_progress' in value) {
    const phase = value.in_progress;
    if (phase === 'check' || phase === 'fix') {
      return 'ai_review';
    }
    return 'in_progress';
  }
  return 'backlog';
}
```

**关键点：**
- 复用已有的 `TaskStatus`, `ReviewReason`, `ExecutionPhase` 类型
- `xstateToTaskStatus()` 函数将 XState 状态映射到已有的 TaskStatus
- 子状态 `check`/`fix` 映射到 `ai_review` 保持兼容

## 事件序列号机制

```typescript
// packages/core/src/task/events/task-event.ts
import type { TaskEventType } from './event-types';

/** 任务事件结构 - 新增 */
export interface TaskEvent {
  eventId: string;           // UUID，事件唯一标识
  sequence: number;          // 递增序列号
  type: TaskEventType;       // 事件类型
  timestamp: string;         // ISO 时间戳
  payload?: Record<string, unknown>;  // 事件附加数据
}

// packages/core/src/task/events/event-types.ts

/** 事件类型枚举 - 新增 */
export type TaskEventType =
  | 'QUEUE' | 'START' | 'DEQUEUE'
  | 'PLAN_COMPLETE' | 'PLAN_FAILED'
  | 'SUBTASK_COMPLETE' | 'ALL_SUBTASKS_DONE' | 'IMPLEMENT_FAILED'
  | 'CHECK_PASSED' | 'CHECK_FAILED' | 'FIX_COMPLETE' | 'FIX_FAILED'
  | 'USER_STOPPED' | 'APPROVED' | 'REJECTED' | 'CREATE_PR'
  | 'RETRY' | 'ABANDON';

// packages/core/src/task/events/event-store.ts
import type { UnifiedTask } from '../../services/task-service';
import type { TaskEvent } from './task-event';
import { taskMachine, xstateToTaskStatus } from '../machine/task-machine';

export interface ApplyResult {
  success: boolean;
  error?: 'SEQUENCE_MISMATCH' | 'INVALID_TRANSITION';
  expected?: number;
  received?: number;
  currentState?: string;
  newState?: string;
}

export class TaskEventStore {
  constructor(private taskService: TaskService) {}

  /** 验证并应用事件 */
  async applyEvent(taskDir: string, event: TaskEvent): Promise<ApplyResult> {
    const task = await this.taskService.getTask(taskDir);
    if (!task) {
      return { success: false, error: 'INVALID_TRANSITION' };
    }

    const expectedSeq = (task.lastEvent?.sequence ?? 0) + 1;

    // 严格序列号检查
    if (event.sequence !== expectedSeq) {
      return {
        success: false,
        error: 'SEQUENCE_MISMATCH',
        expected: expectedSeq,
        received: event.sequence,
      };
    }

    // 验证状态机是否接受此事件
    const currentXState = task.xstateState ?? 'backlog';
    const nextState = taskMachine.transition(currentXState, { type: event.type });

    if (!nextState.changed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        currentState: JSON.stringify(currentXState),
      };
    }

    // 更新任务
    const newStatus = xstateToTaskStatus(nextState.value);
    await this.taskService.updateTask(taskDir, {
      status: newStatus,
      xstateState: nextState.value,
      lastEvent: event,
      eventHistory: [...(task.eventHistory ?? []), event],
    });

    return { success: true, newState: JSON.stringify(nextState.value) };
  }
}
```

## 文件结构与 Metadata Schema

### task.json - 扩展 UnifiedTask

```typescript
// packages/core/src/services/task-service.ts - 扩展现有 UnifiedTask

export interface UnifiedTask {
  // === 已有字段 (保持不变) ===
  id: string;
  name: string;
  title: string;
  description?: string;
  status: TaskStatus;
  reviewReason?: ReviewReason;
  current_phase?: number;
  next_action?: Array<{ phase: number; action: string }>;
  priority: string;
  dev_type?: string;
  scope?: string;
  creator?: string;
  assignee?: string;
  branch?: string;
  base_branch?: string;
  worktree_path?: string;
  commit?: string;
  pr_url?: string;
  subtasks?: string[];
  subtaskDetails?: SubtaskInfo[];
  executionProgress?: ExecutionProgress;
  relatedFiles?: string[];
  notes?: string;
  agent?: string;
  sessionId?: string;
  taskIndex?: number;
  prompt?: string;
  cost?: number;
  duration?: number;
  favorite?: boolean;
  hasInProgressAttempt?: boolean;
  lastAttemptFailed?: boolean;
  executor?: string;
  workspacePath?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;

  // === 新增字段 ===
  /** XState 状态机当前状态 */
  xstateState?: XStateValue;
  /** 最后一个事件 */
  lastEvent?: TaskEvent;
  /** 事件历史 */
  eventHistory?: TaskEvent[];
  /** 扩展元数据 */
  metadata?: TaskMetadata;
}

/** XState 状态值类型 */
export type XStateValue = string | { in_progress: ExecutionPhase };

/** 扩展元数据 - 新增 */
export interface TaskMetadata {
  source?: TaskSource;
  classification?: TaskClassification;
  agentConfig?: AgentConfig;
  gitConfig?: GitConfig;
}

export interface TaskSource {
  type: 'manual' | 'github_issue' | 'linear' | 'ideation';
  ref?: string;
  importedAt?: string;
}

export interface TaskClassification {
  category: 'feature' | 'bugfix' | 'refactor' | 'docs';
  complexity: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

export interface AgentConfig {
  model?: string;
  thinkingLevel?: 'low' | 'medium' | 'high';
  maxRetries?: number;
}

export interface GitConfig {
  baseBranch?: string;
  branchPrefix?: string;
  useWorktree?: boolean;
}
```

### implementation_plan.json - 复用已有结构

```typescript
// 已有 - packages/core/src/services/task-service.ts:849-867

export interface ImplementationPlanFile {
  version?: string;
  task_id?: string;
  subtasks: ImplementationPlanSubtask[];
  created_at?: string;
  updated_at?: string;
}

export interface ImplementationPlanSubtask {
  id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;  // 复用已有类型
  files?: string[];
  order?: number;
}

// 新增 - 扩展支持 phases 和 verification
export interface ImplementationPlanFileV2 extends ImplementationPlanFile {
  phases?: Phase[];
  currentPhase?: number;
  progress?: {
    completedSubtasks: number;
    totalSubtasks: number;
    percentage: number;
  };
}

export interface Phase {
  id: number;
  name: string;
  type: 'plan' | 'implement' | 'check';
  subtasks: ImplementationPlanSubtask[];
}

// 扩展 subtask 支持 verification
export interface ImplementationPlanSubtaskV2 extends ImplementationPlanSubtask {
  verification?: {
    type: 'command' | 'browser';
    run?: string;
    scenario?: string;
  };
}
```

### 文件目录结构

```
.viben/tasks/03-04-user-auth/
├── task.json                    # UnifiedTask (扩展后)
├── implementation_plan.json     # ImplementationPlanFile (已有)
├── prd.md                       # PRD 文档 (已有)
└── logs/                        # 执行日志 (已有)
    ├── plan.log
    ├── implement.log
    └── check.log

.viben/specs/                    # 技术规格单独存放
```

## Gateway 层实现

```typescript
// packages/core/src/gateway/routes/task-events.ts
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { TaskEventStore } from '../../task/events/event-store';
import { TaskSSEManager } from '../sse/task-sse-manager';
import { taskService } from '../../services/task-service';
import type { TaskEvent } from '../../task/events/task-event';

export function createTaskEventRoutes(app: Hono) {
  const eventStore = new TaskEventStore(taskService);
  const sseManager = new TaskSSEManager();

  // POST /api/tasks/:task_id/events - 提交事件
  app.post('/api/tasks/:task_id/events', async (c) => {
    const taskId = c.req.param('task_id');
    const workspacePath = c.req.query('workspace_path');  // 遵循 snake_case 约定

    if (!workspacePath) {
      return c.json({ error: 'workspace_path required' }, 400);
    }

    const taskDir = await taskService.findTaskById(workspacePath, taskId);
    if (!taskDir) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const event = await c.req.json<TaskEvent>();
    const result = await eventStore.applyEvent(taskDir, event);

    if (!result.success) {
      return c.json({
        error: result.error,
        expected: result.expected,
        received: result.received,
        current_state: result.currentState,
      }, 409);
    }

    // 广播状态变化
    sseManager.broadcast(taskId, {
      type: 'STATE_CHANGED',
      task_id: taskId,
      event,
      new_state: result.newState,
    });

    return c.json({ success: true, new_state: result.newState });
  });

  // GET /api/tasks/:task_id/events/stream - SSE 订阅
  app.get('/api/tasks/:task_id/events/stream', (c) => {
    const taskId = c.req.param('task_id');

    return streamSSE(c, async (stream) => {
      const unsubscribe = sseManager.subscribe(taskId, async (event) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      stream.onAbort(() => unsubscribe());
    });
  });

  // GET /api/tasks/:task_id/state - 获取当前状态
  app.get('/api/tasks/:task_id/state', async (c) => {
    const taskId = c.req.param('task_id');
    const workspacePath = c.req.query('workspace_path');

    if (!workspacePath) {
      return c.json({ error: 'workspace_path required' }, 400);
    }

    const taskDir = await taskService.findTaskById(workspacePath, taskId);
    if (!taskDir) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const task = await taskService.getTask(taskDir);

    return c.json({
      task_id: taskId,
      status: task?.status,
      xstate_state: task?.xstateState,
      last_event: task?.lastEvent,
      review_reason: task?.reviewReason,
    });
  });
}
```

## 错误处理与恢复机制

```typescript
// packages/core/src/task/recovery/task-recovery.ts
import { taskService, type UnifiedTask } from '../../services/task-service';
import { TaskEventStore } from '../events/event-store';
import { TaskSSEManager } from '../../gateway/sse/task-sse-manager';
import type { TaskEvent } from '../events/task-event';

export class TaskRecoveryService {
  constructor(
    private eventStore: TaskEventStore,
    private sseManager: TaskSSEManager,
  ) {}

  /** 启动时恢复所有进行中的任务 */
  async recoverOnStartup(workspacePath: string): Promise<void> {
    const tasks = await taskService.listTasks(workspacePath);
    const activeTasks = tasks.filter(t =>
      taskService.isActiveState(t.status)  // 复用已有方法
    );

    for (const task of activeTasks) {
      if (this.isStuck(task)) {
        await this.handleStuckTask(workspacePath, task);
      }
    }
  }

  /** 判断任务是否卡死 */
  private isStuck(task: UnifiedTask): boolean {
    if (!task.lastEvent) return false;

    const lastEventTime = new Date(task.lastEvent.timestamp).getTime();
    const now = Date.now();
    const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 分钟

    return now - lastEventTime > STUCK_THRESHOLD;
  }

  /** 处理卡死任务 */
  private async handleStuckTask(workspacePath: string, task: UnifiedTask): Promise<void> {
    const taskDir = await taskService.findTaskById(workspacePath, task.id);
    if (!taskDir) return;

    const event: TaskEvent = {
      eventId: crypto.randomUUID(),
      sequence: (task.lastEvent?.sequence ?? 0) + 1,
      type: 'USER_STOPPED',
      timestamp: new Date().toISOString(),
      payload: { reason: 'stuck_detected', autoRecovery: true },
    };

    await this.eventStore.applyEvent(taskDir, event);

    this.sseManager.broadcast(task.id, {
      type: 'TASK_RECOVERED',
      task_id: task.id,
      reason: 'stuck_detected',
    });
  }
}
```

### 错误场景处理

| 场景 | 处理方式 |
|------|----------|
| 序列号冲突 | 返回 409，客户端调用 resync 重新获取状态 |
| 无效状态转换 | 返回 409，告知当前状态和拒绝的事件类型 |
| Agent 崩溃 | stuck 检测后自动移到 human_review |
| Gateway 重启 | 从 task.json 恢复状态机，重建 SSE 连接 |
| 客户端断连重连 | 调用 resync 获取缺失事件，追赶到最新状态 |

## 实现文件结构

```
packages/core/src/
├── task/                          # 🆕 新增目录
│   ├── machine/
│   │   ├── task-machine.ts        # XState 状态机定义
│   │   ├── guards.ts              # 状态转换守卫条件
│   │   └── actions.ts             # 状态转换动作
│   │
│   ├── events/
│   │   ├── task-event.ts          # TaskEvent 接口
│   │   ├── event-store.ts         # 事件验证与持久化
│   │   └── event-types.ts         # TaskEventType 类型
│   │
│   ├── recovery/
│   │   └── task-recovery.ts       # 恢复与 stuck 检测
│   │
│   └── index.ts                   # 公共 API 导出

├── services/
│   └── task-service.ts            # ✅ 已有，扩展 UnifiedTask

├── gateway/
│   ├── routes/
│   │   ├── tasks.ts               # ✅ 已有
│   │   └── task-events.ts         # 🆕 新增事件路由
│   │
│   └── sse/
│       └── task-sse-manager.ts    # 🆕 新增 SSE 管理
```

### 依赖关系

```
task-machine.ts (🆕)
       ↓
event-store.ts (🆕) ← task-service.ts (✅ 扩展)
       ↓
task-events.ts (🆕 Gateway)
       ↓
task-sse-manager.ts (🆕)
```

### 新增依赖

```json
// packages/core/package.json
{
  "dependencies": {
    "xstate": "^5.18.0"
  }
}
```

## 类型变更摘要

| 文件 | 操作 | 说明 |
|------|------|------|
| `services/task-service.ts` | 扩展 | 新增 `xstateState`, `lastEvent`, `eventHistory`, `metadata` 字段 |
| `task/events/task-event.ts` | 新增 | `TaskEvent` 接口 |
| `task/events/event-types.ts` | 新增 | `TaskEventType` 类型 |
| `task/machine/task-machine.ts` | 新增 | XState 状态机定义 |
| `gateway/routes/task-events.ts` | 新增 | 事件 API 路由 |
| `gateway/sse/task-sse-manager.ts` | 新增 | SSE 连接管理 |

## 下一步

准备好实现时：
1. 使用 `superpowers:using-git-worktrees` 创建隔离工作区
2. 使用 `superpowers:writing-plans` 创建详细实现计划
