# 任务系统改进设计

> 基于 `.trellis/spec/modules/task-system.md` 的设计审查，识别并解决 7 个设计问题。

## 背景

现有任务系统规范存在以下问题：
1. 状态系统不统一（队列系统与任务系统各有一套状态）
2. `ai_review` 状态冗余
3. 事件历史存储在 task.json 中导致文件膨胀
4. 缺少任务暂停/恢复机制
5. SSE 不支持批量订阅，多任务监控需要多个连接
6. 任务之间缺少依赖关系
7. 优先级不影响实际调度

## 改进设计

### 1. 状态机重构

#### 1.1 统一 TaskStatus

移除队列系统的独立状态定义，统一使用 TaskStatus：

```typescript
// packages/core/src/services/task-service.ts
type TaskStatus =
  | "backlog"       // 待办
  | "queue"         // 排队等待执行
  | "in_progress"   // 执行中（含子状态）
  | "paused"        // 已暂停（新增）
  | "human_review"  // 人工审查
  | "done"          // 完成
  | "pr_created"    // PR 已创建
  | "error";        // 错误

// 移除: ai_review（冗余，用 executionPhase 表示）
```

**迁移映射（队列状态 → TaskStatus）：**

| 旧队列状态 | 新 TaskStatus |
|-----------|---------------|
| `pending` | `queue` |
| `running` | `in_progress` |
| `retrying` | `in_progress` + retry 标记 |
| `completed` | `done` |
| `failed` | `error` |

#### 1.2 新增暂停事件

```typescript
// packages/core/src/task/events/event-types.ts
type TaskEventType =
  | /* 现有事件 */
  | "PAUSE"    // 暂停任务，保留当前进度
  | "RESUME";  // 从暂停恢复，继续执行
```

**状态转换规则：**

```
in_progress.* --PAUSE--> paused (保存 executionPhase 到 context)
queue --PAUSE--> paused
paused --RESUME--> 恢复到暂停前的状态/子状态
```

#### 1.3 状态机上下文扩展

```typescript
// packages/core/src/task/machine/task-machine.ts
interface TaskMachineContext {
  taskId: string;
  reviewReason?: ReviewReason;
  currentSubtaskIndex: number;
  requiresPlanReview: boolean;
  // 新增
  pausedFromState?: XStateValue;  // 暂停前的状态，用于 RESUME 恢复
}
```

---

### 2. 存储结构优化

#### 2.1 事件历史分离

**改进后的任务目录结构：**

```
<workspace>/.viben/tasks/
└── <date>-<slug>/
    ├── task.json              # 主任务文件（不含 eventHistory）
    ├── events.jsonl           # 事件历史（追加写入）
    ├── prd.md
    ├── implementation_plan.json
    └── logs/
        └── ...
```

#### 2.2 task.json 精简

```typescript
interface UnifiedTask {
  // ... 其他字段保持不变

  // XState 集成
  xstateState?: XStateValue;
  lastEvent?: TaskEvent;      // 保留，快速获取最新状态
  // eventHistory?: TaskEvent[];  // 移除
}
```

#### 2.3 events.jsonl 格式

每行一个 JSON 对象，追加写入：

```jsonl
{"eventId":"uuid-1","sequence":1,"type":"QUEUE","timestamp":"2026-03-08T10:00:00Z"}
{"eventId":"uuid-2","sequence":2,"type":"START","timestamp":"2026-03-08T10:00:05Z"}
{"eventId":"uuid-3","sequence":3,"type":"PLANNING_COMPLETE","timestamp":"2026-03-08T10:05:00Z","payload":{"planId":"..."}}
```

#### 2.4 事件存储 API 变更

```typescript
// packages/core/src/task/events/event-store.ts
class TaskEventStore {
  // 新增：追加事件到 events.jsonl
  private async appendEvent(taskDir: string, event: TaskEvent): Promise<void> {
    const eventsPath = join(taskDir, 'events.jsonl');
    await appendFile(eventsPath, JSON.stringify(event) + '\n');
  }

  // 新增：读取事件历史（按需加载）
  async getEventHistory(taskDir: string, since?: number): Promise<TaskEvent[]> {
    const eventsPath = join(taskDir, 'events.jsonl');
    // 逐行读取并过滤
  }
}
```

---

### 3. SSE 端点统一

#### 3.1 新端点设计

