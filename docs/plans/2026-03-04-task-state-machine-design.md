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
│  - TaskFileManager: task.json / plan.json / prd.md 读写      │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    File System                              │
│  .viben/tasks/<date>-<slug>/                                │
│  ├── task.json    (状态 + 元数据 + 事件历史)                  │
│  ├── plan.json    (subtasks + phases)                       │
│  └── prd.md       (需求文档)                                 │
└─────────────────────────────────────────────────────────────┘
```

**数据流：**
1. Agent/UI 发送事件 → Gateway 验证序列号 → Core 执行状态转换 → 持久化 → Gateway SSE 广播

## XState 状态机定义

```typescript
// packages/core/src/task/machine/task-machine.ts
import { createMachine } from 'xstate';

export const taskMachine = createMachine({
  id: 'task',
  initial: 'backlog',

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
      initial: 'planning',
      states: {
        planning: {
          on: {
            PLANNING_COMPLETE: [
              { target: 'coding', guard: 'noPlanReviewRequired' },
              { target: '#task.human_review', actions: 'setReviewReason_planReview' }
            ],
            PLANNING_FAILED: '#task.error',
          }
        },
        coding: {
          on: {
            SUBTASK_COMPLETE: { target: 'coding', actions: 'markSubtaskDone' },
            ALL_SUBTASKS_DONE: 'qa_review',
            CODING_FAILED: '#task.error',
          }
        },
        qa_review: {
          on: {
            QA_PASSED: '#task.human_review',
            QA_FAILED: 'qa_fixing',
          }
        },
        qa_fixing: {
          on: {
            QA_FIXING_COMPLETE: 'qa_review',
            QA_FIXING_FAILED: '#task.error',
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
        REJECTED: 'in_progress.coding',
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
```

**关键点：**
- 使用 XState v5 语法
- `human_review` 的原因通过 `context.reviewReason` 追踪
- Guards 控制条件转换（如是否需要 plan review）
- 子状态支持 `#task.xxx` 跳转到顶层状态

## 事件序列号机制

```typescript
// packages/core/src/task/events/task-event.ts

/** 任务事件结构 */
export interface TaskEvent {
  eventId: string;           // UUID，事件唯一标识
  sequence: number;          // 递增序列号
  type: TaskEventType;       // 事件类型
  timestamp: string;         // ISO 时间戳
  payload?: Record<string, unknown>;  // 事件附加数据
}

/** 事件类型枚举 */
export type TaskEventType =
  | 'QUEUE' | 'START' | 'DEQUEUE'
  | 'PLANNING_COMPLETE' | 'PLANNING_FAILED'
  | 'SUBTASK_COMPLETE' | 'ALL_SUBTASKS_DONE' | 'CODING_FAILED'
  | 'QA_PASSED' | 'QA_FAILED' | 'QA_FIXING_COMPLETE' | 'QA_FIXING_FAILED'
  | 'USER_STOPPED' | 'APPROVED' | 'REJECTED' | 'CREATE_PR'
  | 'RETRY' | 'ABANDON';

// packages/core/src/task/events/event-store.ts

export class TaskEventStore {
  /** 验证并应用事件 */
  async applyEvent(taskId: string, event: TaskEvent): Promise<ApplyResult> {
    const task = await this.loadTask(taskId);
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
    const nextState = this.machine.transition(task.xstateState, event.type);
    if (!nextState.changed) {
      return {
        success: false,
        error: 'INVALID_TRANSITION',
        currentState: task.xstateState,
        event: event.type,
      };
    }

    // 更新并持久化
    task.xstateState = nextState.value;
    task.lastEvent = event;
    task.eventHistory.push(event);
    await this.saveTask(task);

    return { success: true, newState: nextState.value };
  }
}
```

**关键点：**
- `sequence` 必须严格递增，不连续直接拒绝
- 状态机验证事件是否在当前状态有效
- `eventHistory` 保留完整事件日志用于调试
- `lastEvent` 用于快速获取当前序列号

## 文件结构与 Metadata Schema

### task.json

```typescript
/** task.json 完整结构 */
export interface TaskFile {
  // === 基础信息 ===
  id: string;
  name: string;                    // URL-safe slug
  title: string;
  description?: string;

  // === 状态机 ===
  status: TaskStatus;              // 主状态
  xstateState: string | object;    // XState 当前状态（含子状态）
  reviewReason?: ReviewReason;     // human_review 原因

  // === 事件 ===
  lastEvent?: TaskEvent;
  eventHistory: TaskEvent[];

  // === 元数据 ===
  metadata: TaskMetadata;

  // === 时间戳 ===
  createdAt: string;
  updatedAt: string;
}

/** 元数据结构 */
export interface TaskMetadata {
  // 来源追踪
  source: {
    type: 'manual' | 'github_issue' | 'linear' | 'ideation';
    ref?: string;          // issue URL / linear ID 等
    importedAt?: string;
  };

  // 分类标签
  classification: {
    category: 'feature' | 'bugfix' | 'refactor' | 'docs';
    complexity: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    priority: 'P0' | 'P1' | 'P2' | 'P3';
  };

  // Agent 配置
  agentConfig: {
    model?: string;
    thinkingLevel?: 'low' | 'medium' | 'high';
    maxRetries?: number;
  };

  // Git 配置
  gitConfig: {
    baseBranch?: string;
    branchPrefix?: string;
    useWorktree?: boolean;
  };
}
```

### plan.json

```typescript
/** plan.json 结构 */
export interface PlanFile {
  phases: Phase[];
  currentPhase: number;

  // 执行进度
  progress: {
    completedSubtasks: number;
    totalSubtasks: number;
    percentage: number;
  };
}

export interface Phase {
  id: number;
  name: string;
  type: 'planning' | 'implementation' | 'qa';
  subtasks: Subtask[];
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  files: string[];
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
├── task.json      # TaskFile 结构
├── plan.json      # PlanFile 结构
└── prd.md         # Markdown 需求文档

.viben/specs/      # 技术规格单独存放
```

## Gateway 层实现

```typescript
// packages/core/src/gateway/routes/task-events.ts

/** 事件路由器 - 接收并转发事件 */
export function createTaskEventRoutes(app: Hono) {
  const eventStore = new TaskEventStore();
  const sseManager = new TaskSSEManager();

  // POST /api/tasks/:taskId/events - 提交事件
  app.post('/api/tasks/:task_id/events', async (c) => {
    const taskId = c.req.param('task_id');
    const event = await c.req.json<TaskEvent>();

    const result = await eventStore.applyEvent(taskId, event);

    if (!result.success) {
      // 序列号不匹配或无效转换，返回 409 Conflict
      return c.json({
        error: result.error,
        expected: result.expected,
        received: result.received,
        currentState: result.currentState,
      }, 409);
    }

    // 广播状态变化给所有订阅者
    sseManager.broadcast(taskId, {
      type: 'STATE_CHANGED',
      taskId,
      event,
      newState: result.newState,
    });

    return c.json({ success: true, newState: result.newState });
  });

  // GET /api/tasks/:taskId/events/stream - SSE 订阅
  app.get('/api/tasks/:task_id/events/stream', (c) => {
    const taskId = c.req.param('task_id');

    return streamSSE(c, async (stream) => {
      const unsubscribe = sseManager.subscribe(taskId, async (event) => {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      // 连接关闭时清理
      stream.onAbort(() => unsubscribe());
    });
  });

  // GET /api/tasks/:taskId/state - 获取当前状态（用于重连同步）
  app.get('/api/tasks/:task_id/state', async (c) => {
    const taskId = c.req.param('task_id');
    const task = await eventStore.loadTask(taskId);

    return c.json({
      taskId,
      status: task.status,
      xstateState: task.xstateState,
      lastEvent: task.lastEvent,
      reviewReason: task.reviewReason,
    });
  });
}
```

### 客户端使用流程

```typescript
// 1. 获取当前状态和序列号
const state = await fetch(`/api/tasks/${taskId}/state`).then(r => r.json());
let currentSeq = state.lastEvent?.sequence ?? 0;

// 2. 订阅 SSE
const sse = new EventSource(`/api/tasks/${taskId}/events/stream`);
sse.addEventListener('STATE_CHANGED', (e) => {
  const data = JSON.parse(e.data);
  updateUI(data.newState);
  currentSeq = data.event.sequence;
});

// 3. 发送事件时带上正确的序列号
async function sendEvent(type: TaskEventType) {
  const event = {
    eventId: crypto.randomUUID(),
    sequence: currentSeq + 1,
    type,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(`/api/tasks/${taskId}/events`, {
    method: 'POST',
    body: JSON.stringify(event),
  });

  if (res.status === 409) {
    // 序列号冲突，重新获取状态
    await resyncState();
  }
}
```

## 错误处理与恢复机制

```typescript
// packages/core/src/task/recovery/task-recovery.ts

export class TaskRecoveryService {
  constructor(
    private eventStore: TaskEventStore,
    private sseManager: TaskSSEManager,
  ) {}

  /** 启动时恢复所有进行中的任务 */
  async recoverOnStartup(): Promise<void> {
    const tasks = await this.eventStore.findByStatus(['in_progress', 'queue']);

    for (const task of tasks) {
      // 从 xstateState 恢复状态机实例
      const restoredMachine = this.eventStore.restoreMachine(task.xstateState);

      // 检查是否卡死（超过阈值无新事件）
      if (this.isStuck(task)) {
        await this.handleStuckTask(task);
      }
    }
  }

  /** 判断任务是否卡死 */
  private isStuck(task: TaskFile): boolean {
    if (!task.lastEvent) return false;

    const lastEventTime = new Date(task.lastEvent.timestamp).getTime();
    const now = Date.now();
    const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 分钟

    return now - lastEventTime > STUCK_THRESHOLD;
  }

  /** 处理卡死任务 */
  private async handleStuckTask(task: TaskFile): Promise<void> {
    // 生成系统事件，将任务移回 human_review
    const event: TaskEvent = {
      eventId: crypto.randomUUID(),
      sequence: (task.lastEvent?.sequence ?? 0) + 1,
      type: 'USER_STOPPED',
      timestamp: new Date().toISOString(),
      payload: { reason: 'stuck_detected', autoRecovery: true },
    };

    await this.eventStore.applyEvent(task.id, event);

    // 通知订阅者
    this.sseManager.broadcast(task.id, {
      type: 'TASK_RECOVERED',
      taskId: task.id,
      reason: 'stuck_detected',
    });
  }

  /** 客户端重连时同步状态 */
  async resyncClient(taskId: string, clientSeq: number): Promise<ResyncResult> {
    const task = await this.eventStore.loadTask(taskId);
    const serverSeq = task.lastEvent?.sequence ?? 0;

    if (clientSeq === serverSeq) {
      return { inSync: true };
    }

    // 返回客户端缺失的事件
    const missedEvents = task.eventHistory.filter(e => e.sequence > clientSeq);

    return {
      inSync: false,
      currentState: task.xstateState,
      missedEvents,
      latestSeq: serverSeq,
    };
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
├── task/
│   ├── machine/
│   │   ├── task-machine.ts       # XState 状态机定义
│   │   ├── guards.ts             # 状态转换守卫条件
│   │   └── actions.ts            # 状态转换动作
│   │
│   ├── events/
│   │   ├── task-event.ts         # 事件类型定义
│   │   ├── event-store.ts        # 事件验证与持久化
│   │   └── event-types.ts        # 事件类型枚举
│   │
│   ├── storage/
│   │   ├── task-file-manager.ts  # task.json 读写
│   │   ├── plan-file-manager.ts  # plan.json 读写
│   │   └── prd-file-manager.ts   # prd.md 读写
│   │
│   ├── recovery/
│   │   └── task-recovery.ts      # 恢复与 stuck 检测
│   │
│   ├── types/
│   │   ├── task-file.ts          # TaskFile, TaskMetadata
│   │   ├── plan-file.ts          # PlanFile, Phase, Subtask
│   │   └── index.ts              # 类型导出
│   │
│   └── index.ts                  # 公共 API 导出

├── gateway/
│   ├── routes/
│   │   └── task-events.ts        # 事件 API 路由
│   │
│   └── sse/
│       └── task-sse-manager.ts   # SSE 连接管理
```

### 依赖关系

```
task-machine.ts
       ↓
event-store.ts ← task-file-manager.ts
       ↓
task-events.ts (Gateway)
       ↓
task-sse-manager.ts
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

## 下一步

准备好实现时：
1. 使用 `superpowers:using-git-worktrees` 创建隔离工作区
2. 使用 `superpowers:writing-plans` 创建详细实现计划
