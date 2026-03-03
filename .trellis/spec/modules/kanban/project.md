# Kanban 项目管理模块

> 项目是看板的顶层组织单元，管理任务、仓库和工作区

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                    Project Module                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ProjectService                                              │
│      ├── create()         # 创建项目                         │
│      ├── update()         # 更新项目                         │
│      ├── delete()         # 删除项目                         │
│      ├── search()         # 搜索项目                         │
│      └── addRepository()  # 添加仓库                         │
│                                                              │
│  依赖:                                                       │
│      ├── ProjectStore     # 项目存储                         │
│      ├── TaskStore        # 任务存储 (级联删除)              │
│      ├── WorkspaceStore   # 工作区存储 (级联删除)            │
│      └── GitService       # Git 操作                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
<workspace>/.viben/kanban/projects/
└── <project-id>/
    ├── project.yaml           # 项目元数据
    ├── tasks/                 # 任务文件
    │   ├── <task-id>.yaml
    │   └── ...
    ├── tags.yaml              # 项目标签定义
    └── repositories/          # 关联仓库配置
        └── <repo-id>.yaml
```

---

## 核心类型

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;

  // Git 仓库 (主仓库路径)
  git_repo_path: string;

  // 设置脚本 (工作区初始化时运行)
  setup_script?: string;

  // 默认智能体配置
  default_agent?: {
    type: AgentType;  // claude-code, gemini, codex, etc.
    working_dir?: string;
  };

  // 统计 (计算字段)
  stats?: {
    task_count: number;
    workspace_count: number;
    active_workspace_count: number;
  };

  created_at: string;
  updated_at: string;
}

type AgentType =
  | "claude-code"
  | "gemini"
  | "codex"
  | "cursor"
  | "qwen-code"
  | "copilot"
  | "amp"
  | "opencode"
  | "droid";
```

### Repository

```typescript
// repositories/<repo-id>.yaml
interface Repository {
  id: string;
  project_id: string;

  // 仓库信息
  path: string;          // 本地路径
  remote_url?: string;   // 远程 URL (可选)
  default_branch: string;

  // 状态
  is_primary: boolean;   // 是否为主仓库

  added_at: string;
}
```

### ProjectTag

```typescript
// tags.yaml
interface ProjectTags {
  tags: Tag[];
}

interface Tag {
  id: string;
  name: string;
  color?: string;  // HEX 颜色
  created_at: string;
}
```

---

## 服务接口

### ProjectService

```typescript
// packages/core/src/kanban/services/project-service.ts

export class ProjectService {
  constructor(
    private store: KanbanStore,
    private gitService: GitService
  ) {}

  // ============================================================
  // 项目 CRUD
  // ============================================================

  /**
   * 列出所有项目
   */
  async list(options?: ListProjectsOptions): Promise<Project[]>;

  /**
   * 获取单个项目
   */
  async get(id: string): Promise<Project>;

  /**
   * 创建项目
   */
  async create(data: CreateProject): Promise<Project>;

  /**
   * 更新项目
   */
  async update(id: string, data: UpdateProject): Promise<Project>;

  /**
   * 删除项目 (级联删除任务和工作区)
   */
  async delete(id: string): Promise<void>;

  /**
   * 搜索项目
   */
  async search(query: string): Promise<Project[]>;

  // ============================================================
  // 仓库管理
  // ============================================================

  /**
   * 列出项目的所有仓库
   */
  async listRepositories(projectId: string): Promise<Repository[]>;

  /**
   * 添加仓库到项目
   */
  async addRepository(projectId: string, repoPath: string): Promise<Repository>;

  /**
   * 移除仓库
   */
  async removeRepository(projectId: string, repoId: string): Promise<void>;

  /**
   * 设置主仓库
   */
  async setPrimaryRepository(projectId: string, repoId: string): Promise<void>;

  // ============================================================
  // 标签管理
  // ============================================================

  /**
   * 获取项目标签
   */
  async getTags(projectId: string): Promise<Tag[]>;

  /**
   * 创建标签
   */
  async createTag(projectId: string, data: CreateTag): Promise<Tag>;

  /**
   * 更新标签
   */
  async updateTag(projectId: string, tagId: string, data: UpdateTag): Promise<Tag>;

  /**
   * 删除标签
   */
  async deleteTag(projectId: string, tagId: string): Promise<void>;

  // ============================================================
  // 统计
  // ============================================================

  /**
   * 获取项目统计
   */
  async getStats(projectId: string): Promise<ProjectStats>;
}
```

### 类型定义

```typescript
interface ListProjectsOptions {
  search?: string;
  sort?: "name" | "created_at" | "updated_at";
  order?: "asc" | "desc";
}

interface CreateProject {
  name: string;
  description?: string;
  git_repo_path: string;
  setup_script?: string;
  default_agent?: {
    type: AgentType;
    working_dir?: string;
  };
}

interface UpdateProject {
  name?: string;
  description?: string;
  setup_script?: string;
  default_agent?: {
    type: AgentType;
    working_dir?: string;
  };
}

interface CreateTag {
  name: string;
  color?: string;
}

interface UpdateTag {
  name?: string;
  color?: string;
}

interface ProjectStats {
  task_count: number;
  tasks_by_status: Record<TaskStatus, number>;
  workspace_count: number;
  active_workspace_count: number;
}
```

