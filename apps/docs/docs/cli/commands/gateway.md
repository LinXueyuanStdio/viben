---
sidebar_position: 11
title: "viben gateway"
description: "启动 Gateway - 连接 channels 到 agent loop 的核心运行时"
---

# viben gateway

启动 Gateway - 连接 channels 到 agent loop 的核心运行时。

## 命令

```bash
# 启动 gateway
viben gateway start

# 使用特定选项启动
viben gateway start --host 127.0.0.1 --port 18790 --log-level info --agent main

# 后台模式启动
viben gateway start --daemon

# 停止运行中的 gateway
viben gateway stop
viben gateway stop --port 18790    # 停止指定端口

# 重启 gateway（先停止再启动）
viben gateway restart
viben gateway restart --port 18790 --log-level debug

# 检查 gateway 状态
viben gateway status
```

## Gateway 命令

| 命令 | 说明 |
|------|------|
| `viben gateway start` | 启动 gateway，支持 `--host`, `--port`, `--log-level`, `--agent`, `--daemon` |
| `viben gateway stop` | 停止运行中的 gateway，支持 `--port` 指定端口 |
| `viben gateway restart` | 重启 gateway（先停止再启动），支持所有 start 选项 |
| `viben gateway status` | 检查 gateway 运行状态和健康状态 |

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-h, --host <host>` | Gateway 监听地址 | `127.0.0.1` |
| `-p, --port <port>` | Gateway 监听端口 | `18790` |
| `-l, --log-level <level>` | 日志级别 (debug, info, warn, error) | `info` |
| `-n, --agent <agent-id>` | 指定运行的智能体 | `main` |
| `-d, --daemon` | 后台运行模式 | `false` |

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Gateway                               │
├─────────────────────────────────────────────────────────────┤
│  Channels (Input)                                            │
│    ├── Telegram Bot                                          │
│    ├── Discord Bot                                           │
│    ├── WhatsApp (via bridge)                                 │
│    ├── Feishu (WebSocket long connection)                    │
│    └── CLI (direct input)                                    │
│                                                              │
│  Message Bus                                                 │
│    ├── Inbound Queue (messages from channels)                │
│    └── Outbound Queue (responses to channels)                │
│                                                              │
│  Agent Loop                                                  │
│    ├── Context Builder (system prompt + memory + skills)     │
│    ├── LLM Provider (API calls)                              │
│    ├── Tool Registry (execute tool calls)                    │
│    └── Subagent Manager (background tasks)                   │
└─────────────────────────────────────────────────────────────┘
```

## Gateway 生命周期

1. 从 `~/.viben/config.yaml` 加载配置
2. 初始化已启用的 channels（Telegram、Discord 等）
3. 启动消息总线
4. 启动智能体循环
5. 处理消息直到关闭

## 输出示例

**`viben gateway start`（人类可读）：**

```
Gateway starting...
  Agent: main
  Model: claude-sonnet-4-20250514
  Channels:
    ✓ telegram    connected   @my_bot
    ✓ discord     connected   MyBot#1234
    ○ whatsapp    disabled
    ○ feishu      disabled

Gateway running. Press Ctrl+C to stop.
```

**`viben gateway start --json`：**

```json
{
  "success": true,
  "data": {
    "status": "running",
    "agent": "main",
    "model": "claude-sonnet-4-20250514",
    "channels": [
      {"name": "telegram", "status": "connected", "identifier": "@my_bot"},
      {"name": "discord", "status": "connected", "identifier": "MyBot#1234"}
    ],
    "pid": 12345
  }
}
```

**`viben gateway status`（人类可读）：**

```
Gateway Status: Running

  Host: 127.0.0.1
  Port: 18790
  PID:  12345
  Agent: main
  Uptime: 2h 15m

Channels:
  telegram    connected   @my_bot        2h ago
  discord     connected   MyBot#1234     2h ago

Health:
  ✓ Message bus: healthy
  ✓ Agent loop: healthy
  ✓ Memory usage: 128MB
```

## API 端点

Gateway 启动后提供以下 HTTP API：

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `GET /api/agents` | 智能体管理 |
| `GET /api/sessions` | 会话管理 |
| `POST /api/chat` | 聊天 API |
| `GET /api/providers` | Provider 配置 |
| `GET /api/models` | 模型配置 |

默认地址：`http://127.0.0.1:18790`

## 相关命令

- [viben channel](./channel) - Channel 管理
- [viben cron](./cron) - 定时任务管理
- [viben agent](./agent) - 智能体管理
