---
sidebar_position: 12
title: "viben channel"
description: "Manage Gateway chat channels"
---

# viben channel

Manage Gateway chat channels.

## Supported Channel Types

| Type | Description | Setup Difficulty |
|------|-------------|------------------|
| `telegram` | Telegram Bot API | Easy (token only) |
| `discord` | Discord Bot | Easy (bot token + intents) |
| `whatsapp` | WhatsApp via bridge | Medium (scan QR code) |
| `feishu` | Feishu/Lark WebSocket | Medium (app credentials) |
| `slack` | Slack Web API | Medium |
| `webhook` | Generic Webhook | Easy |

## Commands

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

# Create channel
viben channel create -n <id> --type <type> [options]
viben channel create -n my-telegram --type telegram --token "BOT_TOKEN"
viben channel create -n my-discord --type discord --token "BOT_TOKEN"
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "xxx"

# Remove channel
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
viben channel config -n my-telegram set allow_from '["123456789"]'
viben channel config -n my-telegram set proxy "http://127.0.0.1:7890"

# ============================================================
# WhatsApp Specific Commands
# ============================================================

# Link WhatsApp device (scan QR code)
viben channel login -n <whatsapp-id>
```

## Channel Configuration

```yaml
# ~/.viben/channels.yaml
version: 1

default: my-telegram

channels:
  my-telegram:
    type: telegram
    enabled: true
    token: "encrypted:xxx"  # Bot token from @BotFather
    allow_from:             # User ID whitelist (empty = allow all)
      - "123456789"
    proxy: null             # HTTP/SOCKS5 proxy URL

  my-discord:
    type: discord
    enabled: true
    token: "encrypted:xxx"  # Bot token from Discord Developer Portal
    allow_from: []          # User ID whitelist
    intents: 37377          # GUILDS + GUILD_MESSAGES + DIRECT_MESSAGES + MESSAGE_CONTENT

  my-whatsapp:
    type: whatsapp
    enabled: false
    bridge_url: "ws://localhost:3001"
    allow_from: []          # Phone number whitelist

  my-feishu:
    type: feishu
    enabled: false
    app_id: "cli_xxx"
    app_secret: "encrypted:xxx"
    encrypt_key: ""         # Optional for WebSocket mode
    verification_token: ""  # Optional for WebSocket mode
    allow_from: []          # User open_id whitelist
```

## Output Examples

**`viben channel types` (human-readable):**

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

**`viben channel types --json`:**

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

**`viben channel list` (human-readable):**

```
ID          NAME         TYPE      ENABLED  DEFAULT
----------  -----------  --------  -------  -------
vibenrobot  viben_robot  telegram  yes      *
my-discord  My Discord   discord   yes
my-feishu   Feishu Bot   feishu    no

No channels configured:
  Use 'viben channel types' to see supported channel types.
```

**`viben channel list --json`:**

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

**`viben channel status` (human-readable):**

```
Channel Status:
  my-telegram    telegram   ✓ connected    @my_bot
  my-discord     discord    ✓ connected    MyBot#1234
  my-whatsapp    whatsapp   ○ disabled     -
  my-feishu      feishu     ○ disabled     -
```

## Telegram Channel Setup

### 1. Create Bot

1. Find [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Follow the prompts to set the name
4. Get the Bot Token

### 2. Configure Channel

```bash
viben channel create -n my-telegram --type telegram --token "YOUR_BOT_TOKEN"
```

### 3. Set Whitelist (Optional)

```bash
# Only allow specific users
viben channel config -n my-telegram set allow_from '["123456789", "987654321"]'
```

## Discord Channel Setup

### 1. Create Application

1. Visit [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Get the Token from the Bot page
4. Enable the required Intents

### 2. Configure Channel

```bash
viben channel create -n my-discord --type discord --token "YOUR_BOT_TOKEN"
```

## Feishu Channel Setup

### 1. Create Application

1. Visit [Feishu Open Platform](https://open.feishu.cn/)
2. Create an enterprise self-built application
3. Get the App ID and App Secret
4. Enable bot capabilities

### 2. Configure Channel

```bash
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "YOUR_APP_SECRET"
```

## Related Commands

- [viben gateway](./gateway) - Gateway runtime
- [viben cron](./cron) - Scheduled task management
