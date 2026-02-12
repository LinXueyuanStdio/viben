# Kanban 工作区管理模块

> 工作区基于 Git Worktree 实现隔离的执行环境，支持智能体任务执行

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                  Workspace Module                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WorkspaceService                                            │
│      ├── create()           # 创建工作区 (Git Worktree)     │
│      ├── start()            # 启动执行                       │
│      ├── pause()            # 暂停执行                       │
│      ├── resume()           # 恢复执行                       │
│      ├── complete()         # 完成并合并                     │
│      └── archive()          # 归档清理                       │
│                                                              │
│  依赖:                                                       │
│      ├── WorkspaceStore     # 工作区存储                     │
│      ├── GitService         # Git Worktree 操作             │
│      ├── SessionService     # 会话管理                       │
│      ├── ContainerService   # 执行容器                       │
│      └── EventEmitter       # 事件通知                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
<workspace-root>/.viben/kanban/workspaces/
└── <workspace-id>/
    ├── workspace.yaml           # 工作区配置
    ├── execution/               # 执行进程记录
    │   └── <process-id>.yaml
    └── sessions/                # 会话存储
        └── <session-id>/
            ├── config.yaml      # 会话配置
            └── messages.jsonl   # 消息历史

# Git Worktree 位置 (在项目仓库目录下)
<project-repo>/.worktrees/
└── <workspace-id>/              # 实际的工作目录
    └── ...                      # 项目文件
```

---

## 核心类型

### KanbanWorkspace

```typescript
interface KanbanWorkspace {
  id: string;
  name: string;

  // 关联
  project_id: string;
  task_id?: string;

  // Git Worktree
  worktree_path: string;    // 工作树路径
  branch_name: string;      // 分支名
  base_branch?: string;     // 基于的分支

  // 状态
  status: WorkspaceStatus;

  // 智能体配置
  agent?: {
    type: string;           // claude-code, gemini, etc.
    config_path?: string;   // 自定义配置路径
  };

  // 执行信息
  current_session_id?: string;
  current_process_id?: string;

  // 时间
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

type WorkspaceStatus =
  | "initializing"   // 初始化中 (创建 worktree)
  | "ready"          // 就绪 (可以启动)
  | "running"        // 运行中
  | "paused"         // 已暂停
  | "completed"      // 已完成
  | "failed"         // 失败
  | "archived";      // 已归档
```

### ExecutionProcess

```typescript
// execution/<process-id>.yaml
interface ExecutionProcess {
  id: string;
  workspace_id: string;
  session_id: string;

  // 执行器
  executor_type: string;
  executor_profile_id?: string;

  // 状态
  status: ProcessStatus;

  // 输入
  prompt?: string;

  // 时间
  started_at: string;
  ended_at?: string;

