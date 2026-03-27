# Model API

> `/api/models` - Model management endpoints

## Overview

The Model API provides AI model configuration and management functionality, supporting custom models and provider-predefined models.

## Endpoint List

### Model CRUD

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models` | List models |
| POST | `/api/models` | Create custom model |
| GET | `/api/models/:id` | Get model details |
| PATCH | `/api/models/:id` | Update model |
| DELETE | `/api/models/:id` | Delete model |

### Default Model

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models/default` | Get default model |
| PUT | `/api/models/default` | Set default model |

### Model Status

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/models/:id/enable` | Enable model |
| POST | `/api/models/:id/disable` | Disable model |

### Provider Models

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/providers/:id/discover-models` | Discover available models |
| GET | `/api/providers/:id/models` | List enabled models |
| POST | `/api/providers/:pid/models/:mid/enable` | Enable model |
| POST | `/api/providers/:pid/models/:mid/disable` | Disable model |

---

## Detailed Description

### GET /api/models

List all models.

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| workspace_path | string | No | - | Workspace path |
| include_global | bool | No | true | Include global models |
| include_provider_predefined | bool | No | true | Include provider-predefined models |

**Response**:

```json
{
  "models": [
    {
      "id": "claude-3-sonnet",
      "name": "Claude 3 Sonnet",
      "provider": "anthropic",
      "type": "predefined",
      "enabled": true,
      "is_default": true,
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
      "id": "my-custom-model",
      "name": "My Custom Model",
      "provider": "openai",
      "type": "custom",
      "enabled": true,
      "base_model": "gpt-4"
    }
  ]
}
```

---

### POST /api/models

Create a custom model.

**Request Body**:

```json
{
  "id": "my-model",
  "name": "My Custom Model",
  "provider": "openai",
  "base_model": "gpt-4",
  "system_prompt": "You are a helpful assistant.",
  "temperature": 0.7,
  "max_tokens": 4096,
  "parameters": {
    "top_p": 0.9
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | No | Model ID (auto-generated) |
| name | string | Yes | Model name |
| provider | string | Yes | Provider ID |
| base_model | string | No | Base model |
| system_prompt | string | No | System prompt |
| temperature | float | No | Temperature parameter |
| max_tokens | int | No | Maximum tokens |
| parameters | object | No | Other parameters |

---

### GET /api/models/:id

Get model details.

**Response**:

```json
{
  "id": "claude-3-sonnet",
  "name": "Claude 3 Sonnet",
  "provider": "anthropic",
  "type": "predefined",
  "enabled": true,
  "is_default": true,
  "capabilities": {
    "chat": true,
    "code": true,
    "vision": true,
    "tools": true,
    "streaming": true
  },
  "context_window": 200000,
  "max_output_tokens": 4096,
  "pricing": {
    "input_per_1k": 0.003,
    "output_per_1k": 0.015
  }
}
```

---

### GET /api/providers/:id/discover-models

Discover available models from a provider.

**Response**:

```json
{
  "models": [
    {
      "id": "claude-3-opus",
      "name": "Claude 3 Opus",
      "enabled": false,
      "description": "Most capable model"
    },
    {
      "id": "claude-3-sonnet",
      "name": "Claude 3 Sonnet",
      "enabled": true,
      "description": "Balanced model"
    },
    {
      "id": "claude-3-haiku",
      "name": "Claude 3 Haiku",
      "enabled": true,
      "description": "Fast and efficient"
    }
  ]
}
```

---

### PUT /api/models/default

Set the default model.

**Request Body**:

```json
{
  "model_id": "claude-3-sonnet"
}
```

**Response**:

```json
{
  "success": true,
  "default_model": "claude-3-sonnet"
}
```

---

## Model Configuration Storage

Model configuration is stored in `~/.viben/models.yaml`:

```yaml
default: claude-3-sonnet

models:
  - id: claude-3-sonnet
    provider: anthropic
    enabled: true

  - id: my-custom-model
    name: My Custom Model
    provider: openai
    base_model: gpt-4
    temperature: 0.7
```

---

## Related Endpoints

- [Provider API](./providers.md) - Provider management
- [Agent API](./agents.md) - Agent management
