# WorkAny 后台任务管理

## 概述

WorkAny 实现了前端层的后台任务管理系统，允许用户在切换到其他任务时继续执行当前任务。这是一个纯前端的内存管理系统，通过观察者模式实现状态同步。

## 后台任务管理器

**文件**: [`workany/src/shared/lib/background-tasks.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/lib/background-tasks.ts)

### 数据结构

```typescript
// 行 8-15
export interface BackgroundTask {
  taskId: string;          // 任务 ID
  sessionId: string;       // 后端会话 ID
  abortController: AbortController;  // 取消控制器
  isRunning: boolean;      // 运行状态
  startedAt: Date;         // 开始时间
  prompt: string;          // 用户提示词
}
```

### 全局状态

```typescript
// 行 17-22
// 全局任务 Map
const backgroundTasks = new Map<string, BackgroundTask>();

// 状态变更监听器
type BackgroundTaskListener = (tasks: BackgroundTask[]) => void;
const listeners = new Set<BackgroundTaskListener>();
```

### 核心 API

#### 添加后台任务

```typescript
// 行 35-44
export function addBackgroundTask(
  task: Omit<BackgroundTask, 'startedAt'>
): void {
  backgroundTasks.set(task.taskId, {
    ...task,
    startedAt: new Date(),
  });
  console.log('[BackgroundTasks] Added task:', task.taskId);
  notifyListeners();
}
```

#### 移除后台任务

```typescript
// 行 49-53
export function removeBackgroundTask(taskId: string): void {
  backgroundTasks.delete(taskId);
  console.log('[BackgroundTasks] Removed task:', taskId);
  notifyListeners();
}
```

#### 获取后台任务

```typescript
// 行 58-60
export function getBackgroundTask(taskId: string): BackgroundTask | undefined {
  return backgroundTasks.get(taskId);
}

// 行 65-67
export function getAllBackgroundTasks(): BackgroundTask[] {
  return Array.from(backgroundTasks.values());
}
```

#### 获取运行中任务数量

```typescript
// 行 72-74
export function getRunningTaskCount(): number {
  return Array.from(backgroundTasks.values()).filter((t) => t.isRunning).length;
}
```

#### 更新任务状态

```typescript
// 行 79-94
export function updateBackgroundTaskStatus(
  taskId: string,
  isRunning: boolean
): void {
  const task = backgroundTasks.get(taskId);
  if (task) {
    task.isRunning = isRunning;
    if (!isRunning) {
      // 任务完成后，延迟 1 秒移除
      setTimeout(() => {
        removeBackgroundTask(taskId);
      }, 1000);
    }
    notifyListeners();
  }
}
```

#### 检查任务是否在后台运行

```typescript
// 行 99-102
export function isTaskRunningInBackground(taskId: string): boolean {
  const task = backgroundTasks.get(taskId);
  return task?.isRunning ?? false;
}
```

#### 停止后台任务

```typescript
// 行 107-114
export function stopBackgroundTask(taskId: string): void {
  const task = backgroundTasks.get(taskId);
  if (task) {
    task.abortController.abort();  // 触发取消信号
    task.isRunning = false;
    removeBackgroundTask(taskId);
  }
}
```

#### 订阅任务状态变更

```typescript
// 行 119-129
export function subscribeToBackgroundTasks(
  listener: BackgroundTaskListener
): () => void {
  listeners.add(listener);
  // 立即调用一次，返回当前状态
  listener(getAllBackgroundTasks());
  // 返回取消订阅函数
  return () => {
    listeners.delete(listener);
  };
}
```

#### 清除所有后台任务

```typescript
// 行 134-140
export function clearAllBackgroundTasks(): void {
  backgroundTasks.forEach((task) => {
    task.abortController.abort();
  });
  backgroundTasks.clear();
  notifyListeners();
}
```

### 通知机制

```typescript
// 行 27-30
function notifyListeners() {
  const tasks = Array.from(backgroundTasks.values());
  listeners.forEach((listener) => listener(tasks));
}
```

---

## 前端 Hook 集成

**文件**: [`workany/src/shared/hooks/useAgent.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/hooks/useAgent.ts)

