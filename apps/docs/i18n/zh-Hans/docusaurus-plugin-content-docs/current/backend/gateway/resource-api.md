---
sidebar_position: 17
title: "Resource API"
description: "Workspace resource discovery API"
---

# Resource Discovery API

> `/api/agent`, `/api/executors`, `/api/models` - Workspace resource discovery endpoints

## Overview

Viben Gateway provides workspace-scoped resource discovery APIs for querying agents, executors, models, and other resources. It supports workspace-level resource merging and override mechanisms.

## Core Concepts

### Workspace Hierarchy

```
~/.viben/              <- Global Workspace
├── agents/            <- Global agents
├── executors/         <- Global executor configuration
└── models.yaml        <- Global model configuration

/path/to/project/      <- Project Workspace
├── .viben/
│   ├── agents/        <- Project agents
│   └── models.yaml    <- Project model overrides
├── .claude/           <- Claude Code configuration
├── .cursor/           <- Cursor configuration
└── ...
```

### Default Behavior

- **workspace_path**: Defaults to the absolute path of user directory `~` (global workspace) when not provided
- **include_global**: Defaults to `true` when not provided, returns results including global workspace resources

### Resource Ownership Identifier

Each resource contains a `workspace_path` field indicating which workspace it belongs to:
- `"/Users/xxx"` - Global resource
- `"/path/to/project"` - Project resource

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent` | Get agent list |
| GET | `/api/executors` | Get executor list |
| GET | `/api/models` | Get model list |

---

## Detailed Description

### GET /api/agent

Get agent list.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| workspace_path | string | `~` absolute path | Workspace path |
| include_global | boolean | true | Whether to include global agents |

**Response**:

```json
{
  "workspace_path": "/path/to/project",
  "agents": [
    {
      "id": "本地助手",
      "name": "本地助手",
      "agent_type": "viben",
      "source": "workspace",
      "workspace_path": "/path/to/project",
      "config_path": "/path/to/project/.viben/agents/本地助手/config.yaml",
      "mcp_server_count": 2,
      "skill_count": 5
    },
    {
      "id": "全局助手",
      "name": "全局助手",
      "agent_type": "viben",
      "source": "global",
      "workspace_path": "/Users/xxx",
      "config_path": "/Users/xxx/.viben/agents/全局助手/config.yaml",
      "mcp_server_count": 0,
      "skill_count": 0
    },
    {
      "id": "claude_code",
      "name": "Claude Code",
      "agent_type": "claude_code",
      "source": "workspace",
      "workspace_path": "/path/to/project",
      "config_path": "/path/to/project/.claude",
      "mcp_server_count": 3,
      "skill_count": 10
    }
  ],
  "total": 3
}
```

**Agent Field Description**:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Agent ID |
| name | string | Display name |
| agent_type | string | Type (viben/claude_code/cursor) |
| source | string | Source (workspace/global) |
| workspace_path | string | Workspace path |
| config_path | string | Configuration file path |
| mcp_server_count | number | MCP server count |
| skill_count | number | Skill count |

---

### GET /api/executors

Get executor list.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| workspace_path | string | `~` absolute path | Workspace path |
| include_global | boolean | true | Whether to include global executors |

**Response**:

```json
{
  "workspace_path": "/path/to/project",
  "executors": [
    {
      "id": "CLAUDE_CODE",
      "name": "Claude Code",
      "availability": {
        "type": "LOGIN_DETECTED",
        "last_auth_timestamp": 1770741923
      },
      "supports_mcp": true,
      "capabilities": ["SessionFork", "ContextUsage"],
      "has_workspace_config": true,
      "workspace_path": "/path/to/project",
      "workspace_config_path": "/path/to/project/.claude",
      "global_config_path": "/Users/xxx/.claude"
    },
    {
      "id": "CURSOR_AGENT",
      "name": "Cursor",
      "availability": {
        "type": "INSTALLATION_FOUND"
      },
      "supports_mcp": true,
      "capabilities": ["SetupHelper"],
      "has_workspace_config": false,
      "workspace_path": "/Users/xxx",
      "global_config_path": "/Users/xxx/.cursor"
    }
  ]
}
```

**Executor Field Description**:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Executor ID |
| name | string | Display name |
| availability | object | Availability status |
| supports_mcp | boolean | Whether MCP is supported |
| capabilities | string[] | Capability list |
| has_workspace_config | boolean | Whether workspace config exists |
| workspace_path | string | Workspace path |
| workspace_config_path | string | Workspace configuration path |
| global_config_path | string | Global configuration path |

**Availability Types**:

| Type | Description |
|------|-------------|
| LOGIN_DETECTED | Logged in |
| INSTALLATION_FOUND | Installed but not logged in |
| NOT_INSTALLED | Not installed |

---

### GET /api/models

Get model list.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| workspace_path | string | `~` absolute path | Workspace path |
| include_global | boolean | true | Whether to include global models |

**Response**:

```json
{
  "workspace_path": "/path/to/project",
  "models": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "provider_id": "anthropic",
      "provider_name": "anthropic",
      "context_window": 200000,
      "is_available": true,
      "has_workspace_override": false,
      "workspace_path": "/Users/xxx"
    }
  ],
  "total": 29
}
```

**Model Field Description**:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Model ID |
| name | string | Display name |
| provider_id | string | Provider ID |
| provider_name | string | Provider name |
| context_window | number | Context window size |
| is_available | boolean | Whether available |
| has_workspace_override | boolean | Whether workspace override exists |
| workspace_path | string | Workspace path |

---

## Resource Merging Rules

### Agents

When `include_global=true`:
1. Load project workspace agents first
2. Then load global workspace agents
3. **Same-name agents**: Project agents take priority, global agents with same name are skipped
4. Each agent's `source` field indicates origin: `"workspace"` or `"global"`
5. Each agent's `workspace_path` field indicates its workspace

### Executors

When `include_global=true`:
1. Iterate through all known executor types
2. Check project workspace and global workspace configurations
3. **Same-name executor configuration merging**:
   - `workspace_config_path`: Project-level configuration path
   - `global_config_path`: Global configuration path
   - Prioritize modifying project-level configuration when editing

### Models

When `include_global=true`:
1. Load global model list
2. Check if project workspace has override configuration
3. `has_workspace_override` indicates whether project-level override exists

---

## Error Response

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

HTTP Status Codes:
- `400` - Invalid workspace_path or path does not exist
- `500` - Internal error

---

## Notes

1. **workspace_path must be an absolute path**
2. **Non-existent path returns 400 error**
3. **Global workspace** refers to user directory `~`, not `~/.viben`
4. **IDE configurations** (e.g., `.claude/`, `.cursor/`) always belong to the workspace where they are discovered

---

## Related Endpoints

- [Agent API](./agents.md) - Agent management
- [Task API](./task.md) - Task management
