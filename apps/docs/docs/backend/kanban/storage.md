---
sidebar_position: 2
---

# Kanban Storage System

> File-based storage for kanban data without a database

## Overview

The Kanban storage system provides a complete file-based persistence layer. All data is stored as YAML files for structured data and JSONL files for message history, making the data human-readable and easy to version control.

## Architecture

```
+-------------------------------------------------------------+
|                    File Storage System                        |
+-------------------------------------------------------------+
|                                                              |
|  KanbanStore                                                 |
|      +-- ProjectStore      # Project storage                 |
|      +-- TaskStore         # Task storage                    |
|      +-- WorkspaceStore    # Workspace storage               |
|      +-- SessionStore      # Session storage                 |
|      +-- ScratchStore      # Draft storage                   |
|                                                              |
|  Dependencies:                                               |
|      +-- YamlParser        # YAML parsing                    |
|      +-- JsonlParser       # JSONL parsing (message history) |
|      +-- FileWatcher       # File change monitoring          |
|                                                              |
+-------------------------------------------------------------+
```

## Directory Structure

```
<workspace-root>/.viben/kanban/
+-- config.yaml                      # Global kanban config
+-- projects/                        # Project directories
|   +-- <project-id>/
|       +-- project.yaml             # Project metadata
|       +-- tasks/                   # Task files
|       |   +-- <task-id>.yaml       # Individual task
|       |   +-- ...
|       +-- tags.yaml                # Project tag definitions
|       +-- repositories/            # Associated repositories
|           +-- <repo-id>.yaml
+-- workspaces/                      # Kanban workspaces (Git Worktrees)
|   +-- <workspace-id>/
|       +-- workspace.yaml           # Workspace config
|       +-- execution/               # Execution processes
|       |   +-- <process-id>.yaml
|       +-- sessions/                # Session storage
|           +-- <session-id>/
|               +-- config.yaml      # Session config
|               +-- messages.jsonl   # Message history
+-- scratch/                         # Draft storage
|   +-- <scratch-type>/
|       +-- <id>.yaml
+-- images/                          # Image storage
    +-- <image-id>.<ext>
```

## Core Types

### KanbanConfig

The global configuration for the kanban board:

```typescript
interface KanbanConfig {
  version: 1;

  defaults: {
    task_status: TaskStatus;
    workspace_branch_prefix: string;  // Default: "kanban/"
  };

  preferences: {
    default_view: "board" | "list" | "timeline";
    columns: string[];  // Kanban column order
  };
}
```

### Project

Project metadata stored in `projects/<id>/project.yaml`:

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  git_repo_path: string;
  repositories?: string[];
  setup_script?: string;
  default_agent?: {
    type: string;
    working_dir?: string;
  };
  created_at: string;  // ISO 8601
  updated_at: string;
}
```

### Task

Task data stored in `projects/<project-id>/tasks/<id>.yaml`:

```typescript
interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: Priority;
  assignee?: string;
  tags?: string[];
  workspace_id?: string;
  parent_task_id?: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
  completed_at?: string;
}

type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

type Priority =
  | "urgent"
  | "high"
  | "medium"
  | "low"
  | "none";
```

### KanbanWorkspace

Workspace configuration stored in `workspaces/<id>/workspace.yaml`:

```typescript
interface KanbanWorkspace {
  id: string;
  name: string;
  project_id: string;
  task_id?: string;
  worktree_path: string;
  branch_name: string;
  base_branch?: string;
  status: WorkspaceStatus;
  agent?: {
    type: string;
    config_path?: string;
  };
  created_at: string;
  updated_at: string;
}

type WorkspaceStatus =
  | "initializing"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "archived";
```

### Session

Session configuration stored in `workspaces/<ws-id>/sessions/<id>/config.yaml`:

```typescript
interface Session {
  id: string;
  workspace_id: string;
  executor_type: string;
  executor_profile_id?: string;
  status: SessionStatus;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

type SessionStatus =
  | "active"
  | "paused"
  | "completed"
  | "failed";
```

## Storage Services

### KanbanStore

The main store providing access to all sub-stores:

```typescript
class KanbanStore {
  constructor(workspaceRoot: string);

  // Sub-stores
  get projects(): ProjectStore;
  get tasks(): TaskStore;
  get workspaces(): WorkspaceStore;
  get sessions(): SessionStore;
  get scratch(): ScratchStore;

  // Initialization
  async init(): Promise<void>;

