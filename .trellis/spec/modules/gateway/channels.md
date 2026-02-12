# 通道 API

> `/api/channels` - 消息通道管理端点

## 概述

通道 API 提供消息通道的配置和管理功能，支持多种消息平台集成。

## 端点列表

### 通道实例 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/channels` | 列出所有通道 |
| POST | `/api/channels` | 创建通道 |
| GET | `/api/channels/:id` | 获取通道详情 |
| PATCH | `/api/channels/:id` | 更新通道 |
| DELETE | `/api/channels/:id` | 删除通道 |
| POST | `/api/channels/:id/default` | 设为默认通道 |

### 消息操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/channels/send` | 发送消息 |
| POST | `/api/channels/test` | 测试通道配置 |
| POST | `/api/channels/send-test` | 发送测试消息 |

---

## 详细说明

### GET /api/channels

列出所有配置的通道实例。

**响应**:

```json
{
  "channels": [
    {
      "id": "ch-telegram-1",
      "name": "My Telegram Bot",
      "type": "Telegram",
      "enabled": true,
      "is_default": true,
      "created_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": "ch-discord-1",
      "name": "Discord Server",
      "type": "Discord",
      "enabled": true,
      "is_default": false
    }
  ]
}
```

---

### POST /api/channels

创建通道实例。

**请求体**:

```json
{
  "name": "My Telegram Bot",
  "type": "Telegram",
  "config": {
    "bot_token": "123456:ABC-DEF..."
  }
}
```

**通道类型配置**:

#### Telegram

```json
{
  "type": "Telegram",
  "config": {
    "bot_token": "123456:ABC-DEF..."
  }
}
```

#### Discord

```json
{
  "type": "Discord",
  "config": {
    "bot_token": "MTIz...",
    "guild_id": "123456789"
  }
}
```

#### Feishu (飞书)

```json
{
  "type": "Feishu",
  "config": {
    "app_id": "cli_xxx",
    "app_secret": "xxx"
  }
}
```

#### WhatsApp

```json
{
  "type": "WhatsApp",
  "config": {
    "phone_number_id": "123456",
    "access_token": "xxx"
  }
}
```

#### Slack

```json
{
  "type": "Slack",
  "config": {
    "bot_token": "xoxb-xxx"
  }
}
```

#### Webhook

```json
{
  "type": "Webhook",
  "config": {
    "url": "https://example.com/webhook",
    "secret": "optional-secret"
  }
}
```

---

### POST /api/channels/send

发送消息到指定通道。

**请求体**:

```json
{
  "channel_type": "Telegram",
  "config": {
    "bot_token": "123456:ABC-DEF..."
  },
  "chat_id": "123456789",
  "message": "Hello from Viben!",
  "parse_mode": "Markdown"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| channel_type | string | ✓ | 通道类型 |
| config | object | ✓ | 通道配置 |
| chat_id | string | ✓ | 聊天/频道 ID |
| message | string | ✓ | 消息内容 |
| parse_mode | string | 否 | 解析模式 (Markdown/HTML) |

**响应**:

```json
{
  "success": true,
  "message_id": "12345"
}
```

---

### POST /api/channels/test

测试通道配置是否有效。

**请求体**:

```json
{
  "type": "Telegram",
  "config": {
    "bot_token": "123456:ABC-DEF..."
  }
}
```

**响应**:

```json
{
  "valid": true,
  "bot_info": {
    "username": "my_bot",
    "name": "My Bot"
  }
}
```

**错误响应**:

```json
{
  "valid": false,
  "error": "Invalid bot token"
}
```

---

### POST /api/channels/send-test

发送测试消息验证配置。

**请求体**:

```json
{
  "channel_id": "ch-telegram-1",
  "chat_id": "123456789"
}
```

**响应**:

```json
{
  "success": true,
  "message": "Test message sent successfully"
}
```

---

## 通道类型

| 类型 | 说明 | 必需配置 |
|------|------|----------|
| Telegram | Telegram Bot | `bot_token` |
| Discord | Discord Bot | `bot_token`, `guild_id` |
| Feishu | 飞书机器人 | `app_id`, `app_secret` |
| WhatsApp | WhatsApp Business | `phone_number_id`, `access_token` |
| Slack | Slack Bot | `bot_token` |
| Webhook | 自定义 Webhook | `url` |

---

## 通道配置存储

通道配置存储在 `~/.viben/channels.yaml`:

```yaml
default: ch-telegram-1

channels:
  - id: ch-telegram-1
    name: My Telegram Bot
    type: Telegram
    enabled: true
    config:
      bot_token: "123456:ABC-DEF..."

  - id: ch-discord-1
    name: Discord Server
    type: Discord
    enabled: true
    config:
      bot_token: "MTIz..."
      guild_id: "123456789"
```

---

## 相关端点

- [定时任务 API](./cron.md) - 定时任务管理
- [智能体 API](./agents.md) - 智能体管理
