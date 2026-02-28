---
sidebar_position: 4
title: "viben service"
description: "管理 Viben 后台服务"
---

# viben service

管理 Viben 后台服务。

## 用法

```bash
viben service <subcommand> [options]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `status [name]` | 显示服务状态 |
| `start <name>` | 启动服务 |
| `stop <name>` | 停止服务 |
| `restart <name>` | 重启服务 |
| `logs <name>` | 查看服务日志 |

## 托管服务

| 服务 | 说明 |
|------|------|
| `mcp:<name>` | MCP Server 进程 |
| `viben:sync` | 配置同步服务 |
| `viben:index` | 本地索引服务 |

## 命令

### 服务状态

检查服务状态：

```bash
# 检查所有服务
viben service status

# 检查特定服务
viben service status mcp:filesystem
```

**输出（人类可读）：**

```
Services:
  mcp:filesystem    running   pid:12345  uptime:2h
  mcp:git           running   pid:12346  uptime:2h
  viben:sync        stopped   -          -
```

**输出（JSON）：**

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

### 启动服务

启动后台服务：

```bash
# 启动 filesystem MCP 服务器
viben service start mcp:filesystem

# 启动同步服务
viben service start viben:sync
```

**输出：**

```
Started mcp:filesystem (pid: 12345)
```

**JSON 输出：**

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

### 停止服务

停止运行中的服务：

```bash
# 停止 filesystem MCP 服务器
viben service stop mcp:filesystem

# 停止同步服务
viben service stop viben:sync
```

**输出：**

```
Stopped mcp:filesystem
```

**JSON 输出：**

```json
{
  "success": true,
  "data": {
    "name": "mcp:filesystem",
    "status": "stopped"
  }
}
```

### 重启服务

重启服务：

```bash
# 重启 filesystem MCP 服务器
viben service restart mcp:filesystem
```

**输出：**

```
Restarted mcp:filesystem (pid: 12350)
```

### 查看日志

查看服务日志：

```bash
# 查看日志
viben service logs mcp:filesystem

# 实时跟踪日志
viben service logs mcp:filesystem -f

# 查看最后 N 行
viben service logs mcp:filesystem --tail 50
```

**输出：**

```
[2024-01-16 10:30:00] INFO: Starting mcp:filesystem
[2024-01-16 10:30:01] INFO: Listening on stdio
[2024-01-16 10:31:15] DEBUG: Received request: list_directory
```

## 服务类型

### MCP 服务

MCP 服务以 `mcp:` 前缀命名：

```bash
# 启动 MCP 服务器
viben service start mcp:filesystem
viben service start mcp:git
viben service start mcp:browser

# 检查 MCP 服务状态
viben service status mcp:filesystem
```

### 系统服务

系统服务以 `viben:` 前缀命名：

```bash
# 启动同步服务
viben service start viben:sync

# 启动索引服务
viben service start viben:index
```

## 错误处理

### 服务未找到

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

### 服务已在运行

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

### 服务未运行

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

## 相关命令

- [viben mcp](./mcp) - MCP 服务器管理
- [viben config](./config) - 配置管理
- [viben gateway](./gateway) - Gateway 运行时
