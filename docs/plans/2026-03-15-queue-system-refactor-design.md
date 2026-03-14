# Gateway Queue System 重构设计

> **目标**: 将 QueueWorker 从 SdkChatProxy 同进程执行改为 spawn detached 进程，基于文件系统追踪任务状态，解决 Gateway 退出时任务丢失问题。

## 问题分析

### 当前问题

```typescript
// 当前 worker.ts - 使用 SdkChatProxy 在 Gateway 进程内执行
const proxy = new SdkChatProxy();
const stream = proxy.executeStreaming({...});  // 阻塞在 Gateway 进程
for await (const message of stream) { ... }
```

**问题**:
1. Gateway 退出时所有正在执行的任务丢失
2. 无法支持任务在 Gateway 重启后继续运行
3. 无法独立监控任务进程状态

### 目标架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI / Gateway                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │  viben queue *   │    │  /api/queue/*    │    │   Task Service       │   │
│  │  (CLI commands)  │    │  (REST routes)   │    │   (task.json 管理)   │   │
│  └────────┬─────────┘    └────────┬─────────┘    └──────────┬───────────┘   │
│           │                       │                         │               │
│           └───────────────────────┼─────────────────────────┘               │
│                                   │                                         │
│                                   v                                         │
│           ┌───────────────────────────────────────────────────────────┐     │
│           │               packages/core/src/queue/ops                 │     │
│           │  - enqueue, cancel, retry, status, list, config, clean    │     │
│           │  (CLI 和 Gateway 共享的底层操作)                           │     │
│           └─────────────────────────┬─────────────────────────────────┘     │
│                                     │                                       │
│                                     v                                       │
│           ┌───────────────────────────────────────────────────────────┐     │
│           │                    CommandQueue                            │     │
│           │  - 入队: append to pending.jsonl                          │     │
│           │  - Promoter: 读取 pending → spawn detached → 写 running/  │     │
│           │  - Monitor: 检查 running/ 中进程存活状态                   │     │
│           └─────────────────────────┬─────────────────────────────────┘     │
│                                     │                                       │
│          ┌──────────────────────────┼──────────────────────┐                │
│          │                         │                       │                │
│          v                         v                       v                │
│    ┌──────────┐             ┌──────────┐            ┌──────────┐           │
│    │  PID 1   │             │  PID 2   │            │  PID 3   │ detached  │
│    │ (claude) │             │ (claude) │            │ (claude) │ processes │
│    └──────────┘             └──────────┘            └──────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
        │                          │                       │
        v                          v                       v
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ~/.viben/queue/                                    │
│  ├── config.yaml              # 队列配置                                     │
│  ├── pending.jsonl            # 待执行队列 (append-only)                     │
│  ├── running/                 # 运行中的任务                                 │
│  │   └── {id}.yaml            # 含 PID, 命令, 日志路径                       │
│  ├── completed/               # 已完成的任务                                 │
│  │   └── {id}.yaml            # 含退出码, 完成时间                           │
│  └── logs/                    # 任务日志                                     │
│      └── {id}.log             # stdout/stderr 输出                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 模块结构设计

### 新目录结构

将 `packages/core/src/gateway/queue` 移动到 `packages/core/src/queue`，与 `packages/core/src/task` 保持一致的设计模式。

```
packages/core/src/queue/
├── index.ts                    # 模块入口，导出所有 public API
├── ops/                        # 操作层 - CLI 和 Gateway 共享
│   ├── index.ts                # ops 导出
│   ├── types.ts                # 类型定义
│   ├── enqueue.ts              # 入队操作
│   ├── cancel.ts               # 取消操作
│   ├── retry.ts                # 重试操作
│   ├── status.ts               # 状态查询
│   ├── list.ts                 # 列表查询
│   ├── logs.ts                 # 日志查看
│   ├── config.ts               # 配置管理
│   └── clean.ts                # 清理操作
├── core/                       # 核心实现
│   ├── command-queue.ts        # CommandQueue 类
│   ├── promoter.ts             # Promoter 逻辑
│   ├── monitor.ts              # Monitor 逻辑
│   └── persistence.ts          # 文件读写操作
└── __tests__/                  # 测试文件
    ├── ops.test.ts
    └── command-queue.test.ts
```

### 与 task 模块的对比