---

## 文件格式

### project.yaml

```yaml
id: "proj-1707820800-abc123"
name: "Viben Desktop"
description: "Desktop application for Viben"
git_repo_path: "/Users/dev/viben"
setup_script: |
  pnpm install
  pnpm build
default_agent:
  type: "claude-code"
  working_dir: "apps/desktop"
created_at: "2026-02-13T10:00:00Z"
updated_at: "2026-02-13T12:30:00Z"
```

### tags.yaml

```yaml
tags:
  - id: "tag-1"
    name: "bug"
    color: "#EF4444"
    created_at: "2026-02-13T10:00:00Z"
  - id: "tag-2"
    name: "feature"
    color: "#10B981"
    created_at: "2026-02-13T10:00:00Z"
  - id: "tag-3"
    name: "enhancement"
    color: "#3B82F6"
    created_at: "2026-02-13T10:00:00Z"
```

### repositories/<id>.yaml

```yaml
id: "repo-1"
project_id: "proj-1707820800-abc123"
path: "/Users/dev/viben"
remote_url: "https://github.com/user/viben.git"
default_branch: "main"
is_primary: true
added_at: "2026-02-13T10:00:00Z"
```

---

## API 路由

### GET /api/kanban/projects

列出所有项目。

**Query 参数:**

```typescript
interface ListProjectsQuery {
  search?: string;
  sort?: "name" | "created_at" | "updated_at";
  order?: "asc" | "desc";
}
```

**响应:**

```typescript
interface ListProjectsResponse {
  projects: Project[];
}
```

### GET /api/kanban/projects/:id

获取单个项目详情。

**响应:**

```typescript
interface GetProjectResponse {
  project: Project;
  stats: ProjectStats;
}
```

### POST /api/kanban/projects

创建项目。

**请求体:**

```typescript
interface CreateProjectRequest {
  name: string;
  description?: string;
  git_repo_path: string;
  setup_script?: string;
  default_agent?: {
    type: AgentType;
    working_dir?: string;
  };
}
```

**响应:**

```typescript
interface CreateProjectResponse {
  project: Project;
}
```

### PUT /api/kanban/projects/:id

更新项目。

**请求体:**

```typescript
interface UpdateProjectRequest {
  name?: string;
  description?: string;
  setup_script?: string;
  default_agent?: {
    type: AgentType;
    working_dir?: string;
  };
}
```

### DELETE /api/kanban/projects/:id

删除项目（级联删除所有任务和工作区）。

### GET /api/kanban/projects/:id/repositories

列出项目的仓库。

### POST /api/kanban/projects/:id/repositories

添加仓库。

**请求体:**

```typescript
interface AddRepositoryRequest {
  path: string;
}
```

### DELETE /api/kanban/projects/:id/repositories/:repoId

移除仓库。

### GET /api/kanban/projects/:id/tags

获取项目标签。

### POST /api/kanban/projects/:id/tags

创建标签。

### PUT /api/kanban/projects/:id/tags/:tagId

更新标签。

### DELETE /api/kanban/projects/:id/tags/:tagId

删除标签。

---

## 实现位置

```
packages/core/src/
├── kanban/
│   ├── models/
│   │   └── project.ts              # Project, Repository, Tag 类型
│   ├── services/
│   │   └── project-service.ts      # ProjectService
│   └── storage/
│       └── project-store.ts        # ProjectStore
└── gateway/
    └── routes/
        └── kanban/
            └── projects.ts          # API 路由
```

---

## 与 vibe-kanban 对比

| 功能 | vibe-kanban | viben-core |
|------|-------------|------------|
| 存储 | SQLite | YAML 文件 |
| 远程项目 | 支持 (remote_project_id) | 不支持 |
| 仓库关联 | 通过 project_repository 表 | 通过 repositories/ 目录 |
| 统计 | 数据库查询 | 文件系统扫描 |
| 搜索 | SQL LIKE | 内存过滤 |

---

## Acceptance Criteria

### 项目 CRUD
- [ ] 创建项目，生成正确的目录结构
- [ ] 更新项目元数据
- [ ] 删除项目时级联删除任务和工作区
- [ ] 列出项目支持搜索和排序

### 仓库管理
- [ ] 添加仓库时验证路径存在
- [ ] 添加仓库时自动检测 Git 信息
- [ ] 移除仓库不影响其他数据
- [ ] 设置主仓库

### 标签管理
- [ ] 创建/更新/删除标签
- [ ] 标签颜色支持

### 统计
- [ ] 正确统计任务数量和状态分布
- [ ] 正确统计工作区数量

---

## Related Documents

- [storage.md](./storage.md) - 存储系统设计
- [task.md](./task.md) - 任务管理模块
- [api-projects.md](./api-projects.md) - 项目 API 详细规范 (计划中)
