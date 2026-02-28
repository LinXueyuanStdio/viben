---
sidebar_position: 9
title: "viben provider"
description: "管理 API 提供商 - OpenAI、Anthropic、Google、Azure 等"
---

# viben provider

管理 AI 模型的 API 提供商。

## 用法

```bash
viben provider <subcommand> [options]
```

## 子命令

| 子命令 | 说明 |
|--------|------|
| `list` | 列出所有已配置的 providers |
| `create` | 创建新 provider |
| `remove` | 删除 provider |
| `set-default` | 设置默认 provider |
| `status` | 检查 provider 连通性 |

## Provider 类型

| 类型 | 说明 | 认证方式 |
|------|------|----------|
| `openai` | OpenAI API | API Key |
| `anthropic` | Anthropic API | API Key |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama（本地） | 无 |
| `custom` | 自定义 OpenAI 兼容 | API Key |

## 命令

### 列出 Providers

列出所有已配置的 providers：

```bash
viben provider list
viben provider list --json
```

**输出（人类可读）：**

```
Providers:
  anthropic-main*   anthropic   ✓ connected
  openai-main       openai      ✓ connected
  azure-gpt4        azure       ✓ connected
  local-ollama      ollama      ○ not running
  custom-api        custom      ✓ connected

* = default provider
```

**输出（JSON）：**

```json
{
  "success": true,
  "data": {
    "default": "anthropic-main",
    "providers": [
      {
        "name": "anthropic-main",
        "type": "anthropic",
        "status": "connected"
      },
      {
        "name": "openai-main",
        "type": "openai",
        "status": "connected"
      },
      {
        "name": "local-ollama",
        "type": "ollama",
        "status": "not_running"
      }
    ]
  }
}
```

### 创建 Provider

创建新 provider：

```bash
# 创建带显式名称和类型
viben provider create -n my-anthropic -t anthropic --api-key sk-ant-xxx

# 创建自动生成名称
viben provider create -t openai --api-key sk-xxx

# 创建带 base URL 的自定义 provider
viben provider create -t custom --api-key sk-xxx --base-url https://api.example.com/v1

# 从配置文件创建
viben provider create -n my-provider -t anthropic -c /path/to/config.yaml
```

**输出：**

```
Created provider 'anthropic-main'
```

### 删除 Provider

```bash
viben provider remove -n anthropic-main
```

### 设置默认 Provider

```bash
viben provider set-default -n openai-main
```

### Provider 状态

检查 provider 连通性：

```bash
# 检查所有 providers
viben provider status

# 检查特定 provider
viben provider status -n anthropic-main
```

**输出（人类可读）：**

```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
  openai-main      openai      ✓ connected   latency: 85ms
  azure-gpt4       azure       ✓ connected   latency: 150ms
  local-ollama     ollama      ✗ error       connection refused
  custom-api       custom      ✓ connected   latency: 200ms
```

## 环境变量

Providers 可以使用环境变量配置：

| Provider | API Key | Base URL | 其他 |
|----------|---------|----------|------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `custom` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |

### 优先级

Provider 配置按以下顺序解析：

1. 命令行参数 (`--api-key`)
2. 配置文件中的值
3. Provider 特定环境变量（如 `ANTHROPIC_API_KEY`）
4. 通用环境变量（如 custom 类型使用 `OPENAI_API_KEY`）

### 快速配置

```bash
# 设置环境变量（推荐）
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 创建 providers（自动使用环境变量）
viben provider create -t anthropic
viben provider create -t openai
```

## Provider 配置文件

```yaml
# ~/.viben/providers.yaml
version: 1

default: anthropic-main

providers:
  anthropic-main:
    type: anthropic
    # API key 从 ANTHROPIC_API_KEY 环境变量获取

  openai-main:
    type: openai
    # API key 从 OPENAI_API_KEY 环境变量获取

  azure-gpt4:
    type: azure
    AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
    AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
    AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"

  local-ollama:
    type: ollama
    OLLAMA_HOST: "http://localhost:11434"

  custom-api:
    type: custom
    OPENAI_BASE_URL: "https://api.example.com/v1"
```

## 错误处理

### Provider 未找到

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'unknown-provider' not found"
  }
}
```

### 无效的 API Key

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key for provider 'anthropic-main'"
  }
}
```

### 连接错误

```json
{
  "success": false,
  "error": {
    "code": "CONNECTION_ERROR",
    "message": "Cannot connect to provider 'local-ollama': connection refused"
  }
}
```

## 相关命令

- [viben model](./model) - 模型管理
- [viben agent](./agent) - 智能体管理
- [viben config](./config) - 配置管理