| 模块 | task | queue |
|------|------|-------|
| 路径 | `packages/core/src/task/` | `packages/core/src/queue/` |
| 操作层 | `task/ops/` | `queue/ops/` |
| CLI 命令 | `viben task *` | `viben queue *` |
| Gateway 路由 | `/api/task/*` | `/api/queue/*` |
| 共享底层 | 两者都调用 `ops/` 中的函数 | 两者都调用 `ops/` 中的函数 |

## 核心设计

### 1. 数据结构

```typescript
// ~/.viben/queue/ 下的数据结构

// pending.jsonl - 每行一个 JSON (append-only)
interface QueueItem {
  id: string;           // 唯一标识 (q_xxx)
  command: string;      // bash 命令
  cwd: string;          // 工作目录
  created_at: number;   // 创建时间戳
  metadata?: Record<string, unknown>;  // 可选元数据 (task_dir 等)
}

// running/{id}.yaml
interface RunningItem {
  id: string;
  pid: number;
  command: string;
  cwd: string;
  started_at: number;
  log_file: string;     // 日志文件路径
  metadata?: Record<string, unknown>;
}

// completed/{id}.yaml
interface CompletedItem {
  id: string;
  pid: number;
  command: string;
  cwd: string;
  started_at: number;
  completed_at: number;
  exit_code: number;
  log_file: string;
  metadata?: Record<string, unknown>;
}

// config.yaml
interface QueueConfig {
  max_concurrency: number;        // 最大并发数
  promoter_interval_ms: number;   // Promoter 检查间隔
  monitor_interval_ms: number;    // Monitor 检查间隔
  log_retention_days: number;     // 日志保留天数
  completed_retention_days: number; // 完成记录保留天数
  default_max_retries: number;    // 默认最大重试次数
}
```

### 2. 文件结构

```
~/.viben/queue/
├── config.yaml              # 队列配置
├── pending.jsonl            # 待执行队列 (append-only)
├── running/
│   ├── q_abc123.yaml        # 运行中的任务
│   └── q_def456.yaml
├── completed/
│   ├── q_ghi789.yaml        # 已完成的任务
│   └── q_jkl012.yaml
└── logs/
    ├── q_abc123.log         # 任务日志
    └── q_def456.log
```

### 3. config.yaml 默认值

```yaml
# 队列配置
max_concurrency: 3           # 最大并发数
promoter_interval_ms: 5000   # Promoter 检查间隔
monitor_interval_ms: 30000   # Monitor 检查间隔
log_retention_days: 7        # 日志保留天数
completed_retention_days: 30 # 完成记录保留天数
default_max_retries: 3       # 默认最大重试次数
```

## Ops 层设计

### queue/ops/types.ts

```typescript
/**
 * Queue operations types
 *
 * Shared types for CLI commands and Gateway routes
 */

// =============================================================================
// Data Types
// =============================================================================

export interface QueueItem {
  id: string;
  command: string;
  cwd: string;
  created_at: number;
  metadata?: Record<string, unknown>;
}

export interface RunningItem extends QueueItem {
  pid: number;
  started_at: number;
  log_file: string;
}

export interface CompletedItem extends RunningItem {
  completed_at: number;
  exit_code: number;
}

export interface QueueConfig {
  max_concurrency: number;
  promoter_interval_ms: number;
  monitor_interval_ms: number;
  log_retention_days: number;
  completed_retention_days: number;
  default_max_retries: number;
}

// =============================================================================
// Result Types
// =============================================================================

export interface EnqueueResult {
  success: boolean;
  id?: string;
  position?: number;
  error?: string;
}

export interface CancelResult {
  success: boolean;
  cancelled?: string;
  error?: string;
}

export interface RetryResult {
  success: boolean;
  id?: string;
  position?: number;
  error?: string;
}

export interface StatusResult {
  success: boolean;
  pending: number;
  running: number;
  completed: number;
  max_concurrency: number;
  items?: {
    pending: QueueItem[];
    running: RunningItem[];
  };
  error?: string;
}

export interface ListResult {
  success: boolean;
  items: Array<QueueItem | RunningItem | CompletedItem>;
  total: number;
  error?: string;
}

export interface LogsResult {
  success: boolean;
  id?: string;
  content?: string;
  size?: number;
  truncated?: boolean;
  error?: string;
}

export interface ConfigResult {
  success: boolean;
  config?: QueueConfig;
  error?: string;
}

export interface CleanResult {
  success: boolean;
  cleaned: number;
  error?: string;
}
```

