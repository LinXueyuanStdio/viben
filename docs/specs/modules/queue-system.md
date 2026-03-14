# Gateway Queue System

纯粹的 Bash 命令队列系统，基于文件系统实现。

## 核心概念

```
输入: bash 命令 + 工作目录
输出: PID
职责: 排队、执行、监控
```

队列系统**不关心命令是什么**，只负责：
- 接收命令入队
- 按顺序执行（支持并发控制）
- 追踪 PID
- 监控进程存活状态

## 数据结构

### QueueItem - 队列项

```typescript
interface QueueItem {
  id: string;         // 唯一标识
  command: string;    // bash 命令
  cwd: string;        // 工作目录
  created_at: number; // 创建时间戳
}
```

### RunningItem - 运行中的任务

```typescript
interface RunningItem {
  id: string;
  pid: number;
  command: string;
  cwd: string;
  started_at: number;
}
```

## 文件结构

```
~/.viben/queue/
├── config.yaml              # 队列配置
├── pending.jsonl            # 待执行队列 (append-only)
└── running/
    ├── {id}.yaml            # 运行中的任务
    └── ...
```

### config.yaml

```yaml
max_concurrency: 3           # 最大并发数
promoter_interval_ms: 5000   # Promoter 检查间隔
monitor_interval_ms: 30000   # Monitor 检查间隔
```

### pending.jsonl

每行一个 JSON 对象，append-only：

```jsonl
{"id":"q001","command":"claude -p 'hello' --dangerously-skip-permissions","cwd":"/repo","created_at":1710000000}
{"id":"q002","command":"npm run build","cwd":"/project","created_at":1710000001}
```

### running/{id}.yaml

```yaml
id: q001
pid: 12345
command: "claude -p 'hello' --dangerously-skip-permissions"
cwd: /repo
started_at: 1710000100
```

## API

```typescript
class CommandQueue {
  // 入队 - 返回任务 ID
  async enqueue(command: string, cwd: string): Promise<string>;

  // 查询
  getPending(): QueueItem[];
  getRunning(): RunningItem[];
  getStatus(): { pending: number; running: number; max_concurrency: number };

  // 控制
  cancel(id: string): boolean;

  // 生命周期
  start(): void;      // 启动 Promoter 和 Monitor
  stop(): void;       // 停止
}
```

## 内部流程

### 入队

```
enqueue(command, cwd)
    │
    ├─► 生成 id
    │
    └─► append { id, command, cwd, created_at } to pending.jsonl
```

### Promoter (定期执行)

```
每 5 秒:
    │
    ├─► count = len(running/)
    │
    ├─► if count >= max_concurrency: return
    │
    ├─► item = read_first_line(pending.jsonl)
    │
    ├─► if !item: return
    │
    ├─► pid = spawn("bash", ["-c", item.command], { cwd: item.cwd, detached: true })
    │
    ├─► write running/{item.id}.yaml { id, pid, command, cwd, started_at }
    │
    └─► remove_first_line(pending.jsonl)
```

### Monitor (定期执行)

```
每 30 秒:
    │
    └─► for each file in running/:
            │
            ├─► read { id, pid, ... }
            │
            ├─► if process_exists(pid): continue
            │
            ├─► emit("task:completed", { id, pid })
            │
            └─► rm running/{id}.yaml
```

## 使用示例

### 上层调用 - Agent Run

```typescript
// HTTP API: POST /api/queue/enqueue
queue.enqueue(
  `claude -p 'hello world' --dangerously-skip-permissions`,
  '/path/to/repo'
);
```

### 上层调用 - Unified Task

```typescript
// CLI: viben task start
queue.enqueue(
  `claude -p "$(cat .viben/tasks/03-14-xxx/prompt.md)" --dangerously-skip-permissions`,
  '/path/to/repo'
);
```

### 上层调用 - 任意命令

```typescript
queue.enqueue(
  `npm run build && npm run test`,
  '/path/to/project'
);
```

## 事件

```typescript
interface QueueEvents {
  "task:enqueued": { id: string };
  "task:started": { id: string; pid: number };
  "task:completed": { id: string; pid: number };  // 进程退出（成功或失败）
}
```

## 与现有系统的关系

### 迁移路径

现有 `packages/core/src/gateway/queue/` 需要重构：

1. `types.ts` - 简化为 QueueItem 和 RunningItem
2. `persistence.ts` - 改为 pending.jsonl + running/*.yaml
3. `index.ts` (TaskQueueManager) - 简化为 CommandQueue
4. `worker.ts` - 移除 SdkChatProxy，改为 bash spawn
5. `scheduler.ts` - 移到上层（不属于队列系统）

### 上层职责

队列系统只是底层基础设施，上层负责：

- **Task Service**: 管理 task.json 状态转换
- **Agent Service**: 生成 agent 执行命令
- **Scheduler**: 决定任务优先级、依赖关系

```
┌─────────────────────────────────────────┐
│           Task Service                   │
│   (task.json 状态管理, 依赖调度)          │
└─────────────────────────────────────────┘
                    │
                    │ 生成 bash 命令
                    ▼
┌─────────────────────────────────────────┐
│           Command Queue                  │
│   (纯粹的命令队列, 不关心任务类型)         │
└─────────────────────────────────────────┘
                    │
                    │ bash -c "$command"
                    ▼
┌─────────────────────────────────────────┐
│           OS Process                     │
│   (claude, opencode, npm, etc.)          │
└─────────────────────────────────────────┘
```
