---
sidebar_position: 1
---

# Kanban Module

> File-based kanban board system integrated with Viben Desktop workspace

## Overview

The Kanban module provides a complete project and task management system built on a **file-native** architecture. All data is stored as YAML/JSON files in the workspace directory, eliminating the need for a database.

Key features:
- **File-based storage** - All data stored as YAML/JSON files
- **Git Worktree integration** - Isolated execution environments per task
- **Agent integration** - Tasks can be executed by AI agents
- **Local-first** - Works entirely offline, no cloud sync required

## Architecture

```
+-------------------------------------------------------------+
|                    Desktop App (Tauri)                       |
+-------------------------------------------------------------+
|  Workspace -> Kanban Page                                    |
|      │                                                       |
|  packages/core/src/kanban/                                   |
|      ├── models/          # Data models + file storage       |
|      ├── services/        # Business logic services          |
|      └── api/             # Gateway API routes               |
+-------------------------------------------------------------+
```

## Directory Structure

All kanban data is stored under `<workspace>/.viben/kanban/`:

```
<workspace>/.viben/kanban/
├── config.yaml              # Global kanban configuration
├── projects/                # Project directories
│   └── <project-id>/
│       ├── project.yaml     # Project metadata
│       ├── tasks/           # Task files
│       │   └── <task-id>.yaml
│       └── tags.yaml        # Project tags
├── workspaces/              # Kanban workspaces (Git Worktrees)
│   └── <workspace-id>/
│       ├── workspace.yaml   # Workspace configuration
│       └── sessions/        # Session storage
│           └── <session-id>/
│               ├── config.yaml
│               └── messages.jsonl
└── scratch/                 # Draft storage
    └── <type>/<id>.yaml
```

## Core Modules

| Module | Description | Documentation |
|--------|-------------|---------------|
| Storage | File storage system design | [storage.md](./storage.md) |
| Projects | Project management | [projects.md](./projects.md) |
| Tasks | Task management | [tasks.md](./tasks.md) |
| Workspaces | Workspace (Worktree) management | [workspaces.md](./workspaces.md) |
| Sessions | Session management | [sessions.md](./sessions.md) |
| Git Operations | Git worktree and operations | [git-operations.md](./git-operations.md) |

## API Routes

The Kanban module exposes the following API endpoints through the Gateway:

| Endpoint | Description |
|----------|-------------|
| `GET /api/kanban/projects` | List all projects |
| `POST /api/kanban/projects` | Create a project |
| `GET /api/kanban/projects/:id` | Get project details |
| `PUT /api/kanban/projects/:id` | Update a project |
| `DELETE /api/kanban/projects/:id` | Delete a project |
| `GET /api/kanban/projects/:id/tasks` | List project tasks |
| `POST /api/kanban/projects/:id/tasks` | Create a task |
| `GET /api/kanban/workspaces` | List workspaces |
| `POST /api/kanban/workspaces` | Create a workspace |
| `POST /api/kanban/workspaces/:id/start` | Start workspace execution |

## Agent Integration

Kanban tasks can be linked to AI agent execution:

```yaml
# task.yaml
id: "task-123"
title: "Implement login feature"
status: "in_progress"
agent_execution:
  agent_id: "main"
  session_id: "session-abc"
  workspace_id: "ws-xyz"
```

When a task is assigned to an agent:
1. A Git worktree is created for isolated development
2. An agent session is started in that workspace
3. The agent executes the task with full context
4. Progress and results are tracked in the session

## Configuration

The global kanban configuration is stored in `config.yaml`:

```yaml
version: 1

defaults:
  task_status: "backlog"
  workspace_branch_prefix: "kanban/"

preferences:
  default_view: "board"
  columns:
    - backlog
    - todo
    - in_progress
    - in_review
    - done
```

## Design Principles

### 1. File-Native Storage

No database required. All data is stored in human-readable YAML/JSON files:
- Easy to version control
- Simple to backup and restore
- Transparent data format

### 2. Local-First

The module operates entirely locally:
- No cloud sync or remote storage
- Works offline
- Optional GitHub integration via CLI

### 3. Git Worktree Integration

Each workspace creates an isolated Git worktree:
- Clean separation between tasks
- Easy branch management
- Safe experimentation

## Implementation Location

```
packages/core/
└── src/
    ├── kanban/                    # Kanban core module
    │   ├── index.ts               # Module entry
    │   ├── models/                # Data models
    │   │   ├── project.ts
    │   │   ├── task.ts
    │   │   ├── workspace.ts
    │   │   └── session.ts
    │   ├── services/              # Business services
    │   │   ├── project-service.ts
    │   │   ├── task-service.ts
    │   │   ├── workspace-service.ts
    │   │   └── git-service.ts
    │   └── storage/               # File storage
    │       ├── file-store.ts
    │       └── yaml-parser.ts
    └── gateway/
        └── routes/
            └── kanban/            # Kanban API routes
                ├── projects.ts
                ├── tasks.ts
                ├── workspaces.ts
                └── sessions.ts
```

## Related Documentation

- [Gateway Index](/backend/gateway/) - Gateway module overview
- [CLI Task Commands](/cli/commands/task) - Task CLI management
