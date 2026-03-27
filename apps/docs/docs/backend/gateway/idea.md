---
sidebar_position: 14
title: "Idea API"
description: "AI-driven idea generation and management API"
---

# Idea API

> `/api/idea` - AI-driven idea generation and management endpoints

## Overview

The Idea API provides AI-driven code improvement suggestion generation and management capabilities. It supports 6 built-in types and user-defined custom types. Generated ideas can be promoted to tasks.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/idea/generate` | Generate ideas |
| GET | `/api/idea` | Get idea list |
| GET | `/api/idea/types` | Get available type list |
| GET | `/api/idea/:id` | Get single idea details |
| POST | `/api/idea/:id/promote` | Promote idea to task |
| POST | `/api/idea/:id/dismiss` | Dismiss idea |
| DELETE | `/api/idea/:id` | Delete idea |
| DELETE | `/api/idea` | Batch delete ideas |
| GET | `/api/idea/sessions` | Get generation session list |
| GET | `/api/idea/sessions/:id` | Get generation session details |

---

## Detailed Description

### POST /api/idea/generate

Generate ideas. This is a streaming endpoint that returns generation progress via SSE.

**Request Body**:

```json
{
  "types": ["code_improvements", "security_hardening"],
  "workspace_path": "/path/to/project",
  "output": ".viben/ideas",
  "model": "sonnet",
  "max_ideas": 5,
  "append": false,
  "override": false
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| types | string[] | Yes | List of idea types to generate |
| workspace_path | string | Yes | Workspace path |
| output | string | No | Output directory, defaults to `.viben/ideas` |
| model | string | No | AI model, defaults to global configuration |
| max_ideas | number | No | Maximum ideas per type, defaults to 5 |
| append | boolean | No | Append mode, defaults to false |
| override | boolean | No | Force regeneration, defaults to false |

**Response Format**: `text/event-stream`

**Event Types**:

```json
// Generation start
{"type": "start", "session_id": "03-11-api-improvement", "types": ["code_improvements"]}

// Type start
{"type": "type_start", "idea_type": "code_improvements"}

// Generation progress
{"type": "progress", "idea_type": "code_improvements", "current": 2, "total": 5}

// Single idea generation complete
{"type": "idea_generated", "idea": {...}}

// Type complete
{"type": "type_complete", "idea_type": "code_improvements", "count": 5}

// All complete
{"type": "complete", "session_id": "03-11-api-improvement", "summary": {...}}

// Error
{"type": "error", "message": "Failed to generate ideas", "idea_type": "code_improvements"}
```

---

### GET /api/idea

Get idea list.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | **Required** Workspace path |
| type | string | Filter by type |
| effort | string | Filter by effort |
| status | string | Filter by status (draft/promoted/dismissed) |
| session_id | string | Filter by session ID |
| limit | number | Limit returned count, defaults to 100 |
| offset | number | Pagination offset |

**Response**:

```json
{
  "success": true,
  "ideas": [
    {
      "id": "a1b2c3d4",
      "type": "code_improvements",
      "name": "add-retry-logic",
      "title": "Add retry logic to API calls",
      "description": "Add automatic retry logic to API calls",
      "rationale": "Current code fails directly on network errors",
      "estimated_effort": "small",
      "status": "draft",
      "promoted_to": null,
      "created_at": "2026-03-11T14:30:00Z",
      "affected_files": ["src/api/client.ts"],
      "existing_patterns": ["error handling in src/utils/error.ts"],
      "session_id": "03-11-api-improvement"
    }
  ],
  "total": 10,
  "has_more": false
}
```

---

### GET /api/idea/types

Get available idea type list.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | **Required** Workspace path |
| include_builtin | boolean | Include built-in types, defaults to true |
| include_custom | boolean | Include custom types, defaults to true |

**Response**:

```json
{
  "success": true,
  "types": [
    {
      "name": "code_improvements",
      "description": "Code improvements - Improvement opportunities based on existing patterns",
      "source": "builtin",
      "max_ideas": 5
    },
    {
      "name": "api_design",
      "description": "API design improvements - RESTful standards, interface consistency",
      "source": "custom",
      "max_ideas": 5,
      "path": "docs/idea-types/api_design.md"
    }
  ]
}
```

**Built-in Types**:

| Type | Description |
|------|-------------|
| `code_improvements` | Code improvements |
| `ui_ux_improvements` | UI/UX improvements |
| `documentation_gaps` | Documentation gaps |
| `security_hardening` | Security hardening |
| `performance_optimizations` | Performance optimizations |
| `code_quality` | Code quality |

---

### GET /api/idea/:id

Get single idea details.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | **Required** Workspace path |

**Response**:

```json
{
  "success": true,
  "idea": {
    "id": "a1b2c3d4",
    "type": "code_improvements",
    "name": "add-retry-logic",
    "title": "Add retry logic to API calls",
    "description": "Add automatic retry logic to API calls, handling temporary network failures",
    "rationale": "Current code fails directly on network errors without retry mechanism",
    "estimated_effort": "small",
    "status": "draft",
    "promoted_to": null,
    "created_at": "2026-03-11T14:30:00Z",
    "affected_files": ["src/api/client.ts", "src/api/request.ts"],
    "existing_patterns": ["error handling in src/utils/error.ts"],
    "implementation_approach": "Use exponential backoff strategy...",
    "session_id": "03-11-api-improvement",
    "file_path": ".viben/ideas/03-11-api-improvement/idea_code_improvements_add-retry-logic.md"
  }
}
```

---

### POST /api/idea/:id/promote

Promote idea to task.

**Request Body**:

```json
{
  "workspace_path": "/path/to/project",
  "slug": "add-retry-logic",
  "branch": "feature/add-retry-logic",
  "assignee": "developer",
  "priority": "P2",
  "executor": "CLAUDE_CODE",
  "model": "opus",
  "start": false,
  "worktree": false
}
```

**Field Description**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| workspace_path | string | Yes | Workspace path |
| slug | string | No | Task identifier |
| branch | string | No | Custom branch name |
| assignee | string | No | Assignee |
| priority | string | No | Priority (P0-P3) |
| executor | string | No | Executor type |
| model | string | No | Model to use |
| start | boolean | No | Auto-start task |
| worktree | boolean | No | Run in git worktree |

**Response**:

```json
{
  "success": true,
  "idea_id": "a1b2c3d4",
  "task": {
    "id": "task-123",
    "name": "add-retry-logic",
    "title": "Add retry logic to API calls",
    "status": "backlog",
    "task_dir": ".viben/tasks/03-11-add-retry-logic"
  }
}
```

---

### POST /api/idea/:id/dismiss

Dismiss an idea.

**Request Body**:

```json
{
  "workspace_path": "/path/to/project",
  "reason": "Not applicable to current project"
}
```

**Response**:

```json
{
  "success": true,
  "idea_id": "a1b2c3d4",
  "status": "dismissed"
}
```

---

### DELETE /api/idea/:id

Delete a single idea.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | **Required** Workspace path |

**Response**:

```json
{
  "success": true,
  "deleted": "a1b2c3d4"
}
```

---

### DELETE /api/idea

Batch delete ideas.

**Request Body**:

```json
{
  "workspace_path": "/path/to/project",
  "ids": ["a1b2c3d4", "b2c3d4e5"],
  "type": "code_improvements",
  "all": false
}
```

**Response**:

```json
{
  "success": true,
  "deleted": 3,
  "ids": ["a1b2c3d4", "b2c3d4e5", "c3d4e5f6"]
}
```

---

### GET /api/idea/sessions

Get generation session list.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | **Required** Workspace path |
| limit | number | Limit returned count, defaults to 20 |
| offset | number | Pagination offset |

**Response**:

```json
{
  "success": true,
  "sessions": [
    {
      "id": "03-11-api-improvement",
      "types": ["code_improvements", "security_hardening"],
      "model": "sonnet",
      "summary": {
        "total_ideas": 10,
        "by_type": {"code_improvements": 5, "security_hardening": 5},
        "by_status": {"draft": 9, "promoted": 1}
      },
      "generated_at": "2026-03-11T14:30:00Z",
      "updated_at": "2026-03-11T14:35:00Z"
    }
  ],
  "total": 5,
  "has_more": false
}
```

---

### GET /api/idea/sessions/:id

Get generation session details.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| workspace_path | string | **Required** Workspace path |
| include_ideas | boolean | Whether to include idea list, defaults to true |

**Response**:

```json
{
  "success": true,
  "session": {
    "id": "03-11-api-improvement",
    "types": ["code_improvements", "security_hardening"],
    "model": "sonnet",
    "summary": {...},
    "files": [
      "idea_code_improvements_add-retry-logic.md",
      "idea_security_hardening_input-sanitization.md"
    ],
    "generated_at": "2026-03-11T14:30:00Z",
    "updated_at": "2026-03-11T14:35:00Z"
  },
  "ideas": [...]
}
```

---

## Data Structures

### Idea Object

| Field | Type | Description |
|-------|------|-------------|
| id | string | 8-character short UUID |
| type | string | Idea type |
| name | string | File-friendly name |
| title | string | Short title |
| description | string | Detailed description |
| rationale | string | Reason for improvement |
| estimated_effort | string | Effort estimate |
| status | string | Status (draft/promoted/dismissed) |
| promoted_to | string | Associated task ID |
| created_at | string | Creation time (ISO 8601) |
| affected_files | string[] | Affected files |
| existing_patterns | string[] | Existing patterns for reference |
| implementation_approach | string | Implementation approach |
| session_id | string | Parent session ID |

---

## Error Codes

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | ValidationError | Invalid request parameters |
| 404 | NotFoundError | Idea or session not found |
| 409 | ConflictError | Idea already promoted to task |
| 500 | InternalError | Internal server error |

---

## Related Endpoints

- [Task API](./task.md) - Task management
- [Agent API](./agents.md) - Agent management
