# viben gateway

> 启动 Gateway - 连接 channels 到 agent loop 的核心运行时。

## 命令

```bash
# Start gateway (foreground, default)
viben gateway
viben gateway start

# Start gateway with specific options
viben gateway start --host 127.0.0.1 --port 18790 --log-level info

# Stop running gateway
viben gateway stop
viben gateway stop --port 18790    # Stop on specific port

# Restart gateway (stop then start)
viben gateway restart
viben gateway restart --port 18790 --log-level debug

# Check gateway status
viben gateway status
```

## Gateway 命令

| 命令 | 说明 |
|------|------|
| `viben gateway` | 启动 gateway（默认，等同于 `start`） |
| `viben gateway start` | 启动 gateway，支持 `--host`, `--port`, `--log-level` |
| `viben gateway stop` | 停止运行中的 gateway（自动查找并终止占用端口的进程） |
| `viben gateway restart` | 重启 gateway（先停止再启动） |
| `viben gateway status` | 检查 gateway 运行状态和健康状态 |

## 选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-H, --host <host>` | Gateway 监听地址 | `127.0.0.1` |
| `-p, --port <port>` | Gateway 监听端口 | `18790` |
| `-l, --log-level <level>` | 日志级别 (debug, info, warn, error) | `info` |

---

## Binary Discovery

Gateway 命令会按以下顺序查找 `viben-gateway` 二进制文件：

1. 开发路径：`./crates/target/release/viben-gateway`
2. 开发路径：`./crates/target/debug/viben-gateway`
3. 用户安装：`~/.viben/bin/viben-gateway`
4. 系统安装：`/usr/local/bin/viben-gateway`
5. Homebrew：`/opt/viben/bin/viben-gateway`

---

## 架构 (based on nanobot)

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

---

## Gateway 生命周期

1. Load configuration from `~/.viben/config.yaml`
2. Initialize enabled channels (Telegram, Discord, etc.)
3. Start message bus
4. Start agent loop
5. Process messages until shutdown

---

## 输出示例

**`viben gateway` (Human)**:
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

**`viben gateway --json`**:
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

---

## Acceptance Criteria

### Gateway (Agent Runtime)
- [ ] `viben gateway` 启动 gateway
- [ ] `viben gateway -n <agent-id>` 指定 agent
- [ ] `viben gateway --daemon` 后台运行
- [ ] `viben gateway stop` 停止后台 gateway
- [ ] Gateway 正确初始化 message bus
- [ ] Gateway 正确启动 agent loop
- [ ] Gateway 正确连接已启用的 channels

---

## Related Documents

- [channel.md](./channel.md) - Channel 管理
- [cron.md](./cron.md) - 定时任务管理
- [agent.md](./agent.md) - Agent 管理
