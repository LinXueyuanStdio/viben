# Kanban 任务管理模块

> 任务是看板的核心单元，支持状态流转、优先级、标签和工作区关联

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Task Module                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TaskService                                                 │
│      ├── create()           # 创建任务                       │
│      ├── update()           # 更新任务                       │
│      ├── updateStatus()     # 状态变更                       │
│      ├── createAndStart()   # 创建并启动执行                 │
│      └── bulkUpdate()       # 批量更新                       │
│                                                              │
│  依赖:                                                       │
│      ├── TaskStore          # 任务存储                       │
│      ├── WorkspaceService   # 工作区服务 (创建关联)          │
│      └── EventEmitter       # 事件通知                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
<workspace>/.viben/kanban/projects/<project-id>/
└── tasks/
    ├── <task-id>.yaml       # 任务文件
    ├── <task-id>.yaml
    └── ...
```

---

## 核心类型

### Task

```typescript
interface Task {
  id: string;
  project_id: string;

  // 基本信息
  title: string;
  description?: string;

  // 状态和优先级
  status: TaskStatus;
  priority: Priority;

  // 分配和标签
  assignee?: string;       // Agent ID 或用户标识
  tags?: string[];         // 标签 ID 列表

  // 关联
  workspace_id?: string;   // 关联的工作区
  parent_task_id?: string; // 父任务 (子任务支持)

  // 时间
  due_date?: string;       // ISO 8601
  created_at: string;
  updated_at: string;
  completed_at?: string;

  // 执行信息 (当有关联工作区时)
  execution?: TaskExecution;
}

type TaskStatus =
  | "backlog"        // 待办池
  | "todo"           // 待开始
  | "in_progress"    // 进行中
  | "in_review"      // 审查中
  | "done"           // 已完成
  | "cancelled";     // 已取消

type Priority =
  | "urgent"    // 紧急
  | "high"      // 高
  | "medium"    // 中
  | "low"       // 低
  | "none";     // 无
```

### TaskExecution

```typescript
// 任务执行信息 (嵌入 task.yaml)
interface TaskExecution {
  workspace_id: string;
  session_id?: string;

  // 执行器信息
  executor_type: string;

  // 状态
  started_at?: string;
  completed_at?: string;

  // 结果
  result?: {
    success: boolean;
    summary?: string;
    error?: string;
  };
}
```

### TaskWithDetails

```typescript
// 带有完整详情的任务 (API 返回)
interface TaskWithDetails extends Task {
  // 关联工作区信息
  workspace?: {
    id: string;
    name: string;
    status: WorkspaceStatus;
    branch_name: string;
  };

  // 最新会话信息
  latest_session?: {
    id: string;
    status: SessionStatus;
    message_count: number;
    last_message_at?: string;
  };

  // 标签详情
  tag_details?: Tag[];
}
```

---

## 服务接口

### TaskService

```typescript
// packages/core/src/kanban/services/task-service.ts

export class TaskService {
  constructor(
    private store: KanbanStore,
    private workspaceService: WorkspaceService,
    private eventEmitter: EventEmitter
  ) {}

  // ============================================================
  // 任务 CRUD
  // ============================================================

  /**
   * 列出项目的任务
   */
  async list(projectId: string, options?: ListTasksOptions): Promise<Task[]>;

  /**
   * 获取任务详情
   */
  async get(projectId: string, taskId: string): Promise<TaskWithDetails>;

  /**
   * 创建任务
   */
  async create(projectId: string, data: CreateTask): Promise<Task>;

  /**
   * 更新任务
   */
  async update(projectId: string, taskId: string, data: UpdateTask): Promise<Task>;

  /**
   * 删除任务
   */
  async delete(projectId: string, taskId: string): Promise<void>;

  // ============================================================
  // 状态管理
  // ============================================================

