# Background Tasks

> Agent task background execution and status tracking

## Overview

Background task management allows users to continue Agent task execution while navigating between pages and receive notifications when tasks complete.

## Architecture

```
+-------------------------------------------------------------+
|                        Desktop App                           |
|                                                              |
|  +------------------+      +------------------+              |
|  |  workspace-chat  |      |  useBackground   |              |
|  |    (active)      |      |     Tasks        |              |
|  +--------+---------+      +--------+---------+              |
|           |                         |                        |
|           |     State Sync          | Subscribe              |
|           v                         v                        |
|  +-------------------------------------------------------+   |
|  |                  BackgroundTaskManager                 |  |
|  |  +----------+  +----------+  +----------+             |   |
|  |  |  Task 1  |  |  Task 2  |  |  Task 3  |             |   |
|  |  | running  |  |completed |  |  error   |             |   |
|  |  +----------+  +----------+  +----------+             |   |
|  +-------------------------------------------------------+   |
|                              |                               |
+------------------------------+-------------------------------+
                               |
                               | AbortController
                               v
+-------------------------------------------------------------+
|                     packages/core                            |
|  +-------------------------------------------------------+   |
|  |                  AgentService                          |  |
|  |                   SSE Stream                           |  |
|  +-------------------------------------------------------+   |
+-------------------------------------------------------------+
```

---

## Data Structures

### BackgroundTask

```typescript
interface BackgroundTask {
  /** Unique task ID */
  taskId: string;
  /** Agent session ID (used for stopping) */
  sessionId: string;
  /** User prompt (for display) */
  prompt: string;
  /** Task status */
  status: "running" | "completed" | "error" | "cancelled";
  /** Start time */
  startedAt: Date;
  /** Completion time */
  completedAt?: Date;
  /** Error message */
  errorMessage?: string;
  /** API cost */
  cost?: number;
  /** Execution duration (ms) */
  duration?: number;
}
```

---

## Core Implementation

### BackgroundTaskManager

```typescript
// packages/core/src/services/background-tasks.ts

type TaskListener = (tasks: BackgroundTask[]) => void;

export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private listeners = new Set<TaskListener>();
  private abortControllers = new Map<string, AbortController>();

  /**
   * Add a new task
   */
  addTask(task: {
    taskId: string;
    sessionId: string;
    prompt: string;
  }): BackgroundTask;

  /**
   * Update task status
   */
  updateStatus(
    taskId: string,
    update: {
      status: BackgroundTask["status"];
      errorMessage?: string;
      cost?: number;
      duration?: number;
    }
  ): void;

  /**
   * Stop a task
   */
  stopTask(taskId: string): void;

  /**
   * Get a task
   */
  getTask(taskId: string): BackgroundTask | undefined;

  /**
   * Get all tasks
   */
  getAllTasks(): BackgroundTask[];

  /**
   * Get running task count
   */
  getRunningCount(): number;

  /**
   * Get AbortSignal
   */
  getAbortSignal(taskId: string): AbortSignal | undefined;

  /**
   * Subscribe to task status changes
   */
  subscribe(listener: TaskListener): () => void;

  /**
   * Clean up completed task
   */
  cleanup(taskId: string): void;

  /**
   * Clear all tasks
   */
  clearAll(): void;
}

// Singleton export
export const backgroundTaskManager = new BackgroundTaskManager();
```

---

## Gateway Endpoints

### Task Subscription (SSE)

```
GET /api/agent/tasks/subscribe
```

Subscribe to real-time task status updates via Server-Sent Events.

**Response Stream**:

```typescript
// Initial state
{ "type": "tasks", "tasks": BackgroundTask[] }

// Updates
{ "type": "tasks", "tasks": BackgroundTask[] }

// Heartbeat
{ "type": "ping" }
```

### Stop Task

```
POST /api/agent/tasks/:taskId/stop
```

Stop a running task.

**Response**:

```json
{
  "success": true
}
```

---

## Frontend Hook

### useBackgroundTasks

```typescript
// apps/desktop/src/hooks/use-background-tasks.ts

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
      };

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "tasks") {
          setTasks(data.tasks);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        // Reconnect
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

---

## Task Lifecycle

```
User sends message
      |
      v
+-----------------+
| addTask()       |  -> Add new task to Map
| status: running |  -> Notify all listeners
+--------+--------+
         |
         | SSE connection starts
         v
+-----------------+
| Process SSE     |
| - text          |
| - tool_use      |
| - tool_result   |
+--------+--------+
         |
         | Task complete/error
         v
+-----------------+
| updateStatus()  |  -> Update status
| status: done    |  -> Notify all listeners
+--------+--------+
         |
         | (Optional) User clicks clear
         v
+-----------------+
| cleanup()       |  -> Remove from Map
+-----------------+
```

---

## Integration with useAgent

```typescript
// apps/desktop/src/hooks/use-agent.ts

import { backgroundTaskManager } from "@viben/core";

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const [taskId] = useState(() => Date.now().toString());

  const runAgent = useCallback(async (prompt: string) => {
    // Register background task
    backgroundTaskManager.addTask({
      taskId,
      sessionId: "", // Updated in session message
      prompt,
    });

    try {
      // SSE connection...
      for await (const message of connectSSE(...)) {
        if (message.type === "session") {
          // Update sessionId
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

## Task Status

| Status | Description |
|--------|-------------|
| running | Task is executing |
| completed | Task finished successfully |
| error | Task failed with error |
| cancelled | Task was cancelled by user |

---

## Related Documentation

- [SSE Streaming](./sse-streaming.md) - SSE communication protocol
- [Agent API](./agents.md) - Agent management endpoints
- [Session API](./sessions.md) - Session management