### queue/ops/enqueue.ts

```typescript
/**
 * Enqueue operation
 *
 * Shared by: viben queue enqueue, POST /api/queue/enqueue
 */

import type { EnqueueResult } from "./types";
import { persistence } from "../core/persistence";
import { generateQueueId } from "../core/utils";

export interface EnqueueOptions {
  command: string;
  cwd: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enqueue a command to the queue
 */
export async function enqueue(options: EnqueueOptions): Promise<EnqueueResult> {
  const { command, cwd, metadata } = options;

  if (!command || !cwd) {
    return {
      success: false,
      error: "command and cwd are required",
    };
  }

  const id = generateQueueId();
  const item = {
    id,
    command,
    cwd,
    created_at: Date.now(),
    metadata,
  };

  await persistence.appendPending(item);
  const position = await persistence.getPendingCount();

  return {
    success: true,
    id,
    position,
  };
}
```

### queue/ops/status.ts

```typescript
/**
 * Status operation
 *
 * Shared by: viben queue status, GET /api/queue/status
 */

import type { StatusResult } from "./types";
import { persistence } from "../core/persistence";

export interface StatusOptions {
  includeItems?: boolean;  // 是否包含具体任务列表
}

/**
 * Get queue status
 */
export async function getStatus(options: StatusOptions = {}): Promise<StatusResult> {
  const { includeItems = false } = options;

  const pending = await persistence.getPendingQueue();
  const running = await persistence.listRunning();
  const completed = await persistence.listCompleted();
  const config = await persistence.loadConfig();

  const result: StatusResult = {
    success: true,
    pending: pending.length,
    running: running.length,
    completed: completed.length,
    max_concurrency: config.max_concurrency,
  };

  if (includeItems) {
    result.items = {
      pending,
      running,
    };
  }

  return result;
}
```

### queue/ops/index.ts

```typescript
/**
 * Queue operations module
 *
 * Re-exports all queue-related operations for use by CLI commands and Gateway routes.
 */

// Types
export type {
  QueueItem,
  RunningItem,
  CompletedItem,
  QueueConfig,
  EnqueueResult,
  CancelResult,
  RetryResult,
  StatusResult,
  ListResult,
  LogsResult,
  ConfigResult,
  CleanResult,
} from "./types";

// Enqueue
export type { EnqueueOptions } from "./enqueue";
export { enqueue } from "./enqueue";

// Cancel
export type { CancelOptions } from "./cancel";
export { cancel } from "./cancel";

// Retry
export type { RetryOptions } from "./retry";
export { retry } from "./retry";

// Status
export type { StatusOptions } from "./status";
export { getStatus } from "./status";

// List
export type { ListOptions } from "./list";
export { list } from "./list";

// Logs
export type { LogsOptions } from "./logs";
export { getLogs } from "./logs";

// Config
export type { GetConfigOptions, SetConfigOptions } from "./config";
export { getConfig, setConfig, resetConfig } from "./config";

// Clean
export type { CleanOptions } from "./clean";
export { clean } from "./clean";
```

## CLI 命令设计 (viben queue)

### 命令结构

```
viben queue <subcommand> [options]
```

| 子命令 | 说明 | 对应 ops 函数 | 对应 API |
|--------|------|---------------|----------|
| `status` | 队列整体状态 | `getStatus()` | GET /api/queue/status |
| `list` | 任务列表 | `list()` | GET /api/queue/list |
| `inspect` | 任务详情 | `getItem()` | GET /api/queue/:id |
| `enqueue` | 提交命令 | `enqueue()` | POST /api/queue/enqueue |
| `cancel` | 取消任务 | `cancel()` | DELETE /api/queue/:id |
| `retry` | 重试失败任务 | `retry()` | POST /api/queue/:id/retry |
| `logs` | 查看任务日志 | `getLogs()` | GET /api/queue/:id/logs |
| `config` | 配置管理 | `getConfig()`/`setConfig()` | GET/PUT /api/queue/config |
| `clean` | 清理已完成任务 | `clean()` | DELETE /api/queue/clean |

### CLI 命令实现示例

