---
sidebar_position: 5
---

# Kanban Workspaces

> Workspaces provide isolated Git Worktree environments for agent task execution

## Overview

A Kanban workspace represents an isolated execution environment based on Git Worktree. Each workspace is linked to a task and provides a clean environment for AI agents to work in without affecting the main branch.

## Directory Structure

```
<workspace-root>/.viben/kanban/workspaces/
+-- <workspace-id>/
    +-- workspace.yaml           # Workspace configuration
    +-- execution/               # Execution process records
    |   +-- <process-id>.yaml
    +-- sessions/                # Session storage
        +-- <session-id>/
            +-- config.yaml      # Session config
            +-- messages.jsonl   # Message history

# Git Worktree location (in project repo directory)
<project-repo>/.worktrees/
+-- <workspace-id>/              # Actual working directory
    +-- ...                      # Project files
```

## Workspace Schema

### KanbanWorkspace

```typescript
interface KanbanWorkspace {
  id: string;
  name: string;

  // Associations
  project_id: string;
  task_id?: string;

  // Git Worktree
  worktree_path: string;    // Worktree path
  branch_name: string;      // Branch name
  base_branch?: string;     // Base branch

  // Status
  status: WorkspaceStatus;

  // Agent configuration
  agent?: {
    type: string;           // claude-code, gemini, etc.
    config_path?: string;   // Custom config path
  };

  // Execution info
  current_session_id?: string;
  current_process_id?: string;

  // Timing
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

type WorkspaceStatus =
  | "initializing"   // Initializing (creating worktree)
  | "ready"          // Ready (can start)
  | "running"        // Running
  | "paused"         // Paused
  | "completed"      // Completed
  | "failed"         // Failed
  | "archived";      // Archived
```

### ExecutionProcess

```typescript
interface ExecutionProcess {
  id: string;
  workspace_id: string;
  session_id: string;
  executor_type: string;
  executor_profile_id?: string;
  status: ProcessStatus;
  prompt?: string;
  started_at: string;
  ended_at?: string;
  exit_code?: number;
  error?: string;
}

type ProcessStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
```

### WorkspaceWithDetails

Extended workspace with related information:

```typescript
interface WorkspaceWithDetails extends KanbanWorkspace {
  // Associated task
  task?: {
    id: string;
    title: string;
    status: TaskStatus;
  };

  // Current session
  current_session?: {
    id: string;
    status: SessionStatus;
    message_count: number;
  };

  // Git status
  git_status?: {
    ahead: number;
    behind: number;
    modified: number;
    untracked: number;
  };
}
```

## File Examples

### workspace.yaml

```yaml
id: "ws-1707821000-def456"
name: "implement-login"

project_id: "proj-1707820800-abc123"
task_id: "task-1707820800-xyz789"

worktree_path: "/Users/dev/viben/.worktrees/ws-1707821000-def456"
branch_name: "kanban/implement-login"
base_branch: "main"

status: "running"

agent:
  type: "claude-code"

current_session_id: "sess-1707821100-ghi789"
current_process_id: "proc-1707821200-jkl012"

created_at: "2026-02-13T10:30:00Z"
updated_at: "2026-02-13T11:00:00Z"
started_at: "2026-02-13T10:35:00Z"
```

### execution/process-id.yaml

```yaml
id: "proc-1707821200-jkl012"
workspace_id: "ws-1707821000-def456"
session_id: "sess-1707821100-ghi789"

executor_type: "claude-code"

status: "running"

prompt: "Implement user login feature"

started_at: "2026-02-13T10:35:00Z"
```

## Status Flow

```
                    +---------------+
       create() ----| initializing  |
                    +-------+-------+
                            | worktree created
                            v
                    +---------------+
                    |     ready     |<-----+
                    +-------+-------+      |
                            | start()      | pause()
                            v              |
                    +---------------+      |
           +--------|    running    |------+
           |        +-------+-------+
           |                |
    failed |                | complete()
           v                v
    +---------------+ +---------------+
    |    failed     | |   completed   |
    +---------------+ +-------+-------+
                              | archive()
                              v
                    +---------------+
                    |   archived    |
                    +---------------+
```

## Service Interface

### WorkspaceService

