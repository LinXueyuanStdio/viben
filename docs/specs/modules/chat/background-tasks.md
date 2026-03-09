# 后台任务管理规范

> Agent 任务后台执行和状态追踪

---

## 概述

后台任务管理允许用户在切换页面时继续执行 Agent 任务，并在任务完成时收到通知。

---

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Desktop App                               │
│                                                                  │
│  ┌──────────────────┐      ┌──────────────────┐                 │
│  │  workspace-chat  │      │  useBackground   │                 │
│  │    (active)      │      │     Tasks        │                 │
│  └────────┬─────────┘      └────────┬─────────┘                 │
│           │                         │                            │
│           │     状态同步            │ 订阅通知                   │
│           ▼                         ▼                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  BackgroundTaskManager                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │ │
│  │  │  Task 1  │  │  Task 2  │  │  Task 3  │                   │ │
│  │  │ running  │  │completed │  │  error   │                   │ │
│  │  └──────────┘  └──────────┘  └──────────┘                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
└──────────────────────────────┼────────────────────────────────────┘
                               │
                               │ AbortController
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     packages/core                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  AgentService                                │ │
│  │                   SSE Stream                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 数据结构

### BackgroundTask

```typescript
interface BackgroundTask {
  /** 任务唯一 ID */
  taskId: string;
  /** Agent 会话 ID (用于停止) */
  sessionId: string;
  /** 用户提示词 (用于显示) */
  prompt: string;
  /** 任务状态 */
  status: "running" | "completed" | "error" | "cancelled";
  /** 开始时间 */
  startedAt: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 错误信息 */
  errorMessage?: string;
  /** API 费用 */
  cost?: number;
  /** 执行时长 (ms) */
  duration?: number;
}
```

---

## packages/core 实现

### BackgroundTaskManager

```typescript
// packages/core/src/services/background-tasks.ts

type TaskListener = (tasks: BackgroundTask[]) => void;

export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private listeners = new Set<TaskListener>();
  private abortControllers = new Map<string, AbortController>();

  /**
   * 添加新任务
   */
  addTask(task: {
    taskId: string;
    sessionId: string;
    prompt: string;
  }): BackgroundTask {
    const abortController = new AbortController();
    this.abortControllers.set(task.taskId, abortController);

    const fullTask: BackgroundTask = {
      ...task,
      status: "running",
      startedAt: new Date(),
    };

    this.tasks.set(task.taskId, fullTask);
    this.notifyListeners();

    console.log(`[BackgroundTasks] Added task: ${task.taskId}`);
    return fullTask;
  }

  /**
   * 更新任务状态
   */
  updateStatus(
    taskId: string,
    update: {
      status: BackgroundTask["status"];
      errorMessage?: string;
      cost?: number;
      duration?: number;
    }
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    Object.assign(task, update);

    if (update.status !== "running") {
      task.completedAt = new Date();
    }

    this.notifyListeners();
    console.log(`[BackgroundTasks] Updated task ${taskId}: ${update.status}`);
  }

  /**
   * 停止任务
   */
  stopTask(taskId: string): void {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      console.log(`[BackgroundTasks] Aborted task: ${taskId}`);
    }
    this.updateStatus(taskId, { status: "cancelled" });
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取运行中任务数量
   */
  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "running"
    ).length;
  }

  /**
   * 获取 AbortSignal
   */
  getAbortSignal(taskId: string): AbortSignal | undefined {
    return this.abortControllers.get(taskId)?.signal;
  }

  /**
   * 订阅任务状态变更
   */
  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    // 立即调用一次
    listener(this.getAllTasks());
    return () => this.listeners.delete(listener);
  }

  /**
   * 清理已完成任务
   */
  cleanup(taskId: string): void {
    this.tasks.delete(taskId);
    this.abortControllers.delete(taskId);
    this.notifyListeners();
  }

  /**
   * 清理所有任务
   */
  clearAll(): void {
    // 停止所有运行中的任务
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.tasks.clear();
    this.abortControllers.clear();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const tasks = this.getAllTasks();
    for (const listener of this.listeners) {
      listener(tasks);
    }
  }
}

// 单例导出
export const backgroundTaskManager = new BackgroundTaskManager();
```

### Gateway 端点

```typescript
// packages/core/src/gateway/routes/agent.ts

import { backgroundTaskManager } from "../../services/background-tasks";

// 任务列表订阅 (SSE)
agent.get("/tasks/subscribe", (c) => {
  return streamSSE(c, async (stream) => {
    // 发送当前状态
    await stream.writeSSE({
      data: JSON.stringify({
        type: "tasks",
        tasks: backgroundTaskManager.getAllTasks(),
      }),
    });

    // 订阅变更
    const unsubscribe = backgroundTaskManager.subscribe((tasks) => {
      stream.writeSSE({
        data: JSON.stringify({ type: "tasks", tasks }),
      });
    });

    // 保持连接直到客户端断开
    // Hono 会在客户端断开时自动清理
    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribe();
    });

    // 发送心跳保持连接
    while (true) {
      await new Promise((r) => setTimeout(r, 30000));
      if (c.req.raw.signal.aborted) break;
      await stream.writeSSE({ data: JSON.stringify({ type: "ping" }) });
    }
  });
});

// 停止任务
agent.post("/tasks/:taskId/stop", async (c) => {
  const { taskId } = c.req.param();
  backgroundTaskManager.stopTask(taskId);
  return c.json({ success: true });
});
```