### 在 useAgent 中的使用

```typescript
import {
  addBackgroundTask,
  getBackgroundTask,
  removeBackgroundTask,
  subscribeToBackgroundTasks,
  updateBackgroundTaskStatus,
  type BackgroundTask,
} from '@/shared/lib/background-tasks';
```

### 任务生命周期管理

1. **任务开始时**: 创建 `AbortController`，添加到后台任务
2. **用户切换页面时**: 任务继续在后台运行
3. **任务完成/错误时**: 更新状态，延迟移除
4. **用户主动停止时**: 调用 `abort()`，立即移除

---

## 与后端的协作

### SSE 连接保持

后台任务保持与后端的 SSE 连接活跃：

```typescript
// 概念性代码 - 在 useAgent 中
const abortController = new AbortController();

// 添加到后台任务
addBackgroundTask({
  taskId,
  sessionId,
  abortController,
  isRunning: true,
  prompt,
});

// 发起 SSE 请求
const response = await fetch('/agent/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, /* ... */ }),
  signal: abortController.signal,  // 传递取消信号
});

// 读取 SSE 流
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // 处理消息...
}

// 任务完成
updateBackgroundTaskStatus(taskId, false);
```

### 取消机制

当用户停止任务时：

```typescript
// 前端调用
stopBackgroundTask(taskId);

// 这会触发 abortController.abort()
// fetch 请求会被中断

// 同时需要通知后端
await fetch(`/agent/stop/${sessionId}`, { method: 'POST' });
```

---

## 状态同步流程

```
用户操作                前端状态                    后端状态
────────               ────────                   ────────
开始任务 ──────────────► addBackgroundTask ──────► 创建 Session
                        isRunning: true
     │
     │                  [SSE 流持续]               [Agent 执行中]
     │
切换页面 ─────────────► 任务保持运行              不受影响
     │
     │
返回页面 ─────────────► 从 Map 恢复状态           继续接收 SSE
     │
     │
任务完成 ◄────────────── updateBackgroundTaskStatus
                        isRunning: false          Session 结束
                        (1秒后自动移除)
```

---

## 观察者模式

系统使用观察者模式实现 UI 的自动更新：

```typescript
// 在组件中订阅
useEffect(() => {
  const unsubscribe = subscribeToBackgroundTasks((tasks) => {
    // 更新 UI 状态
    setBackgroundTasks(tasks);
    setRunningCount(tasks.filter(t => t.isRunning).length);
  });

  return () => unsubscribe();
}, []);
```

---

## 与数据库的关系

后台任务管理器是内存中的状态管理，与数据库持久化是独立的：

| 层级 | 存储位置 | 作用 |
|------|----------|------|
| 后台任务管理 | 内存 (Map) | 跟踪运行中任务、提供取消能力 |
| 任务记录 | SQLite/IndexedDB | 持久化任务历史、消息、文件 |

当任务完成时：
1. 后台任务从 Map 中移除
2. 任务结果已经通过 `updateTaskFromMessage` 保存到数据库

---

## 设计特点

1. **轻量级**: 纯内存管理，无数据库开销
2. **响应式**: 观察者模式确保 UI 实时更新
3. **可取消**: 通过 AbortController 实现优雅取消
4. **自动清理**: 任务完成后自动移除
5. **解耦**: 与数据库持久化层完全独立

## 原始文件引用

- 后台任务管理: [`workany/src/shared/lib/background-tasks.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/lib/background-tasks.ts)
- useAgent Hook: [`workany/src/shared/hooks/useAgent.ts`](/Users/lxy/Documents/GitHub/others/workany/src/shared/hooks/useAgent.ts)
