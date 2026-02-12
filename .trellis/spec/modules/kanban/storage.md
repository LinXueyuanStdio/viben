# Kanban 文件存储系统

> 基于文件的看板数据存储，不使用数据库

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                    File Storage System                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  KanbanStore                                                 │
│      ├── ProjectStore      # 项目存储                        │
│      ├── TaskStore         # 任务存储                        │
│      ├── WorkspaceStore    # 工作区存储                      │
│      ├── SessionStore      # 会话存储                        │
│      └── ScratchStore      # 草稿存储                        │
│                                                              │
│  底层依赖:                                                   │
│      ├── YamlParser        # YAML 解析                       │
│      ├── JsonlParser       # JSONL 解析 (消息历史)           │
│      └── FileWatcher       # 文件变更监听                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
<workspace-root>/.viben/kanban/
├── config.yaml                      # 全局看板配置
├── projects/                        # 项目目录
│   └── <project-id>/
│       ├── project.yaml             # 项目元数据
│       ├── tasks/                   # 任务文件
│       │   ├── <task-id>.yaml       # 单个任务
│       │   └── ...
│       ├── tags.yaml                # 项目标签定义
│       └── repositories/            # 关联仓库
│           └── <repo-id>.yaml
├── workspaces/                      # Kanban 工作区 (Git Worktree)
│   └── <workspace-id>/
│       ├── workspace.yaml           # 工作区配置
│       ├── execution/               # 执行进程
│       │   └── <process-id>.yaml
│       └── sessions/                # 会话存储
│           └── <session-id>/
│               ├── config.yaml      # 会话配置
│               └── messages.jsonl   # 消息历史
├── scratch/                         # 草稿存储
│   └── <scratch-type>/
│       └── <id>.yaml
└── images/                          # 图片存储
    └── <image-id>.<ext>
```

---

## 核心类型

### KanbanConfig

```typescript
// config.yaml
interface KanbanConfig {
  version: 1;

  // 默认设置
  defaults: {
    task_status: TaskStatus;
    workspace_branch_prefix: string;  // 默认: "kanban/"
  };

  // UI 偏好
  preferences: {
    default_view: "board" | "list" | "timeline";
    columns: string[];  // 看板列顺序
  };
}
```

### Project

```typescript
// projects/<id>/project.yaml
interface Project {
  id: string;
  name: string;
  description?: string;

  // Git 仓库路径 (主仓库)
  git_repo_path: string;

  // 关联的其他仓库
  repositories?: string[];  // repository IDs

  // 设置脚本 (工作区初始化时执行)
  setup_script?: string;

  // 默认智能体配置
  default_agent?: {
    type: string;  // claude-code, gemini, etc.
    working_dir?: string;
  };

  created_at: string;  // ISO 8601
  updated_at: string;
}
```

### Task

```typescript
// projects/<project-id>/tasks/<id>.yaml
interface Task {
  id: string;
  project_id: string;

  // 基本信息
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: Priority;

  // 分配
  assignee?: string;  // Agent ID 或用户标识
  tags?: string[];

  // 关联
  workspace_id?: string;  // 关联的工作区
  parent_task_id?: string;  // 父任务

  // 元数据
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

```typescript
// workspaces/<id>/workspace.yaml
interface KanbanWorkspace {
  id: string;
  name: string;

  // 关联
  project_id: string;
  task_id?: string;  // 关联的任务

  // Git Worktree 信息
  worktree_path: string;
  branch_name: string;
  base_branch?: string;  // 基于哪个分支创建

  // 状态
  status: WorkspaceStatus;

  // 智能体配置
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

```typescript
// workspaces/<ws-id>/sessions/<id>/config.yaml
interface Session {
  id: string;
  workspace_id: string;

  // 执行器信息
  executor_type: string;
  executor_profile_id?: string;

  // 状态
  status: SessionStatus;