```typescript
// packages/core/src/cli/commands/queue/status.ts
import { Command } from "commander";
import { getStatus } from "../../../queue/ops";

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Show queue status")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const result = await getStatus({ includeItems: true });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Human-readable output
      console.log("Queue Status");
      console.log("────────────────────────────────────────");
      console.log(`  Pending:     ${result.pending} task(s)`);
      console.log(`  Running:     ${result.running} / ${result.max_concurrency} (max concurrency)`);
      console.log(`  Completed:   ${result.completed} task(s)`);
      // ...
    });
}
```

### CLI 命令文件结构

```
packages/core/src/cli/commands/queue/
├── index.ts              # queue 命令入口
├── status.ts             # viben queue status
├── list.ts               # viben queue list
├── inspect.ts            # viben queue inspect
├── enqueue.ts            # viben queue enqueue
├── cancel.ts             # viben queue cancel
├── retry.ts              # viben queue retry
├── logs.ts               # viben queue logs
├── config.ts             # viben queue config
└── clean.ts              # viben queue clean
```

## Gateway Routes 设计 (/api/queue)

### Routes 实现

```typescript
// packages/core/src/gateway/routes/queue.ts
import type { FastifyInstance } from "fastify";
import {
  enqueue,
  cancel,
  retry,
  getStatus,
  list,
  getLogs,
  getConfig,
  setConfig,
  clean,
} from "../../queue/ops";

export function registerQueueRoutes(fastify: FastifyInstance): void {
  // POST /api/queue/enqueue
  fastify.post("/api/queue/enqueue", async (request, reply) => {
    const { command, cwd, metadata } = request.body as any;
    const result = await enqueue({ command, cwd, metadata });

    if (!result.success) {
      reply.code(400);
    }
    return result;
  });

  // GET /api/queue/status
  fastify.get("/api/queue/status", async (request) => {
    const { include_items } = request.query as any;
    return getStatus({ includeItems: include_items === "true" });
  });

  // GET /api/queue/list
  fastify.get("/api/queue/list", async (request) => {
    const { status, limit } = request.query as any;
    return list({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  });

  // DELETE /api/queue/:id
  fastify.delete("/api/queue/:id", async (request, reply) => {
    const { id } = request.params as any;
    const { force } = request.query as any;
    const result = await cancel({ id, force: force === "true" });

    if (!result.success) {
      reply.code(result.error === "Task not found" ? 404 : 400);
    }
    return result;
  });

  // POST /api/queue/:id/retry
  fastify.post("/api/queue/:id/retry", async (request, reply) => {
    const { id } = request.params as any;
    const { reset_count } = request.body as any;
    const result = await retry({ id, resetCount: reset_count });

    if (!result.success) {
      reply.code(result.error === "Task not found" ? 404 : 400);
    }
    return result;
  });

  // GET /api/queue/:id/logs
  fastify.get("/api/queue/:id/logs", async (request, reply) => {
    const { id } = request.params as any;
    const { tail } = request.query as any;
    const result = await getLogs({
      id,
      tail: tail ? parseInt(tail, 10) : undefined,
    });

    if (!result.success) {
      reply.code(404);
    }
    return result;
  });

  // GET /api/queue/config
  fastify.get("/api/queue/config", async () => {
    return getConfig();
  });

  // PUT /api/queue/config
  fastify.put("/api/queue/config", async (request) => {
    const updates = request.body as any;
    return setConfig({ updates });
  });

  // DELETE /api/queue/clean
  fastify.delete("/api/queue/clean", async (request) => {
    const { status, before, keep, dry_run } = request.query as any;
    return clean({
      status,
      before,
      keep: keep ? parseInt(keep, 10) : undefined,
      dryRun: dry_run === "true",
    });
  });
}
```

## API 端点设计

### 端点列表

| 方法 | 路径 | 说明 | 对应 CLI |
|------|------|------|----------|
| POST | `/api/queue/enqueue` | 入队命令 | `viben queue enqueue` |
| GET | `/api/queue/status` | 队列状态 | `viben queue status` |
| GET | `/api/queue/list` | 任务列表 | `viben queue list` |
| GET | `/api/queue/:id` | 任务详情 | `viben queue inspect` |
| DELETE | `/api/queue/:id` | 取消任务 | `viben queue cancel` |
| POST | `/api/queue/:id/retry` | 重试任务 | `viben queue retry` |
| GET | `/api/queue/:id/logs` | 任务日志 | `viben queue logs` |
| GET | `/api/queue/config` | 获取配置 | `viben queue config` |
| PUT | `/api/queue/config` | 更新配置 | `viben queue config --set` |
| DELETE | `/api/queue/clean` | 清理任务 | `viben queue clean` |

