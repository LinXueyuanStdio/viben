# Channel API

> `/api/channels` - Message channel management endpoints

## Overview

The Channel API provides message channel configuration and management functionality, supporting multiple messaging platform integrations.

## Endpoint List

### Channel Instance CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/channels` | List all channels |
| POST | `/api/channels` | Create channel |
| GET | `/api/channels/:id` | Get channel details |
| PATCH | `/api/channels/:id` | Update channel |
| DELETE | `/api/channels/:id` | Delete channel |
| POST | `/api/channels/:id/default` | Set as default channel |

### Message Operations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/channels/send` | Send message |
| POST | `/api/channels/test` | Test channel configuration |
| POST | `/api/channels/send-test` | Send test message |

---

## Detailed Description

### GET /api/channels

List all configured channel instances.

**Response**:

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

Create a channel instance.

**Request Body**:

```json
{
  "name": "My Telegram Bot",
  "type": "Telegram",
  "config": {
    "bot_token": "123456:ABC-DEF..."
  }
}
```

**Channel Type Configurations**:

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

#### Feishu (Lark)

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

Send a message to a specified channel.

**Request Body**:

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| channel_type | string | Yes | Channel type |
| config | object | Yes | Channel configuration |
| chat_id | string | Yes | Chat/channel ID |
| message | string | Yes | Message content |
| parse_mode | string | No | Parse mode (Markdown/HTML) |

**Response**:

```json
{
  "success": true,
  "message_id": "12345"
}
```

---

### POST /api/channels/test

Test if channel configuration is valid.

**Request Body**:

```json
{
  "type": "Telegram",
  "config": {
    "bot_token": "123456:ABC-DEF..."
  }
}
```

**Response**:

```json
{
  "valid": true,
  "bot_info": {
    "username": "my_bot",
    "name": "My Bot"
  }
}
```

**Error Response**:

```json
{
  "valid": false,
  "error": "Invalid bot token"
}
```

---

### POST /api/channels/send-test

Send a test message to verify configuration.

**Request Body**:

```json
{
  "channel_id": "ch-telegram-1",
  "chat_id": "123456789"
}
```

**Response**:

```json
{
  "success": true,
  "message": "Test message sent successfully"
}
```

---

## Channel Types

| Type | Description | Required Configuration |
|------|-------------|------------------------|
| Telegram | Telegram Bot | `bot_token` |
| Discord | Discord Bot | `bot_token`, `guild_id` |
| Feishu | Feishu (Lark) Bot | `app_id`, `app_secret` |
| WhatsApp | WhatsApp Business | `phone_number_id`, `access_token` |
| Slack | Slack Bot | `bot_token` |
| Webhook | Custom Webhook | `url` |

---

## Channel Configuration Storage

Channel configuration is stored in `~/.viben/channels.yaml`:

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

## Related Endpoints

- [Scheduled Task API](./cron.md) - Scheduled task management
- [Agent API](./agents.md) - Agent management