  // 消息统计
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

---

## 存储服务

### KanbanStore

```typescript
// packages/core/src/kanban/storage/kanban-store.ts

export class KanbanStore {
  private rootPath: string;

  constructor(workspaceRoot: string) {
    this.rootPath = path.join(workspaceRoot, '.viben', 'kanban');
  }

  // 子存储
  get projects(): ProjectStore;
  get tasks(): TaskStore;
  get workspaces(): WorkspaceStore;
  get sessions(): SessionStore;
  get scratch(): ScratchStore;

  // 初始化
  async init(): Promise<void>;

  // 配置
  async getConfig(): Promise<KanbanConfig>;
  async updateConfig(config: Partial<KanbanConfig>): Promise<void>;
}
```

### ProjectStore

```typescript
// packages/core/src/kanban/storage/project-store.ts

export class ProjectStore {
  constructor(private basePath: string) {}

  // CRUD
  async list(): Promise<Project[]>;
  async get(id: string): Promise<Project | null>;
  async create(data: CreateProject): Promise<Project>;
  async update(id: string, data: UpdateProject): Promise<Project>;
  async delete(id: string): Promise<void>;

  // 搜索
  async search(query: string): Promise<Project[]>;

  // 仓库管理
  async addRepository(projectId: string, repoPath: string): Promise<void>;
  async removeRepository(projectId: string, repoId: string): Promise<void>;
}
```

### TaskStore

```typescript
// packages/core/src/kanban/storage/task-store.ts

export class TaskStore {
  constructor(private basePath: string) {}

  // CRUD
  async list(projectId: string, options?: ListTasksOptions): Promise<Task[]>;
  async get(projectId: string, taskId: string): Promise<Task | null>;
  async create(projectId: string, data: CreateTask): Promise<Task>;
  async update(projectId: string, taskId: string, data: UpdateTask): Promise<Task>;
  async delete(projectId: string, taskId: string): Promise<void>;

  // 批量操作
  async bulkUpdate(projectId: string, updates: BulkTaskUpdate[]): Promise<void>;

  // 状态变更
  async updateStatus(projectId: string, taskId: string, status: TaskStatus): Promise<Task>;

  // 标签
  async addTag(projectId: string, taskId: string, tag: string): Promise<void>;
  async removeTag(projectId: string, taskId: string, tag: string): Promise<void>;
}

interface ListTasksOptions {
  status?: TaskStatus[];
  tags?: string[];
  assignee?: string;
  sort?: "created_at" | "updated_at" | "priority" | "due_date";
  order?: "asc" | "desc";
}
```

### WorkspaceStore

```typescript
// packages/core/src/kanban/storage/workspace-store.ts

export class WorkspaceStore {
  constructor(private basePath: string) {}

  // CRUD
  async list(options?: ListWorkspacesOptions): Promise<KanbanWorkspace[]>;
  async get(id: string): Promise<KanbanWorkspace | null>;
  async create(data: CreateWorkspace): Promise<KanbanWorkspace>;
  async update(id: string, data: UpdateWorkspace): Promise<KanbanWorkspace>;
  async delete(id: string): Promise<void>;

  // 状态管理
  async updateStatus(id: string, status: WorkspaceStatus): Promise<void>;

  // 通过任务查找
  async findByTask(taskId: string): Promise<KanbanWorkspace | null>;

  // 通过项目列表
  async listByProject(projectId: string): Promise<KanbanWorkspace[]>;
}
```

### SessionStore

```typescript
// packages/core/src/kanban/storage/session-store.ts

export class SessionStore {
  constructor(private basePath: string) {}

  // CRUD
  async list(workspaceId: string): Promise<Session[]>;
  async get(workspaceId: string, sessionId: string): Promise<Session | null>;
  async create(workspaceId: string, data: CreateSession): Promise<Session>;
  async delete(workspaceId: string, sessionId: string): Promise<void>;

  // 消息操作
  async appendMessage(workspaceId: string, sessionId: string, message: Message): Promise<void>;
  async getMessages(workspaceId: string, sessionId: string, options?: GetMessagesOptions): Promise<Message[]>;
  async clearMessages(workspaceId: string, sessionId: string): Promise<void>;
}

interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  after?: string;  // message ID
}
```

---

## 文件格式

### YAML 文件

```yaml
# project.yaml 示例
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

### JSONL 文件 (消息历史)

```jsonl
{"id":"msg-1","role":"user","content":"Hello","timestamp":"2026-02-13T10:00:00Z"}
{"id":"msg-2","role":"assistant","content":"Hi there!","timestamp":"2026-02-13T10:00:01Z"}
{"id":"msg-3","role":"user","content":"Help me with...","timestamp":"2026-02-13T10:01:00Z"}
```

---

## 工具函数

### YamlParser

```typescript
// packages/core/src/kanban/storage/yaml-parser.ts

export class YamlParser {
  // 读取
  static async read<T>(filePath: string): Promise<T | null>;
  static async readRequired<T>(filePath: string): Promise<T>;

