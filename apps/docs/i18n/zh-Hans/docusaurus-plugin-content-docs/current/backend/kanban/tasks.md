---
sidebar_position: 4
---

# Kanban Tasks

> Tasks are the core unit of the kanban board with status flow, priorities, and workspace association

## Overview

Tasks represent work items in a project. Each task has a status, priority, and can be linked to a workspace where an AI agent executes the work.

## Directory Structure

```
<workspace>/.viben/kanban/projects/<project-id>/
+-- tasks/
    +-- <task-id>.yaml       # Task file
    +-- <task-id>.yaml
    +-- ...
```

## Task Schema

### Task

```typescript
interface Task {
  id: string;
  project_id: string;

  // Basic information
  title: string;
  description?: string;

  // Status and priority
  status: TaskStatus;
  priority: Priority;

  // Assignment and tags
  assignee?: string;       // Agent ID or user identifier
  tags?: string[];         // Tag ID list

  // Associations
  workspace_id?: string;   // Associated workspace
  parent_task_id?: string; // Parent task (subtask support)

  // Timing
  due_date?: string;       // ISO 8601
  created_at: string;
  updated_at: string;
  completed_at?: string;

  // Execution info (when workspace is associated)
  execution?: TaskExecution;
}

type TaskStatus =
  | "backlog"        // Backlog pool
  | "todo"           // Ready to start
  | "in_progress"    // In progress
  | "in_review"      // Under review
  | "done"           // Completed
  | "cancelled";     // Cancelled

type Priority =
  | "urgent"    // Urgent
  | "high"      // High
  | "medium"    // Medium
  | "low"       // Low
  | "none";     // None
```

### TaskExecution

Embedded execution information when a task is being worked on:

```typescript
interface TaskExecution {
  workspace_id: string;
  session_id?: string;
  executor_type: string;
  started_at?: string;
  completed_at?: string;
  result?: {
    success: boolean;
    summary?: string;
    error?: string;
  };
}
```

### TaskWithDetails

Extended task with related information returned by the API:

```typescript
interface TaskWithDetails extends Task {
  // Associated workspace info
  workspace?: {
    id: string;
    name: string;
    status: WorkspaceStatus;
    branch_name: string;
  };

  // Latest session info
  latest_session?: {
    id: string;
    status: SessionStatus;
    message_count: number;
    last_message_at?: string;
  };

  // Tag details
  tag_details?: Tag[];
}
```

## File Example

### task.yaml

```yaml
id: "task-1707820800-xyz789"
project_id: "proj-1707820800-abc123"

title: "Implement user login feature"
description: |
  Implement JWT-based user login feature, including:
  - Login form validation
  - API call
  - Token storage
  - Error handling

status: "in_progress"
priority: "high"

tags:
  - "tag-feature"
  - "tag-auth"

workspace_id: "ws-1707821000-def456"

execution:
  workspace_id: "ws-1707821000-def456"
  session_id: "sess-1707821100-ghi789"
  executor_type: "claude-code"
  started_at: "2026-02-13T11:00:00Z"

created_at: "2026-02-13T10:00:00Z"
updated_at: "2026-02-13T11:00:00Z"
```

## Status Flow

```
                    +-------------+
                    |   backlog   |
                    +------+------+
                           |
                           v
                    +-------------+
           +--------|    todo     |--------+
           |        +------+------+        |
           |               |               |
           |               v               |
           |        +-------------+        |
           |        | in_progress |        |
           |        +------+------+        |
           |               |               |
           |               v               |
           |        +-------------+        |
           |        |  in_review  |        |
           |        +------+------+        |
           |               |               |
           v               v               v
    +-------------+ +-------------+ +-------------+
    |  cancelled  | |    done     | |  Go back    |
    +-------------+ +-------------+ +-------------+
```

### Status Transition Rules

```typescript
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "backlog", "cancelled"],
  in_progress: ["in_review", "done", "todo", "cancelled"],
  in_review: ["done", "in_progress", "cancelled"],
  done: ["in_progress"],  // Reopen
  cancelled: ["backlog", "todo"],  // Restore
};
```

## Service Interface

### TaskService

