# 模型 API

> `/api/models` - 模型管理端点

## 概述

模型 API 提供 AI 模型的配置和管理功能，支持自定义模型和提供商预定义模型。

## 端点列表

### 模型 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/models` | 列出模型 |
| POST | `/api/models` | 创建自定义模型 |
| GET | `/api/models/:id` | 获取模型详情 |
| PATCH | `/api/models/:id` | 更新模型 |
| DELETE | `/api/models/:id` | 删除模型 |

### 默认模型

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/models/default` | 获取默认模型 |
| PUT | `/api/models/default` | 设置默认模型 |

### 模型状态

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/models/:id/enable` | 启用模型 |
| POST | `/api/models/:id/disable` | 禁用模型 |

### 提供商模型

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/providers/:id/discover-models` | 发现可用模型 |
| GET | `/api/providers/:id/models` | 列出已启用模型 |
| POST | `/api/providers/:pid/models/:mid/enable` | 启用模型 |
| POST | `/api/providers/:pid/models/:mid/disable` | 禁用模型 |

---

## 详细说明

### GET /api/models

列出所有模型。

**查询参数**:

| 参数 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| workspace_path | string | 否 | - | 工作区路径 |
| include_global | bool | 否 | true | 包含全局模型 |
| include_provider_predefined | bool | 否 | true | 包含提供商预定义模型 |

**响应**:

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

创建自定义模型。

**请求体**:

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

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | 否 | 模型 ID (自动生成) |
| name | string | ✓ | 模型名称 |
| provider | string | ✓ | 提供商 ID |
| base_model | string | 否 | 基础模型 |
| system_prompt | string | 否 | 系统提示词 |
| temperature | float | 否 | 温度参数 |
| max_tokens | int | 否 | 最大 token 数 |
| parameters | object | 否 | 其他参数 |

---

### GET /api/models/:id

获取模型详情。

**响应**:

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

发现提供商可用的模型列表。

**响应**:

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

设置默认模型。

**请求体**:

```json
{
  "model_id": "claude-3-sonnet"
}
```

**响应**:

```json
{
  "success": true,
  "default_model": "claude-3-sonnet"
}
```

---

## 模型配置存储

模型配置存储在 `~/.viben/models.yaml`:

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

## 相关端点

- [提供商 API](./providers.md) - 提供商管理
- [智能体 API](./agents.md) - 智能体管理