  // Configuration
  async getConfig(): Promise<KanbanConfig>;
  async updateConfig(config: Partial<KanbanConfig>): Promise<void>;
}
```

### ProjectStore

```typescript
class ProjectStore {
  async list(): Promise<Project[]>;
  async get(id: string): Promise<Project | null>;
  async create(data: CreateProject): Promise<Project>;
  async update(id: string, data: UpdateProject): Promise<Project>;
  async delete(id: string): Promise<void>;
  async search(query: string): Promise<Project[]>;
  async addRepository(projectId: string, repoPath: string): Promise<void>;
  async removeRepository(projectId: string, repoId: string): Promise<void>;
}
```

### TaskStore

```typescript
class TaskStore {
  async list(projectId: string, options?: ListTasksOptions): Promise<Task[]>;
  async get(projectId: string, taskId: string): Promise<Task | null>;
  async create(projectId: string, data: CreateTask): Promise<Task>;
  async update(projectId: string, taskId: string, data: UpdateTask): Promise<Task>;
  async delete(projectId: string, taskId: string): Promise<void>;
  async bulkUpdate(projectId: string, updates: BulkTaskUpdate[]): Promise<void>;
  async updateStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task>;
  async addTag(projectId: string, taskId: string, tag: string): Promise<void>;
  async removeTag(projectId: string, taskId: string, tag: string): Promise<void>;
}
```

### WorkspaceStore

```typescript
class WorkspaceStore {
  async list(options?: ListWorkspacesOptions): Promise<KanbanWorkspace[]>;
  async get(id: string): Promise<KanbanWorkspace | null>;
  async create(data: CreateWorkspace): Promise<KanbanWorkspace>;
  async update(id: string, data: UpdateWorkspace): Promise<KanbanWorkspace>;
  async delete(id: string): Promise<void>;
  async updateStatus(id: string, status: WorkspaceStatus): Promise<void>;
  async findByTask(taskId: string): Promise<KanbanWorkspace | null>;
  async listByProject(projectId: string): Promise<KanbanWorkspace[]>;
}
```

### SessionStore

```typescript
class SessionStore {
  async list(workspaceId: string): Promise<Session[]>;
  async get(workspaceId: string, sessionId: string): Promise<Session | null>;
  async create(workspaceId: string, data: CreateSession): Promise<Session>;
  async delete(workspaceId: string, sessionId: string): Promise<void>;
  async appendMessage(workspaceId: string, sessionId: string, message: Message): Promise<void>;
  async getMessages(workspaceId: string, sessionId: string, options?: GetMessagesOptions): Promise<Message[]>;
  async clearMessages(workspaceId: string, sessionId: string): Promise<void>;
}
```

## File Formats

### YAML Files

```yaml
# project.yaml example
id: "proj-abc123"
name: "My Project"
description: "A sample project"
git_repo_path: "/Users/dev/my-project"
setup_script: |
  npm install
  npm run build
default_agent:
  type: "claude-code"
created_at: "2026-02-13T10:00:00Z"
updated_at: "2026-02-13T10:00:00Z"
```

### JSONL Files (Message History)

```jsonl
{"id":"msg-1","role":"user","content":"Hello","timestamp":"2026-02-13T10:00:00Z"}
{"id":"msg-2","role":"assistant","content":"Hi there!","timestamp":"2026-02-13T10:00:01Z"}
{"id":"msg-3","role":"user","content":"Help me with...","timestamp":"2026-02-13T10:01:00Z"}
```

## Utility Classes

### YamlParser

```typescript
class YamlParser {
  static async read<T>(filePath: string): Promise<T | null>;
  static async readRequired<T>(filePath: string): Promise<T>;
  static async write<T>(filePath: string, data: T): Promise<void>;
  static async update<T>(filePath: string, updates: Partial<T>): Promise<T>;
}
```

### JsonlParser

```typescript
class JsonlParser {
  static async readAll<T>(filePath: string): Promise<T[]>;
  static async readLast<T>(filePath: string, count: number): Promise<T[]>;
  static async append<T>(filePath: string, item: T): Promise<void>;
  static async appendMany<T>(filePath: string, items: T[]): Promise<void>;
  static stream<T>(filePath: string): AsyncIterable<T>;
}
```

### FileWatcher

```typescript
class FileWatcher {
  constructor(basePath: string);

  watch(pattern: string, callback: (event: WatchEvent) => void): () => void;
  close(): void;
}

interface WatchEvent {
  type: "create" | "update" | "delete";
  path: string;
  timestamp: Date;
}
```

## ID Generation

IDs are generated with a predictable format for readability:

```typescript
function generateId(prefix?: string): string {
  // Format: <prefix>-<timestamp>-<random>
  // Example: proj-1707820800-abc123
  const timestamp = Math.floor(Date.now() / 1000);
  const random = crypto.randomBytes(3).toString('hex');
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

// Predefined prefixes
const ID_PREFIX = {
  PROJECT: 'proj',
  TASK: 'task',
  WORKSPACE: 'ws',
  SESSION: 'sess',
  MESSAGE: 'msg',
};
```

## Concurrency Control

File-level locking prevents concurrent write conflicts:

```typescript
class FileLock {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(filePath: string): Promise<() => void>;
}

// Usage example
const lock = new FileLock();
const release = await lock.acquire('/path/to/file.yaml');
try {
  await YamlParser.write(filePath, data);
} finally {
  release();
}
```

## Error Handling

```typescript
class StorageError extends Error {
  constructor(
    message: string,
    public code: StorageErrorCode,
    public path?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

enum StorageErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PARSE_ERROR = 'PARSE_ERROR',
  WRITE_ERROR = 'WRITE_ERROR',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
}
```

## Related Documentation

- [Kanban Index](./index.md) - Module overview
- [Projects](./projects.md) - Project management
- [Tasks](./tasks.md) - Task management
