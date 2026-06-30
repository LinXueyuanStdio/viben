# Provider API

> `/api/providers` - Provider management endpoints

## Overview

The Provider API works in conjunction with the Model API to provide model discovery and management functionality for providers.

## Endpoint List

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/providers/:id/discover-models` | Discover available models |
| GET | `/api/providers/:id/models` | List enabled models |
| POST | `/api/providers/:pid/models/:mid/enable` | Enable model |
| POST | `/api/providers/:pid/models/:mid/disable` | Disable model |

---

## Detailed Description

### GET /api/providers/:id/discover-models

Discover all available models from a provider.

**Path Parameters**:
- `id`: Provider ID (e.g., `anthropic`, `openai`)

**Response**:

```json
{
  "provider_id": "anthropic",
  "models": [
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "description": "Most capable model for complex tasks",
      "enabled": false,
      "capabilities": {
        "chat": true,
        "code": true,
        "vision": true,
        "tools": true
      },
      "context_window": 200000,
      "max_output_tokens": 4096
    },
    {
      "id": "claude-3-sonnet",
      "name": "Claude 3 Sonnet",
      "description": "Balanced performance and speed",
      "enabled": true
    },
    {
      "id": "claude-3-haiku",
      "name": "Claude 3 Haiku",
      "description": "Fast and efficient",
      "enabled": true
    }
  ]
}
```

---

### GET /api/providers/:id/models

List enabled models for a provider.

**Response**:

```json
{
  "provider_id": "anthropic",
  "models": [
    {
      "id": "claude-3-sonnet",
      "name": "Claude 3 Sonnet",
      "enabled": true,
      "is_default": true
    },
    {
      "id": "claude-3-haiku",
      "name": "Claude 3 Haiku",
      "enabled": true,
      "is_default": false
    }
  ]
}
```

---

### POST /api/providers/:pid/models/:mid/enable

Enable a specific model for a provider.

**Path Parameters**:
- `pid`: Provider ID
- `mid`: Model ID

**Response**:

```json
{
  "success": true,
  "provider_id": "anthropic",
  "model_id": "claude-3-opus",
  "enabled": true
}
```

---

### POST /api/providers/:pid/models/:mid/disable

Disable a specific model for a provider.

**Response**:

```json
{
  "success": true,
  "provider_id": "anthropic",
  "model_id": "claude-3-opus",
  "enabled": false
}
```

---

## Supported Providers

| ID | Name | Description |
|----|------|-------------|
| anthropic | Anthropic | Claude series models |
| openai | OpenAI | GPT series models |
| google | Google | Gemini series models |
| ollama | Ollama | Local models |

---

## Provider Configuration Storage

Provider configuration is stored in the `~/.viben/providers/` directory:

```
~/.viben/providers/
├── anthropic.yaml
├── openai.yaml
└── ollama.yaml
```

**Configuration File Format**:

```yaml
id: anthropic
name: Anthropic
api_key_env: ANTHROPIC_API_KEY
base_url: https://api.anthropic.com
enabled_models:
  - claude-3-sonnet
  - claude-3-haiku
```

---

## Related Endpoints

- [Model API](./models.md) - Model management
- [Agent API](./agents.md) - Agent management
