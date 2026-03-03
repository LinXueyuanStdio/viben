# Gateway 任务队列设计

## 概述

为 Viben Gateway 实现任务队列功能，提供**并发控制**和**故障恢复**能力。

## 需求

- **并发控制**：全局限制，最多同时运行 N 个 agent 任务
- **故障恢复**：Gateway 重启和 Agent 进程崩溃都需要恢复
- **重试策略**：立即重试，最多 N 次
- **存储方式**：内存 + 文件持久化（YAML，符合 file-native 范式）
- **优先级**：不需要，FIFO 即可
- **前端通信**：WebSocket 双向通信

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Gateway                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  REST Routes    │    │      WebSocket Handler          │ │
│  │  /api/queue/*   │    │  - 任务状态订阅                  │ │
│  └────────┬────────┘    │  - 队列状态推送                  │ │
│           │             └──────────────┬──────────────────┘ │
│           v                            v                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TaskQueueManager                         │   │
│  │  - 任务入队/出队                                      │   │
│  │  - 并发控制 (最大 N 个)                               │   │
│  │  - 状态持久化                                         │   │
│  │  - 故障恢复                                           │   │
│  └────────────────────────┬─────────────────────────────┘   │
│                           │                                  │
│           ┌───────────────┼───────────────┐                 │
│           v               v               v                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  Worker 1  │  │  Worker 2  │  │  Worker N  │             │
│  │  (Agent)   │  │  (Agent)   │  │  (Agent)   │             │
│  └────────────┘  └────────────┘  └────────────┘             │
└─────────────────────────────────────────────────────────────┘
                           │
                           v
              ┌────────────────────────┐
              │  ~/.viben/queue/       │
              │  - state.yaml          │
              │  - tasks/              │
              └────────────────────────┘
```

核心组件：
- **TaskQueueManager**：队列核心，管理任务生命周期
- **REST Routes**：提供队列操作 API
- **WebSocket Handler**：实时推送状态变化
- **Worker**：复用现有 agent 执行逻辑

## 任务状态机

```
                    ┌─────────┐
                    │ pending │ ◄─────────────────────┐
                    └────┬────┘                       │
                         │ 队列调度（有空闲 worker）    │
                         v                            │
                    ┌─────────┐                       │
          ┌────────►│ running │                       │
          │         └────┬────┘                       │
          │              │                            │
          │   ┌──────────┼──────────┐                │
          │   │          │          │                │
          │   v          v          v                │
     ┌────────────┐ ┌─────────┐ ┌────────┐          │
     │  retrying  │ │completed│ │ failed │          │
     └────────────┘ └─────────┘ └────────┘          │
          │ 立即重试                                  │
          │ (retryCount < maxRetries)                │
          └──────────────────────────────────────────┘
```

**状态定义：**

| 状态 | 说明 |
|------|------|
| `pending` | 已入队，等待执行 |
| `running` | 正在执行中 |
| `retrying` | 执行失败，准备重试（短暂状态） |
| `completed` | 执行成功完成 |
| `failed` | 执行失败，已达最大重试次数 |

**任务数据结构：**

```typescript
interface QueueTask {
  id: string;              // 唯一标识
  type: 'agent-run';       // 任务类型（预留扩展）
  payload: AgentRunPayload; // 执行参数
  status: TaskStatus;
  retryCount: number;      // 当前重试次数
  maxRetries: number;      // 最大重试次数，默认 3
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;          // 失败原因
  pid?: number;            // 运行时进程 ID
}
```

## TaskQueueManager 核心逻辑

```typescript
class TaskQueueManager extends EventEmitter {
  private queue: QueueTask[] = [];      // 待执行队列
  private running: Map<string, QueueTask> = new Map();  // 运行中任务
  private maxConcurrency: number = 3;   // 最大并发数
  private persistPath: string;          // ~/.viben/queue/

  // === 队列操作 ===
  enqueue(payload: AgentRunPayload): QueueTask;  // 入队，返回任务
  cancel(taskId: string): boolean;               // 取消任务
  getStatus(): QueueStatus;                      // 获取队列状态

  // === 内部调度 ===
  private tryDequeue(): void;           // 尝试执行下一个任务
  private executeTask(task: QueueTask): Promise<void>;  // 执行任务
  private onTaskComplete(task: QueueTask, error?: Error): void;  // 任务完成回调

  // === 持久化 ===
  private persist(): void;              // 保存队列状态到文件
  private restore(): void;              // 从文件恢复队列状态

  // === 进程监控 ===
  private watchProcess(task: QueueTask, pid: number): void;  // 监控进程
  private handleProcessExit(task: QueueTask, code: number): void;  // 进程退出处理
}
```

**调度逻辑：**

```typescript
private tryDequeue(): void {
  // 检查是否有空闲槽位
  if (this.running.size >= this.maxConcurrency) return;

  // 取出队首任务（FIFO）
  const task = this.queue.shift();
  if (!task) return;

  // 执行任务
  this.executeTask(task);

  // 继续尝试填满槽位
  this.tryDequeue();
}
```

**事件发射：**
- `task:queued` - 任务入队
- `task:started` - 任务开始执行
- `task:progress` - 任务进度更新
- `task:completed` - 任务完成
- `task:failed` - 任务失败
- `queue:changed` - 队列状态变化

## 持久化与故障恢复

**存储结构：**

```
~/.viben/queue/
├── state.yaml          # 队列元数据
└── tasks/
    ├── task-abc123.yaml
    ├── task-def456.yaml
    └── ...
```

**state.yaml 内容：**

```yaml
version: 1
maxConcurrency: 3
lastUpdated: 1709136000000
taskIds:
  pending: [abc123, def456]
  running: [ghi789]
```

**task-{id}.yaml 内容：**

```yaml
id: abc123
type: agent-run
status: pending
retryCount: 0
maxRetries: 3
createdAt: 1709135000000
payload:
  agentId: my-agent
  sessionId: sess-001
  input: "用户输入..."
```

**持久化时机：**
- 任务入队时
- 任务状态变化时
- 使用防抖（debounce 500ms）避免频繁写入

**Gateway 重启恢复流程：**

```
1. Gateway 启动
2. TaskQueueManager.restore() 读取 state.yaml
3. 遍历所有任务文件：
   - pending 任务：保持在队列中
   - running 任务：标记为 pending 重新排队（进程已死）
4. 调用 tryDequeue() 开始调度
5. 发射 queue:restored 事件
```

**Agent 进程崩溃恢复：**

```
1. watchProcess() 检测到进程退出（非 0 退出码）
2. handleProcessExit() 判断：
   - retryCount < maxRetries → 状态改为 retrying，立即重新入队
   - retryCount >= maxRetries → 状态改为 failed
3. 持久化状态
4. 发射相应事件
```

## API 与 WebSocket 设计

**REST API：**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/queue/enqueue` | 提交任务到队列 |
| GET | `/api/queue/status` | 获取队列整体状态 |
| GET | `/api/queue/tasks` | 获取任务列表（支持状态过滤） |
| GET | `/api/queue/tasks/:id` | 获取单个任务详情 |
| GET | `/api/queue/tasks/:id/stream` | 任务输出流（SSE） |
| DELETE | `/api/queue/tasks/:id` | 取消/删除任务 |
| PUT | `/api/queue/config` | 更新队列配置（如并发数） |

**请求/响应示例：**

```typescript
// POST /api/queue/enqueue
Request: {
  agent_id: string;
  session_id?: string;
  input: string;
  max_retries?: number;  // 默认 3
}
Response: {
  task_id: string;
  position: number;      // 队列位置
  status: 'pending';
}

// GET /api/queue/status
Response: {
  pending_count: number;
  running_count: number;
  max_concurrency: number;
  tasks: QueueTask[];    // 简要信息
}
```

**WebSocket 协议：**

```typescript
// 连接: ws://127.0.0.1:18790/ws/queue

// 客户端 → 服务端
{ type: 'subscribe', task_ids?: string[] }  // 订阅（空则订阅全部）
{ type: 'unsubscribe', task_ids: string[] } // 取消订阅

// 服务端 → 客户端
{ type: 'queue:status', data: QueueStatus }     // 队列状态快照
{ type: 'task:queued', data: QueueTask }        // 任务入队
{ type: 'task:started', data: QueueTask }       // 任务开始
{ type: 'task:progress', data: { id, progress } } // 进度更新
{ type: 'task:completed', data: QueueTask }     // 任务完成
{ type: 'task:failed', data: QueueTask }        // 任务失败
```

## 端点设计

现有端点（保持不变）：
- `POST /api/agent/run` → 直接执行，不走队列

新增端点（队列功能）：
- `POST   /api/queue/enqueue` → 提交任务到队列
- `GET    /api/queue/status` → 队列状态
- `GET    /api/queue/tasks` → 任务列表
- `GET    /api/queue/tasks/:id` → 任务详情
- `GET    /api/queue/tasks/:id/stream` → 任务输出流（SSE）
- `DELETE /api/queue/tasks/:id` → 取消任务
- `PUT    /api/queue/config` → 配置并发数等

WebSocket:
- `ws://127.0.0.1:18790/ws/queue` → 实时状态推送

## 错误处理与边界情况

**进程崩溃判定：**

| 退出码 | 含义 | 处理方式 |
|--------|------|----------|
| 0 | 正常完成 | 标记 `completed` |
| 1 | 一般错误 | 重试（如未达上限） |
| 137 | SIGKILL | 重试 |
| 143 | SIGTERM | 重试（可能是 gateway 关闭） |
| 其他非 0 | 异常 | 重试 |

**边界情况处理：**

1. **队列已满时入队**
   - 无限制，始终接受入队
   - 队列长度通过 `status` API 可见，由调用方决定是否继续提交

2. **Gateway 优雅关闭**
   ```typescript
   async shutdown(): Promise<void> {
     // 1. 停止接受新任务
     this.accepting = false;
     // 2. 等待运行中任务完成（最多 30 秒）
     await this.waitRunningTasks(30000);
     // 3. 持久化最终状态
     await this.persist();
     // 4. 强制终止剩余进程
     this.killAllRunning();
   }
   ```

3. **任务文件损坏**
   - 解析失败的任务文件移到 `~/.viben/queue/corrupted/`
   - 记录日志，继续恢复其他任务

4. **磁盘空间不足**
   - 持久化失败时发射 `error` 事件
   - 队列继续在内存中运行
   - 日志警告提示用户

5. **重复任务 ID**
   - 使用 `nanoid` 生成，碰撞概率极低
   - 入队时检查，若重复则重新生成

## 实现文件清单

**新增文件：**

```
packages/core/src/gateway/
├── queue/
│   ├── index.ts              # TaskQueueManager 类
│   ├── types.ts              # QueueTask, QueueStatus 等类型
│   ├── persistence.ts        # YAML 读写、防抖持久化
│   └── worker.ts             # 封装 agent 执行逻辑
├── routes/
│   └── queue.ts              # /api/queue/* REST 路由
└── websocket/
    └── queue-handler.ts      # WebSocket 处理器
```

**修改文件：**

```
packages/core/src/gateway/
├── index.ts                  # 初始化队列、注册路由、优雅关闭
└── types/index.ts            # 导出队列相关类型
```

**配置默认值：**

```yaml
# ~/.viben/queue/config.yaml
max_concurrency: 3
default_max_retries: 3
persist_debounce_ms: 500
shutdown_timeout_ms: 30000
```

**估算代码量：**
- 新增约 600-800 行 TypeScript
- 修改约 50 行现有代码