```typescript
class WorkspaceService {
  // Lifecycle
  async create(data: CreateWorkspace): Promise<KanbanWorkspace>;
  async start(id: string, options: StartOptions): Promise<ExecutionProcess>;
  async pause(id: string): Promise<void>;
  async resume(id: string, options?: ResumeOptions): Promise<ExecutionProcess>;
  async complete(id: string, options?: CompleteOptions): Promise<CompleteResult>;
  async archive(id: string): Promise<void>;
  async delete(id: string): Promise<void>;

  // CRUD
  async list(options?: ListWorkspacesOptions): Promise<KanbanWorkspace[]>;
  async get(id: string): Promise<WorkspaceWithDetails>;
  async update(id: string, data: UpdateWorkspace): Promise<KanbanWorkspace>;

  // Query
  async findByTask(taskId: string): Promise<KanbanWorkspace | null>;
  async listByProject(projectId: string): Promise<KanbanWorkspace[]>;
  async listActive(): Promise<KanbanWorkspace[]>;

  // Session operations
  async sendFollowUp(id: string, message: string): Promise<void>;
  async resetToMessage(id: string, messageId: string): Promise<void>;

  // Git operations
  async getGitStatus(id: string): Promise<GitStatus>;
  async commit(id: string, message: string): Promise<string>;
  async push(id: string, options?: PushOptions): Promise<void>;
  async pull(id: string): Promise<void>;
  async createPR(id: string, options: CreatePROptions): Promise<PRInfo>;

  // Streaming
  watchExecution(id: string): AsyncIterable<ExecutionEvent>;
  watchLogs(id: string, processId: string): AsyncIterable<LogLine>;
}
```

### Type Definitions

```typescript
interface CreateWorkspace {
  name: string;
  project_id: string;
  task_id?: string;
  branch_name?: string;     // Default: kanban/<workspace-name>
  base_branch?: string;     // Default: main or master
  agent?: {
    type: string;
    config_path?: string;
  };
}

interface StartOptions {
  prompt?: string;
  executor_type?: string;
  executor_profile_id?: string;
}

interface ResumeOptions {
  prompt?: string;
  reset_to_message_id?: string;
}

interface CompleteOptions {
  action: "merge" | "pr" | "none";
  merge_options?: {
    delete_branch?: boolean;
    squash?: boolean;
  };
  pr_options?: {
    title?: string;
    body?: string;
    reviewers?: string[];
  };
}

interface CompleteResult {
  action: string;
  merge_commit?: string;
  pr_url?: string;
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
}
```

## API Endpoints

### List Workspaces

```http
GET /api/kanban/workspaces
```

Query parameters:
- `project_id`: Filter by project
- `task_id`: Filter by task
- `status`: Filter by status
- `sort`: Sort field
- `order`: Sort order

### Get Workspace

```http
GET /api/kanban/workspaces/:id
```

Response:
```json
{
  "id": "ws-123",
  "name": "feature-workspace",
  "status": "running",
  "task": {
    "id": "task-456",
    "title": "Implement feature"
  },
  "git_status": {
    "ahead": 3,
    "behind": 0,
    "modified": 2
  }
}
```

### Create Workspace

```http
POST /api/kanban/workspaces
```

Request body:
```json
{
  "name": "feature-workspace",
  "project_id": "proj-123",
  "task_id": "task-456",
  "branch_name": "feature/my-feature",
  "agent": {
    "type": "claude-code"
  }
}
```

### Start Workspace

```http
POST /api/kanban/workspaces/:id/start
```

Request body:
```json
{
  "prompt": "Implement the login feature",
  "executor_type": "claude-code"
}
```

### Pause Workspace

```http
POST /api/kanban/workspaces/:id/pause
```

### Resume Workspace

```http
POST /api/kanban/workspaces/:id/resume
```

Request body:
```json
{
  "prompt": "Continue with the tests",
  "reset_to_message_id": "msg-123"
}
```

### Complete Workspace

```http
POST /api/kanban/workspaces/:id/complete
```

Request body:
```json
{
  "action": "pr",
  "pr_options": {
    "title": "Add login feature",
    "body": "Implements JWT-based login",
    "reviewers": ["user1", "user2"]
  }
}
```

### Archive Workspace

```http
POST /api/kanban/workspaces/:id/archive
```

### Follow-up Message

```http
POST /api/kanban/workspaces/:id/follow-up
```

Request body:
```json
{
  "message": "Please also add unit tests"
}
```

### Git Operations

```http
GET /api/kanban/workspaces/:id/git/status
POST /api/kanban/workspaces/:id/git/commit
POST /api/kanban/workspaces/:id/git/push
POST /api/kanban/workspaces/:id/git/pull
POST /api/kanban/workspaces/:id/git/pr
```

### WebSocket Streams

```
WebSocket: /api/kanban/workspaces/:id/execution/stream
WebSocket: /api/kanban/workspaces/:id/logs/:processId/stream
```

## Related Documentation

- [Storage System](./storage.md) - Storage design
- [Tasks](./tasks.md) - Task management
- [Sessions](./sessions.md) - Session management
- [Git Operations](./git-operations.md) - Git operation details