```
# 全局订阅（监控工作区所有任务）
GET /api/tasks/events/stream?workspace_path=<path>

# 批量订阅（监控指定任务）
GET /api/tasks/events/stream?workspace_path=<path>&task_ids=id1,id2,id3

# 单任务订阅（保持向后兼容，内部转为批量订阅）
GET /api/tasks/:task_id/events/stream?workspace_path=<path>
```

#### 3.2 事件格式统一

```typescript
// packages/core/src/gateway/sse/task-sse-manager.ts
interface TaskSSEEvent {
  type: TaskSSEEventType;
  task_id: string;           // 明确标识事件所属任务
  workspace_path: string;    // 新增，支持多工作区场景
  timestamp: number;
  data?: unknown;
}
```

#### 3.3 订阅管理

```typescript
class TaskSSEManager {
  // 按工作区管理全局订阅
  private globalSubscribers: Map<string, Set<SSESubscriber>>;

  // 按任务 ID 管理批量订阅
  private taskSubscribers: Map<string, Set<SSESubscriber>>;

  // 广播事件时的分发逻辑
  broadcast(event: TaskSSEEvent): void {
    // 1. 发送给该工作区的全局订阅者
    // 2. 发送给订阅了该 task_id 的批量订阅者
  }
}
```

---

### 4. 任务依赖与优先级

#### 4.1 UnifiedTask 扩展

```typescript
// packages/core/src/services/task-service.ts
interface UnifiedTask {
  // ... 现有字段

  // 任务关系（新增）
  dependsOn?: string[];      // 依赖的任务 ID 列表
  parentTaskId?: string;     // 父任务 ID（用于任务拆分）
  childTaskIds?: string[];   // 子任务 ID 列表（反向引用）

  // 调度信息（新增）
  queuedAt?: string;         // 入队时间，用于 FIFO 排序
}
```

#### 4.2 依赖规则

1. **依赖检查**：任务从 `queue` → `in_progress` 时，所有 `dependsOn` 任务必须为 `done` 或 `pr_created`
2. **循环检测**：创建/更新依赖时检测循环，返回 400 错误
3. **级联通知**：任务完成时通知依赖它的任务

```typescript
function allDependenciesMet(task: UnifiedTask, allTasks: Map<string, UnifiedTask>): boolean {
  if (!task.dependsOn?.length) return true;

  return task.dependsOn.every(depId => {
    const dep = allTasks.get(depId);
    return dep && (dep.status === 'done' || dep.status === 'pr_created');
  });
}
```

#### 4.3 软优先级调度

```typescript
// packages/core/src/gateway/queue/manager.ts
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

**调度特性：**
- 高优先级任务优先调度
- 不抢占正在执行的任务
- 同优先级保持 FIFO 公平性
- 依赖未满足的任务跳过

---

## 实现影响

### 需要修改的文件

| 文件 | 变更内容 |
|------|----------|
| `packages/core/src/services/task-service.ts` | TaskStatus 更新、UnifiedTask 扩展 |
| `packages/core/src/task/machine/task-machine.ts` | 状态机重构、paused 状态、context 扩展 |
| `packages/core/src/task/events/event-types.ts` | 新增 PAUSE/RESUME 事件 |
| `packages/core/src/task/events/event-store.ts` | 事件历史分离到 events.jsonl |
| `packages/core/src/gateway/queue/types.ts` | 移除独立状态定义 |
| `packages/core/src/gateway/queue/manager.ts` | 软优先级调度、依赖检查 |
| `packages/core/src/gateway/sse/task-sse-manager.ts` | 批量/全局订阅支持 |
| `packages/core/src/gateway/routes/task-events.ts` | SSE 端点统一 |

### 数据迁移

1. **事件历史迁移**：现有 task.json 中的 `eventHistory` 需迁移到 `events.jsonl`
2. **状态兼容**：`ai_review` 状态迁移为 `in_progress` + 对应 `executionPhase`

---

## 不变更项

- **错误处理**：保持现状，错误详情通过 event payload 传递
- **文件锁机制**：AsyncLock 保持不变
- **恢复机制**：TaskRecoveryService 逻辑保持不变，适配新状态

---

## 后续步骤

1. 更新 `.trellis/spec/modules/task-system.md` 规范文档
2. 创建实现任务拆分
3. 按模块逐步实现改进