  // 结果
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

```typescript
interface WorkspaceWithDetails extends KanbanWorkspace {
  // 关联任务
  task?: {
    id: string;
    title: string;
    status: TaskStatus;
  };

  // 当前会话
  current_session?: {
    id: string;
    status: SessionStatus;
    message_count: number;
  };

  // Git 状态
  git_status?: {
    ahead: number;
    behind: number;
    modified: number;
    untracked: number;
  };
}
```

---

## 服务接口

### WorkspaceService

```typescript
// packages/core/src/kanban/services/workspace-service.ts

export class WorkspaceService {
  constructor(
    private store: KanbanStore,
    private gitService: GitService,
    private sessionService: SessionService,
    private containerService: ContainerService,
    private eventEmitter: EventEmitter
  ) {}

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 创建工作区
   * 1. 创建 Git Worktree
   * 2. 初始化工作区目录
   * 3. 运行 setup script (如果有)
   */
  async create(data: CreateWorkspace): Promise<KanbanWorkspace>;

  /**
   * 启动工作区执行
   * 1. 创建会话
   * 2. 启动执行器
   */
  async start(id: string, options: StartOptions): Promise<ExecutionProcess>;

  /**
   * 暂停执行
   */
  async pause(id: string): Promise<void>;

  /**
   * 恢复执行
   */
  async resume(id: string, options?: ResumeOptions): Promise<ExecutionProcess>;

  /**
   * 完成工作区
   * 可选: 创建 PR 或直接合并
   */
  async complete(id: string, options?: CompleteOptions): Promise<CompleteResult>;

  /**
   * 归档工作区
   * 1. 删除 Git Worktree
   * 2. 保留会话历史
   */
  async archive(id: string): Promise<void>;

  /**
   * 删除工作区
   * 完全删除，包括历史
   */
  async delete(id: string): Promise<void>;

  // ============================================================
  // CRUD
  // ============================================================

  async list(options?: ListWorkspacesOptions): Promise<KanbanWorkspace[]>;
  async get(id: string): Promise<WorkspaceWithDetails>;
  async update(id: string, data: UpdateWorkspace): Promise<KanbanWorkspace>;

  // ============================================================
  // 查询
  // ============================================================

  async findByTask(taskId: string): Promise<KanbanWorkspace | null>;
  async listByProject(projectId: string): Promise<KanbanWorkspace[]>;
  async listActive(): Promise<KanbanWorkspace[]>;

  // ============================================================
  // 会话操作
  // ============================================================

  async sendFollowUp(id: string, message: string): Promise<void>;
  async resetToMessage(id: string, messageId: string): Promise<void>;

  // ============================================================
  // Git 操作
  // ============================================================

  async getGitStatus(id: string): Promise<GitStatus>;
  async commit(id: string, message: string): Promise<string>;
  async push(id: string, options?: PushOptions): Promise<void>;
  async pull(id: string): Promise<void>;
  async createPR(id: string, options: CreatePROptions): Promise<PRInfo>;

  // ============================================================
  // 流式接口
  // ============================================================

  watchExecution(id: string): AsyncIterable<ExecutionEvent>;
  watchLogs(id: string, processId: string): AsyncIterable<LogLine>;
}
```

### 类型定义

```typescript
interface CreateWorkspace {
  name: string;
  project_id: string;
  task_id?: string;

  // Git 配置
  branch_name?: string;     // 默认: kanban/<workspace-name>
  base_branch?: string;     // 默认: main 或 master

  // 智能体配置
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

interface ListWorkspacesOptions {
  project_id?: string;
  task_id?: string;
  status?: WorkspaceStatus[];
  sort?: "created_at" | "updated_at" | "name";
  order?: "asc" | "desc";
}

interface UpdateWorkspace {
  name?: string;
  agent?: {
    type: string;
    config_path?: string;
  };
}

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
}

interface PushOptions {
  force?: boolean;
  set_upstream?: boolean;
}

interface CreatePROptions {
  title: string;
  body?: string;
  base?: string;
  draft?: boolean;
  reviewers?: string[];
}

interface PRInfo {
  number: number;
  url: string;
  title: string;
}

interface ExecutionEvent {
  type: "started" | "progress" | "completed" | "failed" | "cancelled";
  process_id: string;
  data?: any;
  timestamp: string;
}

interface LogLine {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}
```

---

## 文件格式

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

### execution/<process-id>.yaml

```yaml
id: "proc-1707821200-jkl012"
workspace_id: "ws-1707821000-def456"
session_id: "sess-1707821100-ghi789"

executor_type: "claude-code"

status: "running"

prompt: "实现用户登录功能"

started_at: "2026-02-13T10:35:00Z"
```

---

## 状态流转

```
                    ┌───────────────┐
       create() ───▶│ initializing  │
                    └───────┬───────┘
                            │ worktree 创建完成
                            ▼
                    ┌───────────────┐
                    │     ready     │◀─────┐
                    └───────┬───────┘      │
                            │ start()      │ pause()
                            ▼              │
                    ┌───────────────┐      │
           ┌────────│    running    │──────┘
           │        └───────┬───────┘
           │                │
    失败   │                │ complete()
           ▼                ▼
    ┌───────────────┐ ┌───────────────┐
    │    failed     │ │   completed   │
    └───────────────┘ └───────┬───────┘
                              │ archive()
                              ▼
                    ┌───────────────┐
                    │   archived    │
                    └───────────────┘
```

---

## API 路由

### GET /api/kanban/workspaces

列出工作区。

### GET /api/kanban/workspaces/:id

获取工作区详情。

### POST /api/kanban/workspaces

创建工作区。

**请求体:**

```typescript
interface CreateWorkspaceRequest {
  name: string;
  project_id: string;
  task_id?: string;
  branch_name?: string;
  base_branch?: string;
  agent?: {
    type: string;
    config_path?: string;
  };
}
```

### PUT /api/kanban/workspaces/:id

更新工作区。

### DELETE /api/kanban/workspaces/:id

删除工作区。

### POST /api/kanban/workspaces/:id/start

启动工作区执行。

**请求体:**

```typescript
interface StartRequest {
  prompt?: string;
  executor_type?: string;
  executor_profile_id?: string;
}
```

### POST /api/kanban/workspaces/:id/pause

暂停执行。

### POST /api/kanban/workspaces/:id/resume

恢复执行。

**请求体:**

```typescript
interface ResumeRequest {
  prompt?: string;
  reset_to_message_id?: string;
}
```

### POST /api/kanban/workspaces/:id/complete

完成工作区。

**请求体:**

```typescript
interface CompleteRequest {
  action: "merge" | "pr" | "none";
  merge_options?: { ... };
  pr_options?: { ... };
}
```

### POST /api/kanban/workspaces/:id/archive

归档工作区。

### POST /api/kanban/workspaces/:id/follow-up

发送后续消息。

**请求体:**

```typescript
interface FollowUpRequest {
  message: string;
}
```

### GET /api/kanban/workspaces/:id/git/status

获取 Git 状态。

### POST /api/kanban/workspaces/:id/git/commit

提交更改。

### POST /api/kanban/workspaces/:id/git/push

推送到远程。

### POST /api/kanban/workspaces/:id/git/pull

拉取远程更改。

### POST /api/kanban/workspaces/:id/git/pr

创建 Pull Request。

### WebSocket: /api/kanban/workspaces/:id/execution/stream

实时执行日志流。

### WebSocket: /api/kanban/workspaces/:id/logs/:processId/stream

进程日志流。

---

## 实现位置

```
packages/core/src/
├── kanban/
│   ├── models/
│   │   ├── workspace.ts            # KanbanWorkspace 类型
│   │   └── execution.ts            # ExecutionProcess 类型
│   ├── services/
│   │   ├── workspace-service.ts    # WorkspaceService
│   │   └── git-service.ts          # GitService (Worktree 操作)
│   └── storage/
│       ├── workspace-store.ts      # WorkspaceStore
│       └── execution-store.ts      # ExecutionStore
└── gateway/
    └── routes/
        └── kanban/
            └── workspaces.ts        # API 路由
```

---

## 与 vibe-kanban 对比

| 功能 | vibe-kanban | viben-core |
|------|-------------|------------|
| 存储 | workspaces 表 | workspace.yaml 文件 |
| Worktree 管理 | WorktreeManager 服务 | GitService |
| 容器 | ContainerService | 复用现有 ContainerService |
| Git 操作 | 全面 (merge, rebase, cherry-pick) | 基础 (commit, push, pull, PR) |
| 执行日志 | execution_processes 表 | execution/<id>.yaml |

---

## Acceptance Criteria

### 生命周期
- [ ] create() 创建 Git Worktree 和工作区目录
- [ ] start() 启动执行器和会话
- [ ] pause()/resume() 正确暂停和恢复
- [ ] complete() 支持 merge 和 PR
- [ ] archive() 删除 Worktree 但保留历史

### CRUD
- [ ] 列出工作区支持过滤
- [ ] 获取详情包含 Git 状态
- [ ] 更新工作区配置

### Git 操作
- [ ] 获取 Git 状态
- [ ] 提交更改
- [ ] 推送到远程
- [ ] 创建 PR (使用 gh CLI)

### 流式接口
- [ ] 执行日志实时推送
- [ ] 进程日志流

---

## Related Documents

- [storage.md](./storage.md) - 存储系统设计
- [task.md](./task.md) - 任务管理模块
- [session.md](./session.md) - 会话管理模块
- [git-operations.md](./git-operations.md) - Git 操作详细规范
- [/docs/kanban/10-task-attempts.md](/docs/kanban/10-task-attempts.md) - vibe-kanban 工作区 API 参考
