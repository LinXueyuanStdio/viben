---
sidebar_position: 1
title: "Gateway API Reference"
description: "Complete reference documentation for Viben Gateway RESTful API"
---

# Gateway API Reference

Viben Gateway is the core service of the **Agent Swarm x Code Evolution** platform, providing RESTful APIs for:

- **Agent Swarm** - Agent cluster orchestration and collaboration management
- **FileEvo** - API support for code iteration optimization
- **Task System** - XState-based task state machine workflow
- **Session Management** - Agent session and context management

## Basic Information

- **Base URL**: `http://127.0.0.1:18790`
- **Protocol**: HTTP/HTTPS
- **Format**: JSON

## Authentication

The current version of Gateway runs locally and does not require authentication. Future versions may add authentication support.

## API Endpoint Overview

### Health Check

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check Gateway health status |

### Agent Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | GET | List all agents |
| `/api/agent/:id` | GET | Get specific agent |
| `/api/agent` | POST | Create agent |
| `/api/agent/:id` | PATCH | Update agent |
| `/api/agent/:id` | DELETE | Delete agent |

### Executor Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/executors` | GET | List available executors |
| `/api/executors/:type/discover-sessions` | GET | Discover executor sessions |
| `/api/executors/:type/mcp-servers` | GET | Get executor MCP servers |
| `/api/executors/:type/skills` | GET | Get executor skills |

### Session Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/:id` | GET | Get specific session |
| `/api/sessions` | POST | Create session |
| `/api/sessions/:id` | PATCH | Update session |
| `/api/sessions/:id` | DELETE | Delete session |
| `/api/sessions/:id/messages` | GET | Get session messages |

### Provider Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/providers` | GET | List all Providers |
| `/api/providers/:id` | GET | Get specific Provider |
| `/api/providers` | POST | Create Provider |
| `/api/providers/:id` | PATCH | Update Provider |
| `/api/providers/:id` | DELETE | Delete Provider |
| `/api/providers/:id/test` | POST | Test Provider connection |

### Model Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/models` | GET | List all models |
| `/api/models/:id` | GET | Get specific model |
| `/api/models/default` | GET | Get default model |
| `/api/models/default` | PUT | Set default model |
| `/api/models/aliases` | GET | Get model aliases |
| `/api/models/fallbacks` | GET | Get fallback chain |

### Notification Channel Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/channels` | GET | List all notification channels |
| `/api/channels/:id` | GET | Get specific channel |
| `/api/channels` | POST | Create channel |
| `/api/channels/:id` | PATCH | Update channel |
| `/api/channels/:id` | DELETE | Delete channel |
| `/api/channels/:id/default` | POST | Set as default channel |
| `/api/channels/send` | POST | Send message |
| `/api/channels/test` | POST | Test channel configuration |

### Cron Job Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron` | GET | List all cron jobs |
| `/api/cron/:id` | GET | Get specific cron job |
| `/api/cron` | POST | Create cron job |
| `/api/cron/:id` | PATCH | Update cron job |
| `/api/cron/:id` | DELETE | Delete cron job |
| `/api/cron/:id/enable` | POST | Enable cron job |
| `/api/cron/:id/disable` | POST | Disable cron job |
| `/api/cron/:id/run` | POST | Execute cron job immediately |
| `/api/cron/:id/logs` | GET | Get execution logs |

### Task Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tasks` | GET | List all tasks |
| `/api/tasks/:id` | GET | Get specific task |
| `/api/tasks` | POST | Create task |
| `/api/tasks/:id` | PATCH | Update task |
| `/api/tasks/:id` | DELETE | Delete task |
| `/api/agent/:agentId/tasks` | GET | Get agent tasks |
| `/api/agent/:agentId/sessions/:sessionId/tasks` | GET | Get session tasks |

### Workspace Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workspaces` | GET | List all workspaces |
| `/api/workspaces/detect` | GET | Detect folder status |
| `/api/workspaces/create` | POST | Create workspace |
| `/api/workspaces/:id` | DELETE | Delete workspace |

### MCP Server Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp/installed` | GET | List installed MCP servers |
| `/api/mcp/browse/start` | POST | Start Browse MCP |
| `/api/mcp/browse/stop` | POST | Stop Browse MCP |
| `/api/mcp/browse/status` | GET | Get Browse MCP status |
| `/api/mcp/proxy/start` | POST | Start MCP proxy |
| `/api/mcp/proxy/stop` | POST | Stop MCP proxy |
| `/api/mcp/proxy/status` | GET | Get MCP proxy status |

### Kanban Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/kanban/tasks/:taskId/comments` | GET | Get task comments |
| `/api/kanban/tasks/:taskId/comments` | POST | Add task comment |
| `/api/kanban/tasks/:taskId/comments/:commentId` | PATCH | Update comment |
| `/api/kanban/tasks/:taskId/comments/:commentId` | DELETE | Delete comment |
| `/api/kanban/tasks/:taskId/comments/:commentId/reactions` | POST | Toggle comment reaction |
| `/api/kanban/tasks/:taskId/activities` | GET | Get task activities |
| `/api/kanban/tasks/:taskId/activities` | POST | Add task activity |
| `/api/kanban/tasks/:taskId/data` | DELETE | Clear task data |

## Common Query Parameters

Many endpoints support the following query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `workspace_path` | string | Workspace path, used to get workspace-specific configuration |
| `include_global` | string | Whether to include global configuration (default: "true") |

## Response Format

All responses use JSON format with field names in **snake_case**.

### Success Response

```json
{
  "agents": [...],
  "total": 10
}
```

### Error Response

```json
{
  "error": "Agent not found: xxx"
}
```

## HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request |
| 404 | Resource not found |
| 500 | Server error |

## Swagger UI

Gateway provides Swagger UI at runtime for interactive API exploration:

```
http://127.0.0.1:18790/docs
```

## Next Steps

- [Gateway Overview](/backend/gateway/) - Learn about Gateway architecture
- [CLI Documentation](/cli/) - Use command line to manage agents
- [User Guide](/user/intro) - Desktop application user guide
