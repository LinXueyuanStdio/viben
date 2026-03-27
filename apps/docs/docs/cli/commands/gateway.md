---
sidebar_position: 11
title: "viben gateway"
description: "Start the Gateway - the core runtime connecting channels to the agent loop"
---

# viben gateway

Start the Gateway - the core runtime connecting channels to the agent loop.

## Commands

```bash
# Start the gateway
viben gateway start

# Start with specific options
viben gateway start --host 127.0.0.1 --port 18790 --log-level info --agent main

# Start in daemon mode
viben gateway start --daemon

# Stop a running gateway
viben gateway stop
viben gateway stop --port 18790    # Stop on specific port

# Restart the gateway (stop then start)
viben gateway restart
viben gateway restart --port 18790 --log-level debug

# Check gateway status
viben gateway status
```

## Gateway Commands

| Command | Description |
|---------|-------------|
| `viben gateway start` | Start the gateway, supports `--host`, `--port`, `--log-level`, `--agent`, `--daemon` |
| `viben gateway stop` | Stop a running gateway, supports `--port` to specify port |
| `viben gateway restart` | Restart the gateway (stop then start), supports all start options |
| `viben gateway status` | Check gateway running status and health |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-h, --host <host>` | Gateway listen address | `127.0.0.1` |
| `-p, --port <port>` | Gateway listen port | `18790` |
| `-l, --log-level <level>` | Log level (debug, info, warn, error) | `info` |
| `-n, --agent <agent-id>` | Specify the agent to run | `main` |
| `-d, --daemon` | Run in background mode | `false` |

## Architecture

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

## Gateway Lifecycle

1. Load configuration from `~/.viben/config.yaml`
2. Initialize enabled channels (Telegram, Discord, etc.)
3. Start the message bus
4. Start the agent loop
5. Process messages until shutdown

## Output Examples

**`viben gateway start` (Human-readable):**

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

**`viben gateway start --json`:**

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

**`viben gateway status` (Human-readable):**

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

## API Endpoints

The gateway provides the following HTTP APIs after startup:

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/agent` | Agent management |
| `GET /api/sessions` | Session management |
| `POST /api/chat` | Chat API |
| `GET /api/providers` | Provider configuration |
| `GET /api/models` | Model configuration |

Default address: `http://127.0.0.1:18790`

## Related Commands

- [viben channel](./channel) - Channel management
- [viben cron](./cron) - Scheduled task management
- [viben agent](./agent) - Agent management
