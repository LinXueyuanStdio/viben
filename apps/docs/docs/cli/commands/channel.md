---
sidebar_position: 12
title: "viben channel"
description: "管理 Gateway 的聊天渠道"
---

# viben channel

管理 Gateway 的聊天渠道。

## 支持的渠道类型

| 类型 | 说明 | 设置难度 |
|------|------|----------|
| `telegram` | Telegram Bot API | 简单（只需 token） |
| `discord` | Discord Bot | 简单（bot token + intents） |
| `whatsapp` | WhatsApp via bridge | 中等（扫描二维码） |
| `feishu` | 飞书/Lark WebSocket | 中等（应用凭证） |
| `slack` | Slack Web API | 中等 |
| `webhook` | 通用 Webhook | 简单 |

## 命令

```bash
# ============================================================
# Channel 管理
# ============================================================

# 列出支持的渠道类型
viben channel types
viben channel types --json

# 列出已配置的渠道
viben channel list
viben channel list --json

# 创建渠道
viben channel create -n <id> --type <type> [options]
viben channel create -n my-telegram --type telegram --token "BOT_TOKEN"
viben channel create -n my-discord --type discord --token "BOT_TOKEN"
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "xxx"

# 删除渠道
viben channel remove -n <id>

# 启用/禁用渠道
viben channel enable -n <id>
viben channel disable -n <id>

# 设置默认渠道
viben channel set-default -n <id>

# 查看渠道状态
viben channel status
viben channel status -n <id>

# ============================================================
# 渠道配置
# ============================================================

# 配置渠道设置
viben channel config -n <id>
viben channel config -n my-telegram set allow_from '["123456789"]'
viben channel config -n my-telegram set proxy "http://127.0.0.1:7890"

# ============================================================
# WhatsApp 特定命令
# ============================================================

# 链接 WhatsApp 设备（扫描二维码）
viben channel login -n <whatsapp-id>
```

## Channel 配置

```yaml
# ~/.viben/channels.yaml
version: 1

default: my-telegram

channels:
  my-telegram:
    type: telegram
    enabled: true
    token: "encrypted:xxx"  # 来自 @BotFather 的 Bot token
    allow_from:             # 用户 ID 白名单（空 = 允许所有）
      - "123456789"
    proxy: null             # HTTP/SOCKS5 代理 URL

  my-discord:
    type: discord
    enabled: true
    token: "encrypted:xxx"  # 来自 Discord 开发者门户的 Bot token
    allow_from: []          # 用户 ID 白名单
    intents: 37377          # GUILDS + GUILD_MESSAGES + DIRECT_MESSAGES + MESSAGE_CONTENT

  my-whatsapp:
    type: whatsapp
    enabled: false
    bridge_url: "ws://localhost:3001"
    allow_from: []          # 电话号码白名单

  my-feishu:
    type: feishu
    enabled: false
    app_id: "cli_xxx"
    app_secret: "encrypted:xxx"
    encrypt_key: ""         # WebSocket 模式可选
    verification_token: ""  # WebSocket 模式可选
    allow_from: []          # 用户 open_id 白名单
```

## 输出示例

**`viben channel types`（人类可读）：**

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

**`viben channel types --json`：**

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

**`viben channel list`（人类可读）：**

```
ID          NAME         TYPE      ENABLED  DEFAULT
----------  -----------  --------  -------  -------
vibenrobot  viben_robot  telegram  yes      *
my-discord  My Discord   discord   yes
my-feishu   Feishu Bot   feishu    no

No channels configured:
  Use 'viben channel types' to see supported channel types.
```

**`viben channel list --json`：**

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

**`viben channel status`（人类可读）：**

```
Channel Status:
  my-telegram    telegram   ✓ connected    @my_bot
  my-discord     discord    ✓ connected    MyBot#1234
  my-whatsapp    whatsapp   ○ disabled     -
  my-feishu      feishu     ○ disabled     -
```

## Telegram 渠道设置

### 1. 创建 Bot

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`
3. 按提示设置名称
4. 获取 Bot Token

### 2. 配置渠道

```bash
viben channel create -n my-telegram --type telegram --token "YOUR_BOT_TOKEN"
```

### 3. 设置白名单（可选）

```bash
# 只允许特定用户使用
viben channel config -n my-telegram set allow_from '["123456789", "987654321"]'
```

## Discord 渠道设置

### 1. 创建应用

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建新应用
3. 在 Bot 页面获取 Token
4. 启用所需的 Intents

### 2. 配置渠道

```bash
viben channel create -n my-discord --type discord --token "YOUR_BOT_TOKEN"
```

## 飞书渠道设置

### 1. 创建应用

1. 访问[飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 启用机器人能力

### 2. 配置渠道

```bash
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "YOUR_APP_SECRET"
```

## 相关命令

- [viben gateway](./gateway) - Gateway 运行时
- [viben cron](./cron) - 定时任务管理