---

## Desktop 实现

### useBackgroundTasks Hook

```typescript
// apps/desktop/src/hooks/use-background-tasks.ts

import { useState, useEffect, useCallback } from "react";
import { getGatewayClient } from "@/lib/gateway";

export interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  status: "running" | "completed" | "error" | "cancelled";
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  cost?: number;
  duration?: number;
}

export interface UseBackgroundTasksReturn {
  tasks: BackgroundTask[];
  runningTasks: BackgroundTask[];
  runningCount: number;
  stopTask: (taskId: string) => Promise<void>;
  isConnected: boolean;
}

export function useBackgroundTasks(): UseBackgroundTasksReturn {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const gateway = getGatewayClient();
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      eventSource = new EventSource(
        `${gateway.baseUrl}/api/agent/tasks/subscribe`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        console.log("[BackgroundTasks] Connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "tasks") {
            setTasks(data.tasks);
          }
        } catch (e) {
          console.error("[BackgroundTasks] Parse error:", e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        // 重连
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  const stopTask = useCallback(async (taskId: string) => {
    const gateway = getGatewayClient();
    await fetch(`${gateway.baseUrl}/api/agent/tasks/${taskId}/stop`, {
      method: "POST",
    });
  }, []);

  const runningTasks = tasks.filter((t) => t.status === "running");

  return {
    tasks,
    runningTasks,
    runningCount: runningTasks.length,
    stopTask,
    isConnected,
  };
}
```

### 通知组件

```typescript
// apps/desktop/src/components/chat/background-task-indicator.tsx

import { useBackgroundTasks } from "@/hooks/use-background-tasks";
import { Loader2, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function BackgroundTaskIndicator() {
  const { tasks, runningCount, stopTask } = useBackgroundTasks();

  if (runningCount === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
            {runningCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">后台任务</h4>
          <div className="space-y-2 max-h-60 overflow-auto">
            {tasks.map((task) => (
              <div
                key={task.taskId}
                className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
              >
                {task.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5" />
                ) : task.status === "completed" ? (
                  <div className="h-4 w-4 rounded-full bg-green-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-red-500" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{task.prompt}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.status === "running"
                      ? "运行中..."
                      : task.status === "completed"
                        ? `完成 (${task.duration}ms)`
                        : task.errorMessage || "已取消"}
                  </p>
                </div>
                {task.status === "running" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => stopTask(task.taskId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 与 useAgent 集成

```typescript
// apps/desktop/src/hooks/use-agent.ts

import { backgroundTaskManager } from "@viben/core";

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const [taskId] = useState(() => Date.now().toString());

  const runAgent = useCallback(async (prompt: string) => {
    // 注册后台任务
    backgroundTaskManager.addTask({
      taskId,
      sessionId: "", // 将在 session 消息中更新
      prompt,
    });

    try {
      // SSE 连接...
      for await (const message of connectSSE(...)) {
        if (message.type === "session") {
          // 更新 sessionId
          const task = backgroundTaskManager.getTask(taskId);
          if (task) task.sessionId = message.sessionId;
        }

        if (message.type === "result") {
          backgroundTaskManager.updateStatus(taskId, {
            status: "completed",
            cost: message.cost,
            duration: message.duration,
          });
        }

        if (message.type === "error") {
          backgroundTaskManager.updateStatus(taskId, {
            status: "error",
            errorMessage: message.message,
          });
        }
      }
    } catch (error) {
      backgroundTaskManager.updateStatus(taskId, {
        status: "error",
        errorMessage: error.message,
      });
    }
  }, [taskId]);

  const stopAgent = useCallback(() => {
    backgroundTaskManager.stopTask(taskId);
  }, [taskId]);

  // ...
}
```

---

## 生命周期

```
用户发送消息
      │
      ▼
┌─────────────────┐
│ addTask()       │  → tasks Map 添加新任务
│ status: running│  → 通知所有监听器
└────────┬────────┘
         │
         │ SSE 连接开始
         ▼
┌─────────────────┐
│ 处理 SSE 消息   │
│ - text          │
│ - tool_use      │
│ - tool_result   │
└────────┬────────┘
         │
         │ 任务完成/错误
         ▼
┌─────────────────┐
│ updateStatus()  │  → 更新状态
│ status: done    │  → 通知所有监听器
└────────┬────────┘
         │
         │ (可选) 用户点击清除
         ▼
┌─────────────────┐
│ cleanup()       │  → 从 Map 移除
└─────────────────┘
```

---

## 原始文件引用

| 文件 | 描述 |
|------|------|
| `workany/src/shared/lib/background-tasks.ts` | WorkAny 后台任务实现 |
| `docs/work/background-tasks.md` | WorkAny 架构分析 |
