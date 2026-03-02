---
sidebar_position: 3
title: "Provider 配置"
description: "为 Viben CLI 配置 API Provider - Anthropic、OpenAI、Azure、Google 等"
---

# Provider 配置

Provider 将 Viben 连接到 AI 服务，如 Anthropic、OpenAI、Google 等。本页介绍如何配置和管理 Provider。

## 概述

Provider 配置存储在 `~/.viben/providers.yaml` 中。Viben 支持多种认证方式：

1. **环境变量**（推荐）- 配置文件中不存储密钥
2. **环境变量引用** - 使用 `env:VAR_NAME` 语法
3. **加密存储** - 使用 `encrypted:xxx` 存储加密的密钥

## Provider 类型

| 类型 | 说明 | 认证方式 |
|------|------|----------|
| `anthropic` | Anthropic Claude API | API Key |
| `openai` | OpenAI API | API Key |
| `azure` | Azure OpenAI | API Key、Azure AD |
| `google` | Google AI (Gemini) | API Key、OAuth |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama（本地） | 无需认证 |
| `custom` | OpenAI 兼容 API | API Key |

## 配置文件

### 基本结构

```yaml
# ~/.viben/providers.yaml
version: 1

# 默认使用的 provider
default: anthropic-main

providers:
  anthropic-main:
    type: anthropic
    # 配置选项...

  openai-main:
    type: openai
    # 配置选项...
```

### API Key 配置方式

#### 方式 1：环境变量（推荐）

在 shell 中设置环境变量：

```bash
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"
```

然后创建自动读取它们的 provider：

```yaml
providers:
  anthropic-main:
    type: anthropic
    # 自动读取 ANTHROPIC_API_KEY

  openai-main:
    type: openai
    # 自动读取 OPENAI_API_KEY
```

#### 方式 2：环境变量引用

在配置中显式引用环境变量：

```yaml
providers:
  anthropic-main:
    type: anthropic
    ANTHROPIC_API_KEY: "env:ANTHROPIC_API_KEY"
```

#### 方式 3：加密存储

使用 CLI 创建带加密密钥的 provider：

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

这会将密钥加密存储：

```yaml
providers:
  anthropic-main:
    type: anthropic
    ANTHROPIC_API_KEY: "encrypted:xxx"
```

## Provider 特定配置

### Anthropic

```yaml
anthropic-main:
  type: anthropic
  # 环境变量：ANTHROPIC_API_KEY、ANTHROPIC_BASE_URL

  # 可选配置
  # ANTHROPIC_BASE_URL: "https://api.anthropic.com"
  # timeout: 120000
  # max_retries: 3
```

| 环境变量 | 说明 | 必需 |
|----------|------|------|
| `ANTHROPIC_API_KEY` | 来自 Anthropic 控制台的 API key | 是 |
| `ANTHROPIC_BASE_URL` | 自定义 API 端点 | 否 |

### OpenAI

```yaml
openai-main:
  type: openai
  # 环境变量：OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_ORG_ID

  # 可选配置
  # OPENAI_ORG_ID: "org-xxxxx"
```

| 环境变量 | 说明 | 必需 |
|----------|------|------|
| `OPENAI_API_KEY` | 来自 OpenAI 的 API key | 是 |
| `OPENAI_BASE_URL` | 自定义 API 端点 | 否 |
| `OPENAI_ORG_ID` | 组织 ID | 否 |

### Azure OpenAI

```yaml
azure-gpt4:
  type: azure
  AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
  AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
  AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"
  # AZURE_OPENAI_API_KEY 从环境变量读取
```

| 环境变量 | 说明 | 必需 |
|----------|------|------|
| `AZURE_OPENAI_API_KEY` | Azure API key | 是 |
| `AZURE_OPENAI_ENDPOINT` | Azure 资源端点 | 是 |
| `AZURE_OPENAI_API_VERSION` | API 版本 | 是 |
| `AZURE_OPENAI_DEPLOYMENT` | 部署名称 | 是 |

### Google AI (Gemini)

```yaml
google-gemini:
  type: google
  # 环境变量：GOOGLE_API_KEY、GOOGLE_PROJECT_ID、GOOGLE_LOCATION

  # 可选配置
  # GOOGLE_PROJECT_ID: "my-project"
  # GOOGLE_LOCATION: "us-central1"
```

| 环境变量 | 说明 | 必需 |
|----------|------|------|
| `GOOGLE_API_KEY` | Google AI API key | 是 |
| `GOOGLE_PROJECT_ID` | GCP 项目 ID | 否 |
| `GOOGLE_LOCATION` | 区域位置 | 否 |

### OpenRouter

```yaml
openrouter:
  type: openrouter
  # 环境变量：OPENROUTER_API_KEY

  # 可选配置
  # site_url: "https://myapp.com"
  # app_name: "My App"
```

| 环境变量 | 说明 | 必需 |
|----------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API key | 是 |

### Ollama（本地）