  // 写入
  static async write<T>(filePath: string, data: T): Promise<void>;

  // 更新 (读取-合并-写入)
  static async update<T>(filePath: string, updates: Partial<T>): Promise<T>;
}
```

### JsonlParser

```typescript
// packages/core/src/kanban/storage/jsonl-parser.ts

export class JsonlParser {
  // 读取
  static async readAll<T>(filePath: string): Promise<T[]>;
  static async readLast<T>(filePath: string, count: number): Promise<T[]>;

  // 追加
  static async append<T>(filePath: string, item: T): Promise<void>;
  static async appendMany<T>(filePath: string, items: T[]): Promise<void>;

  // 流式读取
  static stream<T>(filePath: string): AsyncIterable<T>;
}
```

### FileWatcher

```typescript
// packages/core/src/kanban/storage/file-watcher.ts

export class FileWatcher {
  constructor(private basePath: string) {}

  // 监听目录变化
  watch(pattern: string, callback: (event: WatchEvent) => void): () => void;

  // 停止所有监听
  close(): void;
}

interface WatchEvent {
  type: "create" | "update" | "delete";
  path: string;
  timestamp: Date;
}
```

---

## ID 生成策略

```typescript
// packages/core/src/kanban/storage/id-generator.ts

export function generateId(prefix?: string): string {
  // 格式: <prefix>-<timestamp>-<random>
  // 示例: proj-1707820800-abc123
  const timestamp = Math.floor(Date.now() / 1000);
  const random = crypto.randomBytes(3).toString('hex');
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

// 预定义前缀
export const ID_PREFIX = {
  PROJECT: 'proj',
  TASK: 'task',
  WORKSPACE: 'ws',
  SESSION: 'sess',
  MESSAGE: 'msg',
} as const;
```

---

## 并发控制

```typescript
// 文件级锁 (防止并发写入冲突)
export class FileLock {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire(filePath: string): Promise<() => void>;
}

// 使用示例
const lock = new FileLock();
const release = await lock.acquire('/path/to/file.yaml');
try {
  await YamlParser.write(filePath, data);
} finally {
  release();
}
```

---

## 错误处理

```typescript
export class StorageError extends Error {
  constructor(
    message: string,
    public code: StorageErrorCode,
    public path?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export enum StorageErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PARSE_ERROR = 'PARSE_ERROR',
  WRITE_ERROR = 'WRITE_ERROR',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
}
```

---

## 迁移工具

从 SQLite 迁移到文件存储的工具（可选）：

```typescript
// packages/core/src/kanban/migration/sqlite-to-files.ts

export async function migrateFromSqlite(
  sqlitePath: string,
  targetPath: string
): Promise<MigrationReport>;

interface MigrationReport {
  projects_migrated: number;
  tasks_migrated: number;
  workspaces_migrated: number;
  errors: string[];
}
```

---

## Acceptance Criteria

### 基础存储
- [ ] KanbanStore 正确初始化目录结构
- [ ] YamlParser 正确读写 YAML 文件
- [ ] JsonlParser 正确处理 JSONL 文件
- [ ] ID 生成唯一且可读

### 项目存储
- [ ] ProjectStore CRUD 操作正常
- [ ] 项目搜索功能正常
- [ ] 仓库关联管理正常

### 任务存储
- [ ] TaskStore CRUD 操作正常
- [ ] 任务过滤和排序正常
- [ ] 批量更新正常
- [ ] 标签管理正常

### 工作区存储
- [ ] WorkspaceStore CRUD 操作正常
- [ ] 状态管理正常
- [ ] 按项目/任务查询正常

### 会话存储
- [ ] SessionStore CRUD 操作正常
- [ ] 消息追加和读取正常
- [ ] JSONL 流式读取正常

### 并发和错误
- [ ] 文件锁防止写入冲突
- [ ] 错误码正确分类
- [ ] 文件监听正常工作

---

## Related Documents

- [index.md](./index.md) - Kanban 模块索引
- [project.md](./project.md) - 项目管理模块
- [task.md](./task.md) - 任务管理模块
- [../cli/agent.md](../cli/agent.md) - Agent 存储设计参考