```typescript
class TaskService {
  // Task CRUD
  async list(projectId: string, options?: ListTasksOptions): Promise<Task[]>;
  async get(projectId: string, taskId: string): Promise<TaskWithDetails>;
  async create(projectId: string, data: CreateTask): Promise<Task>;
  async update(projectId: string, taskId: string, data: UpdateTask): Promise<Task>;
  async delete(projectId: string, taskId: string): Promise<void>;

  // Status management
  async updateStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task>;
  async bulkUpdateStatus(projectId: string, taskIds: string[], status: TaskStatus): Promise<void>;

  // Create and start
  async createAndStart(
    projectId: string,
    data: CreateTaskAndStart
  ): Promise<{ task: Task; workspace: KanbanWorkspace }>;

  // Tag operations
  async addTag(projectId: string, taskId: string, tagId: string): Promise<void>;
  async removeTag(projectId: string, taskId: string, tagId: string): Promise<void>;

  // Bulk operations
  async bulkUpdate(projectId: string, updates: BulkTaskUpdate[]): Promise<void>;

  // Streaming interface
  watchTask(projectId: string, taskId: string): AsyncIterable<TaskEvent>;
}
```

### Type Definitions

```typescript
interface ListTasksOptions {
  status?: TaskStatus[];
  priority?: Priority[];
  tags?: string[];
  assignee?: string;
  has_workspace?: boolean;
  search?: string;
  sort?: "created_at" | "updated_at" | "priority" | "due_date" | "status";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

interface CreateTask {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  tags?: string[];
  assignee?: string;
  due_date?: string;
  parent_task_id?: string;
}

interface UpdateTask {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  tags?: string[];
  assignee?: string;
  due_date?: string;
}

interface CreateTaskAndStart {
  // Task info
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];

  // Workspace config
  workspace_name?: string;
  branch_name?: string;
  base_branch?: string;

  // Executor config
  executor_type: string;
  initial_prompt?: string;
}

interface BulkTaskUpdate {
  task_id: string;
  status?: TaskStatus;
  priority?: Priority;
  assignee?: string;
}

interface TaskEvent {
  type: "created" | "updated" | "deleted" | "status_changed";
  task: Task;
  timestamp: string;
}
```

## API Endpoints

### List Tasks

```http
GET /api/kanban/projects/:projectId/tasks
```

Query parameters:
- `status`: Comma-separated status list
- `priority`: Comma-separated priority list
- `tags`: Comma-separated tag IDs
- `assignee`: Assignee filter
- `has_workspace`: Filter by workspace association
- `search`: Search term
- `sort`: Sort field
- `order`: Sort order (`asc`, `desc`)
- `limit`: Result limit
- `offset`: Result offset

Response:
```json
{
  "tasks": [...],
  "total": 42
}
```

### Get Task

```http
GET /api/kanban/projects/:projectId/tasks/:taskId
```

Response:
```json
{
  "task": {
    "id": "task-123",
    "title": "Implement feature",
    "status": "in_progress",
    "workspace": {
      "id": "ws-456",
      "name": "feature-workspace",
      "status": "running"
    }
  }
}
```

### Create Task

```http
POST /api/kanban/projects/:projectId/tasks
```

Request body:
```json
{
  "title": "New task",
  "description": "Task description",
  "status": "todo",
  "priority": "high",
  "tags": ["tag-1", "tag-2"]
}
```

### Update Task

```http
PUT /api/kanban/projects/:projectId/tasks/:taskId
```

### Delete Task

```http
DELETE /api/kanban/projects/:projectId/tasks/:taskId
```

### Update Status

```http
PATCH /api/kanban/projects/:projectId/tasks/:taskId/status
```

Request body:
```json
{
  "status": "in_progress"
}
```

### Create and Start

Create a task and immediately start workspace execution:

```http
POST /api/kanban/projects/:projectId/tasks/create-and-start
```

Request body:
```json
{
  "title": "Implement login",
  "description": "Add user login feature",
  "priority": "high",
  "workspace_name": "login-feature",
  "branch_name": "feature/login",
  "executor_type": "claude-code",
  "initial_prompt": "Implement a JWT-based login system"
}
```

Response:
```json
{
  "task": { ... },
  "workspace": { ... }
}
```

### Bulk Update

```http
POST /api/kanban/projects/:projectId/tasks/bulk
```

Request body:
```json
{
  "updates": [
    { "task_id": "task-1", "status": "done" },
    { "task_id": "task-2", "priority": "high" }
  ]
}
```

### WebSocket Stream

```
WebSocket: /api/kanban/projects/:projectId/tasks/:taskId/stream
```

Message format:
```json
{
  "type": "task_updated",
  "data": { ... },
  "timestamp": "2026-02-13T11:00:00Z"
}
```

## Related Documentation

- [Storage System](./storage.md) - Storage design
- [Projects](./projects.md) - Project management
- [Workspaces](./workspaces.md) - Workspace management
