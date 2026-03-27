---
sidebar_position: 4
title: "viben service"
description: "Manage Viben background services"
---

# viben service

Manage Viben background services.

## Usage

```bash
viben service <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `status [name]` | Show service status |
| `start <name>` | Start a service |
| `stop <name>` | Stop a service |
| `restart <name>` | Restart a service |
| `logs <name>` | View service logs |

## Managed Services

| Service | Description |
|---------|-------------|
| `mcp:<name>` | MCP Server process |
| `viben:sync` | Configuration sync service |
| `viben:index` | Local indexing service |

## Commands

### Service Status

Check service status:

```bash
# Check all services
viben service status

# Check a specific service
viben service status mcp:filesystem
```

**Output (Human-readable):**

```
Services:
  mcp:filesystem    running   pid:12345  uptime:2h
  mcp:git           running   pid:12346  uptime:2h
  viben:sync        stopped   -          -
```

**Output (JSON):**

```bash
viben service status --json
```

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "name": "mcp:filesystem",
        "status": "running",
        "pid": 12345,
        "uptime": "2h"
      },
      {
        "name": "mcp:git",
        "status": "running",
        "pid": 12346,
        "uptime": "2h"
      },
      {
        "name": "viben:sync",
        "status": "stopped",
        "pid": null,
        "uptime": null
      }
    ]
  }
}
```

### Start Service

Start a background service:

```bash
# Start filesystem MCP server
viben service start mcp:filesystem

# Start sync service
viben service start viben:sync
```

**Output:**

```
Started mcp:filesystem (pid: 12345)
```

**JSON Output:**

```json
{
  "success": true,
  "data": {
    "name": "mcp:filesystem",
    "status": "running",
    "pid": 12345
  }
}
```

### Stop Service

Stop a running service:

```bash
# Stop filesystem MCP server
viben service stop mcp:filesystem

# Stop sync service
viben service stop viben:sync
```

**Output:**

```
Stopped mcp:filesystem
```

**JSON Output:**

```json
{
  "success": true,
  "data": {
    "name": "mcp:filesystem",
    "status": "stopped"
  }
}
```

### Restart Service

Restart a service:

```bash
# Restart filesystem MCP server
viben service restart mcp:filesystem
```

**Output:**

```
Restarted mcp:filesystem (pid: 12350)
```

### View Logs

View service logs:

```bash
# View logs
viben service logs mcp:filesystem

# Follow logs in real-time
viben service logs mcp:filesystem -f

# View last N lines
viben service logs mcp:filesystem --tail 50
```

**Output:**

```
[2024-01-16 10:30:00] INFO: Starting mcp:filesystem
[2024-01-16 10:30:01] INFO: Listening on stdio
[2024-01-16 10:31:15] DEBUG: Received request: list_directory
```

## Service Types

### MCP Services

MCP services are named with the `mcp:` prefix:

```bash
# Start MCP servers
viben service start mcp:filesystem
viben service start mcp:git
viben service start mcp:browser

# Check MCP service status
viben service status mcp:filesystem
```

### System Services

System services are named with the `viben:` prefix:

```bash
# Start sync service
viben service start viben:sync

# Start indexing service
viben service start viben:index
```

## Error Handling

### Service Not Found

```bash
viben service start unknown:service
```

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Service 'unknown:service' not found"
  }
}
```

### Service Already Running

```bash
viben service start mcp:filesystem
```

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_ALREADY_RUNNING",
    "message": "Service 'mcp:filesystem' is already running (pid: 12345)"
  }
}
```

### Service Not Running

```bash
viben service stop mcp:filesystem
```

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_RUNNING",
    "message": "Service 'mcp:filesystem' is not running"
  }
}
```

## Related Commands

- [viben mcp](./mcp) - MCP server management
- [viben config](./config) - Configuration management
- [viben gateway](./gateway) - Gateway runtime