  /**
   * 更新任务状态
   */
  async updateStatus(
    projectId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<Task>;

  /**
   * 批量更新状态
   */
  async bulkUpdateStatus(
    projectId: string,
    taskIds: string[],
    status: TaskStatus
  ): Promise<void>;

  // ============================================================
  // 创建并启动
  // ============================================================

  /**
   * 创建任务并立即启动工作区执行
   */
  async createAndStart(
    projectId: string,
    data: CreateTaskAndStart
  ): Promise<{ task: Task; workspace: KanbanWorkspace }>;

  // ============================================================
  // 标签操作
  // ============================================================

  /**
   * 添加标签
   */
  async addTag(projectId: string, taskId: string, tagId: string): Promise<void>;

  /**
   * 移除标签
   */
  async removeTag(projectId: string, taskId: string, tagId: string): Promise<void>;

  // ============================================================
  // 批量操作
  // ============================================================

  /**
   * 批量更新
   */
  async bulkUpdate(projectId: string, updates: BulkTaskUpdate[]): Promise<void>;

  // ============================================================
  // 流式接口
  // ============================================================

  /**
   * 监听任务变更 (WebSocket)
   */
  watchTask(projectId: string, taskId: string): AsyncIterable<TaskEvent>;
}
```

### 类型定义

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
  // 任务信息
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];

  // 工作区配置
  workspace_name?: string;
  branch_name?: string;
  base_branch?: string;

  // 执行器配置
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

---

## 文件格式

### task.yaml

```yaml
id: "task-1707820800-xyz789"
project_id: "proj-1707820800-abc123"

title: "实现用户登录功能"
description: |
  实现基于 JWT 的用户登录功能，包括：
  - 登录表单验证
  - API 调用
  - Token 存储
  - 错误处理

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

---

## 状态流转

```
                    ┌─────────────┐
                    │   backlog   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
           ┌────────│    todo     │────────┐
           │        └──────┬──────┘        │
           │               │               │
           │               ▼               │
           │        ┌─────────────┐        │
           │        │ in_progress │        │
           │        └──────┬──────┘        │
           │               │               │
           │               ▼               │
           │        ┌─────────────┐        │
           │        │  in_review  │        │
           │        └──────┬──────┘        │
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  cancelled  │ │    done     │ │   返回上一步 │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### 状态变更规则

```typescript
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "backlog", "cancelled"],
  in_progress: ["in_review", "done", "todo", "cancelled"],
  in_review: ["done", "in_progress", "cancelled"],
  done: ["in_progress"],  // 重新打开
  cancelled: ["backlog", "todo"],  // 恢复
};
```

---

## API 路由

### GET /api/kanban/projects/:projectId/tasks

列出项目的任务。

**Query 参数:**

```typescript
interface ListTasksQuery {
  status?: string;         // 逗号分隔的状态列表
  priority?: string;       // 逗号分隔的优先级列表
  tags?: string;           // 逗号分隔的标签 ID
  assignee?: string;
  has_workspace?: boolean;
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}
```

**响应:**

```typescript
interface ListTasksResponse {
  tasks: Task[];
  total: number;
}
```

### GET /api/kanban/projects/:projectId/tasks/:taskId

获取任务详情。

**响应:**

```typescript
interface GetTaskResponse {
  task: TaskWithDetails;
}
```

### POST /api/kanban/projects/:projectId/tasks

创建任务。

**请求体:**

```typescript
interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  tags?: string[];
  assignee?: string;
  due_date?: string;
}
```

### PUT /api/kanban/projects/:projectId/tasks/:taskId

更新任务。

### DELETE /api/kanban/projects/:projectId/tasks/:taskId

删除任务。

### PATCH /api/kanban/projects/:projectId/tasks/:taskId/status

更新任务状态。

**请求体:**

```typescript
interface UpdateStatusRequest {
  status: TaskStatus;
}
```

### POST /api/kanban/projects/:projectId/tasks/create-and-start

创建任务并启动执行。

**请求体:**

```typescript
interface CreateAndStartRequest {
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  workspace_name?: string;
  branch_name?: string;
  base_branch?: string;
  executor_type: string;
  initial_prompt?: string;
}
```

**响应:**

```typescript
interface CreateAndStartResponse {
  task: Task;
  workspace: KanbanWorkspace;
}
```

### POST /api/kanban/projects/:projectId/tasks/bulk

批量更新任务。

**请求体:**

```typescript
interface BulkUpdateRequest {
  updates: BulkTaskUpdate[];
}
```

### WebSocket: /api/kanban/projects/:projectId/tasks/:taskId/stream

实时监听任务变更。

**消息格式:**

```typescript
interface TaskStreamMessage {
  type: "task_updated" | "status_changed" | "execution_update";
  data: Task | ExecutionUpdate;
  timestamp: string;
}
```

---

## 实现位置

```
packages/core/src/
├── kanban/
│   ├── models/
│   │   └── task.ts                 # Task 类型定义
│   ├── services/
│   │   └── task-service.ts         # TaskService
│   └── storage/
│       └── task-store.ts           # TaskStore
└── gateway/
    └── routes/
        └── kanban/
            └── tasks.ts             # API 路由
```

---

## 与 vibe-kanban 对比

| 功能 | vibe-kanban | viben-core |
|------|-------------|------------|
| 存储 | SQLite tasks 表 | tasks/<id>.yaml 文件 |
| WebSocket | 数据库轮询 | 文件监听 |
| 批量操作 | SQL 事务 | 顺序写入 |
| 搜索 | SQL LIKE | 内存过滤 |
| create-and-start | 支持 | 支持 |
| 子任务 | 不支持 | parent_task_id |

---

## Acceptance Criteria

### 任务 CRUD
- [ ] 创建任务生成正确的 YAML 文件
- [ ] 更新任务保留未修改字段
- [ ] 删除任务同时清理关联工作区
- [ ] 列出任务支持过滤和排序

### 状态管理
- [ ] 状态变更遵循流转规则
- [ ] 状态变更触发事件通知
- [ ] done 状态自动设置 completed_at

### 创建并启动
- [ ] create-and-start 创建任务和工作区
- [ ] 工作区正确关联到任务
- [ ] 启动执行器

### 批量操作
- [ ] 批量更新状态
- [ ] 批量更新优先级和分配

### 流式接口
- [ ] WebSocket 推送任务变更
- [ ] 正确处理连接断开

---

## Related Documents

- [storage.md](./storage.md) - 存储系统设计
- [project.md](./project.md) - 项目管理模块
- [workspace.md](./workspace.md) - 工作区管理模块
- [api-tasks.md](./api-tasks.md) - 任务 API 详细规范 (计划中)
