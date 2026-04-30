---
sidebar_position: 24
title: "Queue Auto-Promotion"
description: "Automatic task promotion from queue to in_progress status based on capacity"
---

# Queue Auto-Promotion

Automatic task promotion from "queue" to "in_progress" status based on parallel task capacity.

---

## Overview

Queue Auto-Promotion implements an automatic promotion mechanism for kanban tasks. When an `in_progress` task completes or moves to another status, the system automatically checks whether there are waiting tasks in `queue` and promotes them according to the parallel task limit (`maxParallelTasks`).

## Design Goals

1. **Reduce manual intervention** - Automatically manage task promotion without manual dragging
2. **FIFO fairness** - First-in, first-out ordering by creation time
3. **Capacity control** - Respect parallel task limit settings
4. **Performance optimization** - Listeners stored outside store to avoid triggering re-renders

---

## Architecture

### Data Flow

```
Task leaves in_progress --> Listener triggered
                                |
                                v
                          processQueue()
                                |
                                v
                  Check capacity:
                  in_progress < maxParallelTasks
                       |              |
                      Yes            No (stop)
                       |
                       v
                Get oldest queue task
                (FIFO by created_at)
                       |
                       v
                Promote to in_progress
                       |
                       v
                Loop until capacity full
                or no more queue tasks
```

### Component Structure

```
apps/desktop/src/
+-- hooks/
|   +-- use-queue-auto-promotion.ts  # Core Hook
+-- stores/
|   +-- kanban-queue-store.ts        # maxParallelTasks setting
+-- pages/
    +-- workspace-kanban.tsx         # Hook usage location
```

---

## API Design

### useQueueAutoPromotion Hook

```typescript
interface UseQueueAutoPromotionOptions {
  /** Current task array */
  tasks: TaskWithAttemptStatus[];
  /** Callback to promote task (update status to in_progress) */
  onPromoteTask: (taskId: string) => Promise<void>;
  /** Whether auto-promotion is enabled */
  enabled?: boolean;
}

function useQueueAutoPromotion(options: UseQueueAutoPromotionOptions): {
  processQueue: () => Promise<void>;
  isProcessing: boolean;
};
```

### Status Change Listener

```typescript
type TaskStatusChangeListener = (
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
) => void;

// Register listener
function registerTaskStatusChangeListener(
  listener: TaskStatusChangeListener
): () => void;

// Notify listeners
function notifyTaskStatusChange(
  taskId: string,
  oldStatus: TaskStatus | undefined,
  newStatus: TaskStatus
): void;
```

---

## Implementation Details

### processQueue Function

The core promotion logic:

1. Filter out archived tasks
2. Count current `in_progress` tasks
3. Get un-attempted `queue` tasks sorted by `created_at` (FIFO)
4. Promote tasks one by one until capacity is full or no more queue tasks
5. Track attempted task IDs to avoid retrying failed promotions
6. Stop after 10 consecutive failures as a safety mechanism

### Trigger Conditions

1. **When a task leaves `in_progress`**: Detected via status change listener
2. **On page load**: Initial check with a 1-second delay

### Status Change Detection

Uses a ref to track previous status map and compare with current status on each render to detect changes.

---

## Usage Example

```typescript
// In workspace-kanban.tsx

const handlePromoteTask = useCallback(
  async (taskId: string) => {
    if (!workspace) return;
    await updateTaskStatus.mutateAsync({
      taskId,
      status: "in_progress",
      workspacePath: workspace.path,
    });
  },
  [workspace, updateTaskStatus]
);

useQueueAutoPromotion({
  tasks: tasks ?? [],
  onPromoteTask: handlePromoteTask,
  enabled: !!workspace,
});
```

---

## Configuration

### maxParallelTasks

Managed via `kanban-queue-store.ts`:

| Setting | Default | Range |
|---------|---------|-------|
| maxParallelTasks | 3 | 1-10 |

Users can adjust this value through the kanban settings UI.

---

## Edge Case Handling

1. **Concurrent execution protection** - Uses `isProcessingQueueRef` to prevent duplicate execution
2. **Consecutive failure protection** - Stops after 10 consecutive failures
3. **Attempted task tracking** - Avoids retrying the same task
4. **Archived task filtering** - Does not promote archived tasks
5. **Component unmount** - Cleans up timers and listeners

---

## Debug Logging

The hook outputs the following logs:

```
[QueueAutoPromotion] Task {id} left in_progress ({old} -> {new}), processing queue
[QueueAutoPromotion] Promoting task {id} ({title}) from queue to in_progress
[QueueAutoPromotion] At capacity ({n}/{max}), stopping
[QueueAutoPromotion] No queued tasks, stopping
[QueueAutoPromotion] Max consecutive failures (10) reached, stopping
[QueueAutoPromotion] Initial queue check on mount
[QueueAutoPromotion] Already processing queue, skipping
```

---

## Related Documentation

- [Kanban Module](/backend/kanban/) - Kanban module overview
- [CLI Task Commands](/cli/commands/task) - Task CLI management
