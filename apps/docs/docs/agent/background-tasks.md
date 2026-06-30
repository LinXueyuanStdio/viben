---
sidebar_position: 6
title: "后台任务管理"
description: "Agent 任务后台执行和状态追踪"
---

# 后台任务管理

> Agent 任务后台执行和状态追踪

## 概述

后台任务管理允许用户在切换页面时继续执行 Agent 任务，并在任务完成时收到通知。

## 架构

```
┌─────────────────────────────────────────────┐
│              Desktop App                     │
│                                              │
│  ┌───────────────┐    ┌────────────────┐     │
│  │ workspace-chat│    │ useBackground  │     │
│  │   (active)    │    │    Tasks       │     │
│  └───────┬───────┘    └───────┬────────┘     │
│          │                     │              │
│          │   状态同步          │ 订阅通知     │
│          ▼                     ▼              │
│  ┌───────────────────────────────────────┐   │
│  │       BackgroundTaskManager           │   │
│  │  ┌──────────┐ ┌──────────┐           │   │
│  │  │ Task 1   │ │ Task 2   │           │   │
│  │  │ running  │ │completed │           │   │
│  │  └──────────┘ └──────────┘           │   │
│  └───────────────────────────────────────┘   │
│                     │                        │
└─────────────────────┼────────────────────────┘
                      │ AbortController
                      ▼
┌──────────────────────────────────────────────┐
│            packages/core                      │
│  ┌───────────────────────────────────────┐   │
│  │        AgentService / SSE Stream      │   │
│  └───────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

## 数据结构

### BackgroundTask

```typescript
interface BackgroundTask {
  taskId: string;
  sessionId: string;
  prompt: string;
  status: "running" | "completed" | "error" | "cancelled";
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  cost?: number;
  duration?: number;
}
```

## packages/core 实现

### BackgroundTaskManager

核心管理器负责追踪任务状态、管理 AbortController、通知订阅者。

```typescript
export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private listeners = new Set<TaskListener>();
  private abortControllers = new Map<string, AbortController>();

  addTask(task: { taskId: string; sessionId: string; prompt: string }): BackgroundTask
  updateStatus(taskId: string, update: { status; errorMessage?; cost?; duration? }): void
  stopTask(taskId: string): void
  getTask(taskId: string): BackgroundTask | undefined
  getAllTasks(): BackgroundTask[]
  getRunningCount(): number
  getAbortSignal(taskId: string): AbortSignal | undefined
  subscribe(listener: TaskListener): () => void
  cleanup(taskId: string): void
  clearAll(): void
}

// 单例导出
export const backgroundTaskManager = new BackgroundTaskManager();
```

### Gateway 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agent/tasks/subscribe` | SSE | 订阅任务状态变更 |
| `/api/agent/tasks/:taskId/stop` | POST | 停止指定任务 |

## Desktop 使用

### useBackgroundTasks Hook

```typescript
export function useBackgroundTasks(): UseBackgroundTasksReturn {
  // 返回 tasks, runningTasks, runningCount, stopTask, isConnected
}
```

### 通知组件

后台任务指示器显示在 UI 中，展示运行中/已完成/错误的任务，用户可以取消运行中的任务。

## 生命周期

```
用户发送消息
      │
      ▼
┌─────────────────┐
│ addTask()       │ → tasks Map 添加新任务
│ status: running │ → 通知所有监听器
└────────┬────────┘
         │ SSE 连接开始
         ▼
┌─────────────────┐
│ 处理 SSE 消息   │
│ - text          │
│ - tool_use      │
│ - tool_result   │
└────────┬────────┘
         │ 任务完成/错误
         ▼
┌─────────────────┐
│ updateStatus()  │ → 更新状态
│ status: done    │ → 通知所有监听器
└────────┬────────┘
         │ (可选) 用户清除
         ▼
┌─────────────────┐
│ cleanup()       │ → 从 Map 移除
└─────────────────┘
```

## 与 useAgent 集成

```typescript
export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const runAgent = useCallback(async (prompt: string) => {
    // 注册后台任务
    backgroundTaskManager.addTask({ taskId, sessionId: "", prompt });

    try {
      for await (const message of connectSSE(...)) {
        if (message.type === "result") {
          backgroundTaskManager.updateStatus(taskId, {
            status: "completed", cost: message.cost, duration: message.duration,
          });
        }
        if (message.type === "error") {
          backgroundTaskManager.updateStatus(taskId, {
            status: "error", errorMessage: message.message,
          });
        }
      }
    } catch (error) {
      backgroundTaskManager.updateStatus(taskId, { status: "error", errorMessage: error.message });
    }
  }, [taskId]);
}
```

## 参考

- 规范文件: `docs/specs/modules/chat/background-tasks.md`
- [SSE 流式通信](./sse-streaming.md)
