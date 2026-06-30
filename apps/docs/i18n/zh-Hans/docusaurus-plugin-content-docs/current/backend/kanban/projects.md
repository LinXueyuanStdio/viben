---
sidebar_position: 3
---

# Kanban Projects

> Projects are the top-level organizational unit for managing tasks and workspaces

## Overview

A project in Kanban represents a code repository or workspace where related tasks are organized. Each project can have multiple tasks, workspaces, and associated repositories.

## Directory Structure

```
<workspace>/.viben/kanban/projects/
+-- <project-id>/
    +-- project.yaml           # Project metadata
    +-- tasks/                 # Task files
    |   +-- <task-id>.yaml
    |   +-- ...
    +-- tags.yaml              # Project tag definitions
    +-- repositories/          # Associated repository configs
        +-- <repo-id>.yaml
```

## Project Schema

### Project

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;

  // Git repository (primary repository path)
  git_repo_path: string;

  // Setup script (runs on workspace initialization)
  setup_script?: string;

  // Default agent configuration
  default_agent?: {
    type: AgentType;
    working_dir?: string;
  };

  // Statistics (computed fields)
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

Associated repositories stored in `repositories/<repo-id>.yaml`:

```typescript
interface Repository {
  id: string;
  project_id: string;
  path: string;           // Local path
  remote_url?: string;    // Remote URL (optional)
  default_branch: string;
  is_primary: boolean;
  added_at: string;
}
```

### Project Tags

Tag definitions stored in `tags.yaml`:

```typescript
interface ProjectTags {
  tags: Tag[];
}

interface Tag {
  id: string;
  name: string;
  color?: string;  // HEX color
  created_at: string;
}
```

## File Examples

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

### repositories/repo-id.yaml

```yaml
id: "repo-1"
project_id: "proj-1707820800-abc123"
path: "/Users/dev/viben"
remote_url: "https://github.com/user/viben.git"
default_branch: "main"
is_primary: true
added_at: "2026-02-13T10:00:00Z"
```

## Service Interface

### ProjectService

```typescript
class ProjectService {
  // Project CRUD
  async list(options?: ListProjectsOptions): Promise<Project[]>;
  async get(id: string): Promise<Project>;
  async create(data: CreateProject): Promise<Project>;
  async update(id: string, data: UpdateProject): Promise<Project>;
  async delete(id: string): Promise<void>;  // Cascade deletes tasks and workspaces
  async search(query: string): Promise<Project[]>;

  // Repository management
  async listRepositories(projectId: string): Promise<Repository[]>;
  async addRepository(projectId: string, repoPath: string): Promise<Repository>;
  async removeRepository(projectId: string, repoId: string): Promise<void>;
  async setPrimaryRepository(projectId: string, repoId: string): Promise<void>;

  // Tag management
  async getTags(projectId: string): Promise<Tag[]>;
  async createTag(projectId: string, data: CreateTag): Promise<Tag>;
  async updateTag(projectId: string, tagId: string, data: UpdateTag): Promise<Tag>;
  async deleteTag(projectId: string, tagId: string): Promise<void>;

  // Statistics
  async getStats(projectId: string): Promise<ProjectStats>;
}
```

### Type Definitions

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

interface ProjectStats {
  task_count: number;
  tasks_by_status: Record<TaskStatus, number>;
  workspace_count: number;
  active_workspace_count: number;
}
```

## API Endpoints

### List Projects

```http
GET /api/kanban/projects
```

Query parameters:
- `search`: Search term for filtering
- `sort`: Sort field (`name`, `created_at`, `updated_at`)
- `order`: Sort order (`asc`, `desc`)

Response:
```json
{
  "projects": [
    {
      "id": "proj-123",
      "name": "My Project",
      "git_repo_path": "/path/to/repo",
      "created_at": "2026-02-13T10:00:00Z",
      "updated_at": "2026-02-13T10:00:00Z"
    }
  ]
}
```

### Get Project

```http
GET /api/kanban/projects/:id
```

Response:
```json
{
  "project": {
    "id": "proj-123",
    "name": "My Project",
    "description": "Project description",
    "git_repo_path": "/path/to/repo"
  },
  "stats": {
    "task_count": 10,
    "tasks_by_status": {
      "backlog": 3,
      "todo": 2,
      "in_progress": 2,
      "done": 3
    },
    "workspace_count": 2,
    "active_workspace_count": 1
  }
}
```

### Create Project

```http
POST /api/kanban/projects
```

Request body:
```json
{
  "name": "New Project",
  "description": "Project description",
  "git_repo_path": "/path/to/repo",
  "setup_script": "npm install\nnpm run build",
  "default_agent": {
    "type": "claude-code",
    "working_dir": "src"
  }
}
```

### Update Project

```http
PUT /api/kanban/projects/:id
```

Request body:
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

### Delete Project

```http
DELETE /api/kanban/projects/:id
```

This cascade deletes all tasks and workspaces associated with the project.

### Repository Endpoints

```http
GET /api/kanban/projects/:id/repositories
POST /api/kanban/projects/:id/repositories
DELETE /api/kanban/projects/:id/repositories/:repoId
```

### Tag Endpoints

```http
GET /api/kanban/projects/:id/tags
POST /api/kanban/projects/:id/tags
PUT /api/kanban/projects/:id/tags/:tagId
DELETE /api/kanban/projects/:id/tags/:tagId
```

## Related Documentation

- [Storage System](./storage.md) - Storage design
- [Tasks](./tasks.md) - Task management
- [Workspaces](./workspaces.md) - Workspace management
