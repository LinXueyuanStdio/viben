# 提供商 API

> `/api/providers` - 提供商管理端点

## 概述

提供商 API 与模型 API 配合使用，提供提供商的模型发现和管理功能。

## 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers/:id/discover-models` | 发现可用模型 |
| GET | `/api/providers/:id/models` | 列出已启用模型 |
| POST | `/api/providers/:pid/models/:mid/enable` | 启用模型 |
| POST | `/api/providers/:pid/models/:mid/disable` | 禁用模型 |

---

## 详细说明

### GET /api/providers/:id/discover-models

发现提供商可用的所有模型。

**路径参数**:
- `id`: 提供商 ID (如 `anthropic`, `openai`)

**响应**:

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

列出提供商已启用的模型。

**响应**:

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

为提供商启用指定模型。

**路径参数**:
- `pid`: 提供商 ID
- `mid`: 模型 ID

**响应**:

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

为提供商禁用指定模型。

**响应**:

```json
{
  "success": true,
  "provider_id": "anthropic",
  "model_id": "claude-3-opus",
  "enabled": false
}
```

---

## 支持的提供商

| ID | 名称 | 说明 |
|-----|------|------|
| anthropic | Anthropic | Claude 系列模型 |
| openai | OpenAI | GPT 系列模型 |
| google | Google | Gemini 系列模型 |
| ollama | Ollama | 本地模型 |

---

## 提供商配置存储

提供商配置存储在 `~/.viben/providers/` 目录下：

```
~/.viben/providers/
├── anthropic.yaml
├── openai.yaml
└── ollama.yaml
```

**配置文件格式**:

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

## 相关端点

- [模型 API](./models.md) - 模型管理
- [智能体 API](./agents.md) - 智能体管理
