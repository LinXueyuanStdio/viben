---
sidebar_position: 1
---

# Viben Gateway

> Hono-based HTTP/WebSocket API server providing AI agent orchestration and management services.

## Overview

Viben Gateway is the core backend service of Viben, running on port **18790**, providing:
- RESTful API services
- WebSocket real-time communication
- Server-Sent Events (SSE) streaming
- Multi-agent orchestration and coordination

## Architecture

```
+-------------------------------------------------------------+
|                      Viben Gateway                           |
|                      Port: 18790                             |
+-------------------------------------------------------------+
|  HTTP Layer (Hono)                                           |
|  +-- CORS Middleware (Allow All Origins)                     |
|  +-- Tracing Middleware (Request/Response Logging)           |
|  +-- Router                                                  |
+-------------------------------------------------------------+
|  API Routes                                                  |
|  +-- /health              Health Check                       |
|  +-- /api/agent          Agent Management                    |
|  +-- /api/executors       Executor Management                |
|  +-- /api/models          Model Management                   |
|  +-- /api/providers       Provider Management                |
|  +-- /api/tasks           Task Management                    |
|  +-- /api/sessions        Session Management                 |
|  +-- /api/channels        Channel Management                 |
|  +-- /api/cron            Scheduled Tasks                    |
|  +-- /api/workspaces      Workspace Management               |
|  +-- /api/mcp             MCP Server Management              |
|  +-- /api/kanban          Kanban Data Management             |
|  +-- /api/group-chats     Group Chat Management              |
|  +-- /api/chat-list       Chat List Aggregation              |
|  +-- /api/events          SSE Event Stream                   |
+-------------------------------------------------------------+
|  WebSocket Routes                                            |
|  +-- /ws                  General WebSocket                  |
|  +-- /api/group-chats/:id/sessions/:sid/ws  Group Chat WS    |
|  +-- /terminal/ws         Terminal WebSocket                 |
+-------------------------------------------------------------+
|  Storage Layer                                               |
|  +-- Global: ~/.viben/                                       |
|  +-- Workspace: <project>/.viben/                            |
+-------------------------------------------------------------+
```

## Service Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 18790 | HTTP/WebSocket service port |
| CORS | Allow All | Cross-origin request configuration |
| Logging | Tracing | Request/response logging |

## API Endpoint Index

| Module | Path Prefix | Specification |
|--------|-------------|---------------|
| Health Check | `/health` | [health.md](./health.md) |
| Agents | `/api/agent` | [agents.md](./agents.md) |
| Executors | `/api/executors` | [executors.md](./executors.md) |
| Models | `/api/models` | [models.md](./models.md) |
| Providers | `/api/providers` | [providers.md](./providers.md) |
| Tasks | `/api/tasks` | [tasks.md](./tasks.md) |
| Sessions | `/api/sessions` | [sessions.md](./sessions.md) |
| Channels | `/api/channels` | [channels.md](./channels.md) |
| Scheduled Tasks | `/api/cron` | [cron.md](./cron.md) |
| Workspaces | `/api/workspaces` | [API Reference](/backend/api/) |
| MCP | `/api/mcp` | [API Reference](/backend/api/) |
| Kanban | `/api/kanban` | [API Reference](/backend/api/) |
| Group Chats | `/api/group-chats` | [group-chats.md](./group-chats.md) |
| Chat List | `/api/chat-list` | [chat-list.md](./chat-list.md) |
| Event Stream | `/api/events` | [events.md](./events.md) |
| WebSocket | `/ws`, `/terminal/ws` | [websocket.md](./websocket.md) |

## Workspace Scope

All resources support two scope levels:

```
+-------------------------------------------------------------+
|  Global Scope: ~/.viben/                                     |
|  +-- agents/              Global Agents                      |
|  +-- providers/           Provider Configuration             |
|  +-- models.yaml          Model Configuration                |
|  +-- channels.yaml        Channel Configuration              |
|  +-- sessions/            Session Storage                    |
+-------------------------------------------------------------+
|  Workspace Scope: <project>/.viben/                          |
|  +-- agents/              Workspace Agents                   |
|  +-- group-chats/         Group Chats                        |
|  +-- config.yaml          Workspace Configuration            |
+-------------------------------------------------------------+
```

**Query Parameters**:
- `workspace_path`: Workspace path (absolute path)
- `include_global`: Whether to include global resources (default true)

## Common Response Format

### Success Response

```json
{
  "id": "resource-id",
  "name": "Resource Name",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "workspace_path": "/path/to/workspace",
  "source": "global",
  "is_global": true
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Starting Gateway

```bash
# Start Gateway
pnpm gateway:build    # Build and start
pnpm gateway:restart  # Restart existing Gateway

# Health check
curl http://127.0.0.1:18790/health
```

## Related Documentation

- [CLI Gateway Commands](/cli/commands/gateway) - Gateway CLI management commands
- [CLI Agent Commands](/cli/commands/agent) - Agent CLI management commands