### 请求/响应示例

```typescript
// POST /api/queue/enqueue
Request: {
  command: string;      // bash 命令
  cwd: string;          // 工作目录
  metadata?: Record<string, unknown>;  // 可选元数据
}
Response: {
  success: boolean;
  id?: string;
  position?: number;
  error?: string;
}

// GET /api/queue/status?include_items=true
Response: {
  success: boolean;
  pending: number;
  running: number;
  completed: number;
  max_concurrency: number;
  items?: {
    pending: QueueItem[];
    running: RunningItem[];
  };
}

// GET /api/queue/list?status=running&limit=10
Response: {
  success: boolean;
  items: RunningItem[];
  total: number;
}

// GET /api/queue/:id/logs?tail=100
Response: {
  success: boolean;
  id: string;
  content: string;
  size: number;
  truncated: boolean;
}
```

## CommandQueue 核心实现

### 类设计

```typescript
// packages/core/src/queue/core/command-queue.ts
import { EventEmitter } from "node:events";
import { Promoter } from "./promoter";
import { Monitor } from "./monitor";
import { persistence } from "./persistence";

interface CommandQueueEvents {
  "task:enqueued": { id: string; position: number };
  "task:started": { id: string; pid: number };
  "task:completed": { id: string; exit_code: number };
  "task:failed": { id: string; exit_code: number; error?: string };
  "queue:status_changed": StatusResult;
}

/**
 * CommandQueue - 纯粹的 Bash 命令队列
 */
export class CommandQueue extends EventEmitter {
  private promoter: Promoter;
  private monitor: Monitor;
  private started = false;

  constructor() {
    super();
    this.promoter = new Promoter(this);
    this.monitor = new Monitor(this);
  }

  async start(): Promise<void> {
    if (this.started) return;

    await persistence.ensureDirectories();
    await this.recoverFromRestart();

    this.promoter.start();
    this.monitor.start();
    this.started = true;
  }

  stop(): void {
    this.promoter.stop();
    this.monitor.stop();
    this.started = false;
  }

  private async recoverFromRestart(): Promise<void> {
    // 检查 running/ 中的任务，处理死掉的进程
    const running = await persistence.listRunning();
    for (const item of running) {
      if (!this.isProcessRunning(item.pid)) {
        // 进程已死，根据 retry_count 决定重试或标记失败
        await this.handleDeadProcess(item);
      }
    }
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async handleDeadProcess(item: RunningItem): Promise<void> {
    const retryCount = (item.metadata?.retry_count as number) || 0;
    const maxRetries = (item.metadata?.max_retries as number) || 3;

    if (retryCount < maxRetries) {
      // 重新入队
      await persistence.appendPending({
        id: item.id,
        command: item.command,
        cwd: item.cwd,
        created_at: Date.now(),
        metadata: {
          ...item.metadata,
          retry_count: retryCount + 1,
        },
      });
    } else {
      // 标记为失败
      await persistence.writeCompleted({
        ...item,
        completed_at: Date.now(),
        exit_code: -1,
      });
    }

    await persistence.deleteRunning(item.id);
  }
}

// Singleton instance
let commandQueue: CommandQueue | null = null;

export function getCommandQueue(): CommandQueue {
  if (!commandQueue) {
    commandQueue = new CommandQueue();
  }
  return commandQueue;
}
```

## 内部流程

### 1. 入队流程

```
enqueue({ command, cwd, metadata })
    │
    ├─► id = generateId()  // q_xxx
    │
    ├─► append { id, command, cwd, created_at, metadata } to pending.jsonl
    │
    ├─► emit("task:enqueued", { id, position })
    │
    └─► return { id, position }
```

### 2. Promoter (定期执行)

