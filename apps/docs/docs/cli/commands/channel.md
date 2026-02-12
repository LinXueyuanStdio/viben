# viben channel

> 管理 Gateway 的聊天渠道。

## 支持的渠道类型

| Type | Description | Setup Difficulty |
|------|-------------|------------------|
| `telegram` | Telegram Bot API | Easy (just a token) |
| `discord` | Discord Bot | Easy (bot token + intents) |
| `whatsapp` | WhatsApp via bridge | Medium (scan QR) |
| `feishu` | Feishu/Lark WebSocket | Medium (app credentials) |
| `slack` | Slack Web API | Medium |
| `webhook` | Generic Webhook | Easy |

---

## 命令

```bash
# ============================================================
# Channel Management
# ============================================================

# List supported channel types
viben channel types
viben channel types --json

# List configured channels
viben channel list
viben channel list --json

# Create a channel
viben channel create -n <id> --type <type> [options]
viben channel create -n my-telegram --type telegram --token "BOT_TOKEN"
viben channel create -n my-discord --type discord --token "BOT_TOKEN"
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "xxx"

# Remove a channel
viben channel remove -n <id>

# Enable/disable channel
viben channel enable -n <id>
viben channel disable -n <id>

# Set default channel
viben channel set-default -n <id>

# View channel status
viben channel status
viben channel status -n <id>

# ============================================================
# Channel Configuration
# ============================================================

# Configure channel settings
viben channel config -n <id>
viben channel config -n my-telegram set allow_from "[\"123456789\"]"
viben channel config -n my-telegram set proxy "http://127.0.0.1:7890"

# ============================================================
# WhatsApp-specific Commands
# ============================================================

# Link WhatsApp device (scan QR)
viben channel login -n <whatsapp-id>
```

---

## Channel 配置

```yaml
# ~/.viben/channels.yaml
version: 1

default: my-telegram

channels:
  my-telegram:
    type: telegram
    enabled: true
    token: "encrypted:xxx"  # Bot token from @BotFather
    allow_from:             # Whitelist of user IDs (empty = allow all)
      - "123456789"
    proxy: null             # HTTP/SOCKS5 proxy URL

  my-discord:
    type: discord
    enabled: true
    token: "encrypted:xxx"  # Bot token from Discord Developer Portal
    allow_from: []          # Whitelist of user IDs
    intents: 37377          # GUILDS + GUILD_MESSAGES + DIRECT_MESSAGES + MESSAGE_CONTENT

  my-whatsapp:
    type: whatsapp
    enabled: false
    bridge_url: "ws://localhost:3001"
    allow_from: []          # Whitelist of phone numbers

  my-feishu:
    type: feishu
    enabled: false
    app_id: "cli_xxx"
    app_secret: "encrypted:xxx"
    encrypt_key: ""         # Optional for WebSocket mode
    verification_token: ""  # Optional for WebSocket mode
    allow_from: []          # Whitelist of user open_ids
```

---

## 输出示例

**`viben channel types` (Human)**:
```
TYPE      DESCRIPTION
--------  -----------------------
telegram  Telegram Bot API
discord   Discord Bot API
feishu    Feishu (Lark) Open Platform
whatsapp  WhatsApp Web Bridge
slack     Slack Web API
webhook   Generic Webhook
```

**`viben channel types --json`**:
```json
{
  "success": true,
  "data": {
    "types": [
      { "id": "telegram", "name": "Telegram Bot API" },
      { "id": "discord", "name": "Discord Bot API" },
      { "id": "feishu", "name": "Feishu (Lark) Open Platform" },
      { "id": "whatsapp", "name": "WhatsApp Web Bridge" },
      { "id": "slack", "name": "Slack Web API" },
      { "id": "webhook", "name": "Generic Webhook" }
    ]
  }
}
```

**`viben channel list` (Human)**:
```
ID          NAME         TYPE      ENABLED  DEFAULT
----------  -----------  --------  -------  -------
vibenrobot  viben_robot  telegram  yes      *
my-discord  My Discord   discord   yes
my-feishu   Feishu Bot   feishu    no

No channels configured:
  Use 'viben channel types' to see supported channel types.
```

**`viben channel list --json`**:
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "vibenrobot",
        "channel_type": "telegram",
        "name": "viben_robot",
        "config": { "type": "telegram", "chat_id": "123456789" },
        "is_default": true,
        "enabled": true,
        "notification_mode": "none",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

**`viben channel status` (Human)**:
```
Channel Status:
  my-telegram    telegram   ✓ connected    @my_bot
  my-discord     discord    ✓ connected    MyBot#1234
  my-whatsapp    whatsapp   ○ disabled     -
  my-feishu      feishu     ○ disabled     -
```

---

## Acceptance Criteria

### Channel Management
- [x] `viben channel types` 列出支持的 channel 类型
- [x] `viben channel types --json` 输出 JSON 格式
- [x] `viben channel list` 列出已配置的 channels
- [x] `viben channel list --json` 输出 JSON 格式
- [ ] `viben channel create -n <id> --type telegram --token <token>` 创建 Telegram channel
- [ ] `viben channel create -n <id> --type discord --token <token>` 创建 Discord channel
- [ ] `viben channel create -n <id> --type feishu --app-id <id> --app-secret <secret>` 创建 Feishu channel
- [ ] `viben channel remove -n <id>` 删除 channel
- [ ] `viben channel enable -n <id>` 启用 channel
- [ ] `viben channel disable -n <id>` 禁用 channel
- [ ] `viben channel set-default -n <id>` 设置默认 channel
- [ ] `viben channel status` 显示 channel 连接状态
- [ ] `viben channel config -n <id> set <key> <value>` 配置 channel
- [ ] `viben channel login -n <id>` WhatsApp QR 扫码登录
- [ ] Channels 配置存储在 `~/.viben/channels.yaml`
- [x] 支持 channel 类型: telegram, discord, whatsapp, feishu, slack, webhook

---

## Related Documents

- [gateway.md](./gateway.md) - Gateway 运行时
- [cron.md](./cron.md) - 定时任务管理