```yaml
local-ollama:
  type: ollama
  OLLAMA_HOST: "http://localhost:11434"
  # 无需 API Key
```

| 环境变量 | 说明 | 必需 |
|----------|------|------|
| `OLLAMA_HOST` | Ollama 服务器 URL | 否（默认：`http://localhost:11434`） |

### 自定义 OpenAI 兼容 API

适用于实现 OpenAI API 格式的服务：

```yaml
custom-api:
  type: custom
  OPENAI_BASE_URL: "https://api.example.com/v1"
  # OPENAI_API_KEY 从环境变量读取

  # 可选：自定义请求头
  # headers:
  #   X-Custom-Header: "value"
```

### 常用自定义 Provider

#### DeepSeek

```yaml
deepseek:
  type: custom
  OPENAI_BASE_URL: "https://api.deepseek.com/v1"
  # 使用 DEEPSEEK_API_KEY 或 OPENAI_API_KEY
```

#### Groq

```yaml
groq:
  type: custom
  OPENAI_BASE_URL: "https://api.groq.com/openai/v1"
  # 使用 GROQ_API_KEY 或 OPENAI_API_KEY
```

#### Together AI

```yaml
together:
  type: custom
  OPENAI_BASE_URL: "https://api.together.xyz/v1"
  # 使用 TOGETHER_API_KEY 或 OPENAI_API_KEY
```

#### Fireworks AI

```yaml
fireworks:
  type: custom
  OPENAI_BASE_URL: "https://api.fireworks.ai/inference/v1"
  # 使用 FIREWORKS_API_KEY 或 OPENAI_API_KEY
```

## 环境变量优先级

解析 API key 时，Viben 按以下顺序检查：

1. **命令行参数**（`--api-key`）
2. **配置文件中的显式值**
3. **Provider 特定环境变量**（如 `ANTHROPIC_API_KEY`）
4. **通用环境变量**（如 custom 类型的 `OPENAI_API_KEY`）

## Provider 命令

### 列出 Provider

```bash
viben provider list
```

**输出：**

```
Providers:
  anthropic-main*   anthropic   ✓ connected
  openai-main       openai      ✓ connected
  azure-gpt4        azure       ✓ connected
  local-ollama      ollama      ○ not running
  custom-api        custom      ✓ connected

* = default provider
```

### 创建 Provider

```bash
# 使用环境变量（推荐）
viben provider create -t anthropic
viben provider create -t openai

# 使用显式 API key（会被加密）
viben provider create -t anthropic --api-key "sk-ant-xxx"

# 自定义名称
viben provider create -n my-claude -t anthropic --api-key "sk-ant-xxx"

# 自定义 API 及 base URL
viben provider create -t custom --api-key "xxx" --base-url "https://api.example.com/v1"
```

### 移除 Provider

```bash
viben provider remove -n <name>
```

### 设置默认 Provider

```bash
viben provider set-default -n anthropic-main
```

### 检查 Provider 状态

```bash
viben provider status
```

**输出：**

```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
  openai-main      openai      ✓ connected   latency: 85ms
  azure-gpt4       azure       ✓ connected   latency: 150ms
  local-ollama     ollama      ✗ error       connection refused
  custom-api       custom      ✓ connected   latency: 200ms
```

## 快速设置示例

### 最小化设置（仅 Anthropic）

```bash
# 设置环境变量
export ANTHROPIC_API_KEY="sk-ant-xxx"

# 创建 provider
viben provider create -t anthropic
```

### 多 Provider 设置

```bash
# 设置所有 API key
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"
export GOOGLE_API_KEY="xxx"

# 创建 provider
viben provider create -t anthropic
viben provider create -t openai
viben provider create -t google

# 设置默认
viben provider set-default -n anthropic-main
```

### 本地开发（Ollama）

```bash
# 启动 Ollama 服务器
ollama serve

# 创建 provider（无需 API key）
viben provider create -t ollama

# 设置为本地测试的默认
viben provider set-default -n local-ollama
```

## JSON 输出

所有 provider 命令都支持 `--json` 进行结构化输出：

```bash
viben provider list --json
```

**输出：**

```json
{
  "success": true,
  "data": {
    "default": "anthropic-main",
    "providers": [
      {
        "name": "anthropic-main",
        "type": "anthropic",
        "status": "connected",
        "latency_ms": 120
      },
      {
        "name": "openai-main",
        "type": "openai",
        "status": "connected",
        "latency_ms": 85
      }
    ]
  }
}
```

## 故障排除

### 连接错误

```bash
# 检查 provider 状态
viben provider status -n anthropic-main

# 验证 API key 是否设置
echo $ANTHROPIC_API_KEY

# 使用详细输出测试
viben provider status -n anthropic-main --verbose
```

### 无效的 API Key

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The API key for provider 'anthropic-main' is invalid"
  }
}
```

### Provider 未找到

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'unknown' not found in configuration"
  }
}
```

## 下一步

- [模型配置](./models.md) - 配置模型、别名和回退链
- [Config 命令](./config-command.md) - 通用配置管理