```
每 promoter_interval_ms (默认 5000ms):
    │
    ├─► running_count = count files in running/
    │
    ├─► if running_count >= max_concurrency: return
    │
    ├─► item = read_and_remove_first_line(pending.jsonl)
    │
    ├─► if !item: return
    │
    ├─► log_file = logs/{item.id}.log
    │
    ├─► pid = spawn("bash", ["-c", item.command], {
    │       cwd: item.cwd,
    │       detached: true,
    │       stdio: ["ignore", log_fd, log_fd]
    │   })
    │   child.unref()  // 允许 Gateway 退出
    │
    ├─► write running/{item.id}.yaml {
    │       id, pid, command, cwd, started_at, log_file, metadata
    │   }
    │
    ├─► emit("task:started", { id, pid })
    │
    └─► 递归调用自己 (填满并发槽位)
```

### 3. Monitor (定期执行)

```
每 monitor_interval_ms (默认 30000ms):
    │
    └─► for each file in running/:
            │
            ├─► item = parse(file)
            │
            ├─► if process_exists(item.pid): continue
            │
            ├─► exit_code = get_exit_code_from_log(item.log_file)  // 或默认 0
            │
            ├─► write completed/{item.id}.yaml {
            │       ...item, completed_at, exit_code
            │   }
            │
            ├─► rm running/{item.id}.yaml
            │
            ├─► if exit_code == 0:
            │       emit("task:completed", { id, exit_code })
            │   else:
            │       emit("task:failed", { id, exit_code })
            │
            └─► emit("queue:status_changed", getStatus())
```

### 4. Gateway 重启恢复流程

```
start():
    │
    ├─► ensure directories exist
    │
    ├─► for each file in running/:
    │       │
    │       ├─► item = parse(file)
    │       │
    │       ├─► if process_exists(item.pid):
    │       │       // 进程还活着，继续监控
    │       │       continue
    │       │
    │       └─► // 进程已死，需要处理
    │           │
    │           ├─► check if should_restart(item)
    │           │   (基于 metadata 中的 retry_count 等)
    │           │
    │           ├─► if should_restart:
    │           │       // 重新入队
    │           │       enqueue({
    │           │           command: item.command,
    │           │           cwd: item.cwd,
    │           │           metadata: { ...item.metadata, retry_count: (retry_count || 0) + 1 }
    │           │       })
    │           │       rm running/{item.id}.yaml
    │           │
    │           └─► else:
    │                   // 标记为失败
    │                   write completed/{item.id}.yaml { ...item, exit_code: -1, error: "process died" }
    │                   rm running/{item.id}.yaml
    │
    ├─► start promoter interval
    │
    └─► start monitor interval
```

## 与 Task Service 的集成

### viben task start 调用 queue

```typescript
// packages/core/src/task/ops/lifecycle.ts
import { enqueue } from "../../queue/ops";
import { createCLIAdapter } from "../../cli/lib/swarm/cli-adapter";

export async function startTask(
  repoRoot: string,
  taskDir: string,
  options: StartTaskOptions = {}
): Promise<StartTaskResult> {
  const adapter = createCLIAdapter(options.platform || "claude");

  // 生成命令
  const cmd = adapter.buildRunCommand({
    agent: options.agent || "work",
    prompt: getTaskPrompt(taskDir),
    sessionId: options.sessionId,
    skipPermissions: true,
    jsonOutput: true,
  });

  const command = cmd.join(" ");

  // 入队
  const result = await enqueue({
    command,
    cwd: repoRoot,
    metadata: {
      task_dir: taskDir,
      agent: options.agent,
      max_retries: options.maxRetries || 3,
    },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // 更新 task.json 状态
  await updateTaskStatus(taskDir, "queue");

  return {
    success: true,
    queueId: result.id,
    position: result.position,
  };
}
```

### 事件同步

```typescript
// Gateway 初始化时设置事件监听
const commandQueue = getCommandQueue();

commandQueue.on("task:started", async ({ id, pid }) => {
  const item = await persistence.getRunning(id);
  if (item?.metadata?.task_dir) {
    await taskService.updateTask(item.metadata.task_dir, {
      status: "in_progress",
      pid,
    });
  }
});

commandQueue.on("task:completed", async ({ id, exit_code }) => {
  const item = await persistence.getCompleted(id);
  if (item?.metadata?.task_dir) {
    await taskService.updateTask(item.metadata.task_dir, {
      status: exit_code === 0 ? "completed" : "failed",
    });
  }
});
```

## 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `queue/index.ts` | 模块入口 |
| `queue/ops/index.ts` | ops 导出 |
| `queue/ops/types.ts` | 类型定义 |
| `queue/ops/enqueue.ts` | 入队操作 |
| `queue/ops/cancel.ts` | 取消操作 |
| `queue/ops/retry.ts` | 重试操作 |
| `queue/ops/status.ts` | 状态查询 |
| `queue/ops/list.ts` | 列表查询 |
| `queue/ops/logs.ts` | 日志查看 |
| `queue/ops/config.ts` | 配置管理 |
| `queue/ops/clean.ts` | 清理操作 |
| `queue/core/command-queue.ts` | CommandQueue 实现 |
| `queue/core/promoter.ts` | Promoter 逻辑 |
| `queue/core/monitor.ts` | Monitor 逻辑 |
| `queue/core/persistence.ts` | 文件读写 |
| `cli/commands/queue/index.ts` | queue 命令入口 |
| `cli/commands/queue/*.ts` | 各子命令实现 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `gateway/routes/queue.ts` | 使用新的 ops API |
| `gateway/index.ts` | 引入新的 CommandQueue |
| `cli/commands/index.ts` | 添加 queue 命令 |

### 删除文件

| 文件 | 说明 |
|------|------|
| `gateway/queue/worker.ts` | 移除 SdkChatProxy 执行 |
| `gateway/queue/index.ts` | 移动到 queue/core/ |
| `gateway/queue/types.ts` | 移动到 queue/ops/types.ts |
| `gateway/queue/persistence.ts` | 移动到 queue/core/ |
| `gateway/queue/scheduler.ts` | 移到上层 task 模块 |

## 实现计划

### Phase 1: 核心 ops 层 (优先级: P0)

1. 创建 `packages/core/src/queue/` 目录结构
2. 实现 `queue/ops/types.ts` 类型定义
3. 实现 `queue/core/persistence.ts` 文件读写
4. 实现基础 ops: `enqueue`, `status`, `list`, `cancel`

### Phase 2: CommandQueue 和 CLI (优先级: P0)

1. 实现 `queue/core/command-queue.ts`
2. 实现 `queue/core/promoter.ts`
3. 实现 `queue/core/monitor.ts`
4. 实现 CLI 命令 `viben queue *`

### Phase 3: Gateway 集成 (优先级: P0)

1. 修改 `gateway/routes/queue.ts` 使用新 ops
2. 修改 Gateway 初始化使用新 CommandQueue
3. 删除旧的 `gateway/queue/` 目录

### Phase 4: Task 集成和清理 (优先级: P1)

1. 修改 `task/ops/lifecycle.ts` 使用 queue ops
2. 添加事件同步逻辑
3. 实现剩余 ops: `retry`, `logs`, `config`, `clean`
4. 清理无用代码

## 验证方案

### 测试 1: CLI 和 API 一致性

```bash
# CLI 入队
viben queue enqueue --command "sleep 10" --cwd /tmp
# 输出: { "id": "q_xxx", "position": 1 }

# API 入队
curl -X POST http://127.0.0.1:18790/api/queue/enqueue \
  -H "Content-Type: application/json" \
  -d '{"command":"sleep 10","cwd":"/tmp"}'
# 输出: { "success": true, "id": "q_xxx", "position": 2 }

# CLI 查看状态
viben queue status
# 输出: Pending: 2, Running: 0

# API 查看状态
curl http://127.0.0.1:18790/api/queue/status
# 输出: { "pending": 2, "running": 0, ... }
```

### 测试 2: Gateway 重启恢复

```bash
# 1. 入队长时间任务
viben queue enqueue --command "sleep 60" --cwd /tmp

# 2. 等待任务开始
sleep 6

# 3. 确认进程启动
ps aux | grep "sleep 60"

# 4. 重启 Gateway
pnpm gateway:restart

# 5. 确认进程仍在运行
ps aux | grep "sleep 60"

# 6. 检查队列状态
viben queue status
# 应该看到 running=1
```

### 测试 3: 并发控制

```bash
# 入队 5 个任务 (max_concurrency=3)
for i in {1..5}; do
  viben queue enqueue --command "sleep 10" --cwd /tmp
done

# 检查状态
viben queue status
# 应该看到: Pending: 2, Running: 3
```

## 估算

- 新增代码: ~1200-1500 行
- 修改代码: ~300 行
- 删除代码: ~400 行
