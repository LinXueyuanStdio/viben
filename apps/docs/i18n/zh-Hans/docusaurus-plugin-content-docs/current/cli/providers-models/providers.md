---
sidebar_position: 1
title: "Provider 管理"
description: "使用 Viben CLI 管理 API Provider (OpenAI, Anthropic, Google, Azure 等)"
---

# Provider 管理

Provider 是与 AI 模型 API 的连接。Viben CLI 支持多种 Provider 类型，让您可以配置和切换不同的 AI 服务。

## Provider 类型

| 类型 | 描述 | 认证方式 |
|------|------|----------|
| `anthropic` | Anthropic API (Claude) | API Key |
| `openai` | OpenAI API | API Key |
| `azure` | Azure OpenAI | API Key, Azure AD |
| `google` | Google AI (Gemini) | API Key, OAuth |
| `openrouter` | OpenRouter | API Key |
| `ollama` | Ollama (本地) | 无需认证 |
| `custom` | 自定义 OpenAI 兼容 API | API Key |

## 命令

### 列出 Provider

列出所有已配置的 Provider：

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

* = 默认 provider
```

JSON 格式输出（适用于脚本和智能体集成）：

```bash
viben provider list --json
```

### 创建 Provider

创建新的 Provider 配置：

```bash
# 完整语法
viben provider create -n <name> -t <type> --api-key <key>

# 带自定义 base URL
viben provider create -n <name> -t <type> --api-key <key> --base-url <url>

# 使用配置文件
viben provider create -n <name> -t <type> -c <config-file>

# 简写（根据类型自动生成名称）
viben provider create -t <type> --api-key <key>
```

**示例：**

```bash
# 创建 Anthropic provider
viben provider create -n anthropic-main -t anthropic --api-key "sk-ant-xxx"

# 创建 OpenAI provider（简写）
viben provider create -t openai --api-key "sk-xxx"

# 创建带 base URL 的自定义 provider
viben provider create -n deepseek -t custom \
  --api-key "sk-xxx" \
  --base-url "https://api.deepseek.com/v1"
```

### 删除 Provider

删除现有 Provider：

```bash
viben provider remove -n <name>
```

**示例：**
```bash
viben provider remove -n old-provider
```

### 设置默认 Provider

将某个 Provider 设为默认：

```bash
viben provider set-default -n <name>
```

**示例：**
```bash
viben provider set-default -n anthropic-main
```

### 检查 Provider 状态

检查 Provider 的连通性和健康状态：

```bash
# 检查所有 provider
viben provider status

# 检查特定 provider
viben provider status -n <name>
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

## 配置文件

Provider 存储在 `~/.viben/providers.yaml`：

```yaml
# ~/.viben/providers.yaml
version: 1

# 默认 provider
default: anthropic-main

providers:
  # ============================================================
  # Anthropic (Claude)
  # 环境变量: ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL
  # ============================================================
  anthropic-main:
    type: anthropic
    # 方式1: 使用环境变量 (推荐，无需在此配置)
    # 自动读取 ANTHROPIC_API_KEY

    # 方式2: 显式引用环境变量
    # ANTHROPIC_API_KEY: "env:ANTHROPIC_API_KEY"

    # 方式3: 加密存储 (通过 viben provider create 生成)
    # ANTHROPIC_API_KEY: "encrypted:xxx"

    # 可选配置
    # ANTHROPIC_BASE_URL: "https://api.anthropic.com"
    # timeout: 120000
    # max_retries: 3

  # ============================================================
  # OpenAI
  # 环境变量: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_ORG_ID
  # ============================================================
  openai-main:
    type: openai
    # 自动读取 OPENAI_API_KEY, OPENAI_BASE_URL
    # 可选配置
    # OPENAI_ORG_ID: "org-xxxxx"

  # ============================================================
  # Azure OpenAI
  # 环境变量: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT,
  #          AZURE_OPENAI_API_VERSION, AZURE_OPENAI_DEPLOYMENT
  # ============================================================
  azure-gpt4:
    type: azure
    AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
    AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
    AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"
    # AZURE_OPENAI_API_KEY 从环境变量读取

  # ============================================================
  # Google AI (Gemini)
  # 环境变量: GOOGLE_API_KEY, GOOGLE_PROJECT_ID, GOOGLE_LOCATION
  # ============================================================
  google-gemini:
    type: google
    # 自动读取 GOOGLE_API_KEY
    # 可选配置
    # GOOGLE_PROJECT_ID: "my-project"
    # GOOGLE_LOCATION: "us-central1"

  # ============================================================
  # OpenRouter
  # 环境变量: OPENROUTER_API_KEY
  # ============================================================
  openrouter:
    type: openrouter
    # 自动读取 OPENROUTER_API_KEY
    # 可选配置
    # site_url: "https://myapp.com"
    # app_name: "My App"

  # ============================================================
  # Ollama (本地模型)
  # 环境变量: OLLAMA_HOST
  # ============================================================
  local-ollama:
    type: ollama
    OLLAMA_HOST: "http://localhost:11434"
    # 无需 API Key

  # ============================================================
  # 自定义 OpenAI 兼容 API
  # 环境变量: OPENAI_API_KEY, OPENAI_BASE_URL
  # ============================================================
  custom-api:
    type: custom
    OPENAI_BASE_URL: "https://api.example.com/v1"
    # OPENAI_API_KEY 从环境变量读取
    # 可选: 自定义请求头
    # headers:
    #   X-Custom-Header: "value"
```

## 环境变量

您可以使用环境变量配置 Provider。Viben 会自动读取：

| Provider | API Key 变量 | Base URL 变量 | 其他变量 |
|----------|-------------|---------------|----------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL` | - |
| `openai` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `OPENAI_ORG_ID` |
| `azure` | `AZURE_OPENAI_API_KEY` | `AZURE_OPENAI_ENDPOINT` | `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_DEPLOYMENT` |
| `google` | `GOOGLE_API_KEY` | - | `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION` |
| `openrouter` | `OPENROUTER_API_KEY` | - | - |
| `ollama` | - | `OLLAMA_HOST` | - |
| `custom` | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | - |

**优先级顺序**（从高到低）：

1. 命令行参数（`--api-key`）
2. 配置文件中的显式值
3. Provider 特定环境变量（如 `ANTHROPIC_API_KEY`）
4. 通用环境变量（如 `OPENAI_API_KEY` 用于 custom 类型）

## 使用环境变量快速配置

最简单的配置方式 - 只需设置环境变量：

```bash
# 设置环境变量
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 创建 provider（自动使用环境变量）
viben provider create -t anthropic
viben provider create -t openai

# 或显式指定（会加密存储）
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

## Provider 类型详情

### Anthropic

用于 Claude 模型：

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

环境变量：
- `ANTHROPIC_API_KEY`（必需）
- `ANTHROPIC_BASE_URL`（可选）

### OpenAI

用于 GPT 模型：

```bash
viben provider create -t openai --api-key "sk-xxx"
```

环境变量：
- `OPENAI_API_KEY`（必需）
- `OPENAI_BASE_URL`（可选）
- `OPENAI_ORG_ID`（可选）

### Azure OpenAI

用于 Azure 托管的 OpenAI 模型：

```bash
viben provider create -n azure-gpt4 -t azure \
  --api-key "xxx" \
  --base-url "https://my-resource.openai.azure.com"
```

配置文件允许额外设置：

```yaml
azure-gpt4:
  type: azure
  AZURE_OPENAI_ENDPOINT: "https://my-resource.openai.azure.com"
  AZURE_OPENAI_API_VERSION: "2024-02-15-preview"
  AZURE_OPENAI_DEPLOYMENT: "gpt-4-turbo"
```

### Google AI (Gemini)

用于 Gemini 模型：

```bash
viben provider create -t google --api-key "xxx"
```

环境变量：
- `GOOGLE_API_KEY`（必需）
- `GOOGLE_PROJECT_ID`（可选）
- `GOOGLE_LOCATION`（可选）

### OpenRouter

用于通过 OpenRouter 访问多种模型：

```bash
viben provider create -t openrouter --api-key "xxx"
```

环境变量：
- `OPENROUTER_API_KEY`（必需）

### Ollama (本地)

用于本地运行的 Ollama：

```bash
viben provider create -n local-ollama -t ollama
```

无需 API Key。如需配置主机：

```yaml
local-ollama:
  type: ollama
  OLLAMA_HOST: "http://localhost:11434"
```

### Custom (OpenAI 兼容)

用于任何 OpenAI 兼容的 API：

```bash
viben provider create -n deepseek -t custom \
  --api-key "xxx" \
  --base-url "https://api.deepseek.com/v1"
```

常见的自定义 Provider：

| Provider | Base URL | API Key 变量 |
|----------|----------|--------------|
| DeepSeek | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` |
| Groq | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` |
| Together AI | `https://api.together.xyz/v1` | `TOGETHER_API_KEY` |
| Fireworks AI | `https://api.fireworks.ai/inference/v1` | `FIREWORKS_API_KEY` |

**常见 Provider 的配置示例：**

```yaml
# DeepSeek
deepseek:
  type: custom
  OPENAI_BASE_URL: "https://api.deepseek.com/v1"
  # 使用 DEEPSEEK_API_KEY 或 OPENAI_API_KEY

# Groq
groq:
  type: custom
  OPENAI_BASE_URL: "https://api.groq.com/openai/v1"
  # 使用 GROQ_API_KEY 或 OPENAI_API_KEY

# Together AI
together:
  type: custom
  OPENAI_BASE_URL: "https://api.together.xyz/v1"
  # 使用 TOGETHER_API_KEY 或 OPENAI_API_KEY

# Fireworks AI
fireworks:
  type: custom
  OPENAI_BASE_URL: "https://api.fireworks.ai/inference/v1"
  # 使用 FIREWORKS_API_KEY 或 OPENAI_API_KEY
```

## 安全性

API Key 在配置文件中存储时会被加密。加密格式如下：

```yaml
api_key: "encrypted:sk-ant-xxx"
```

:::tip 最佳实践
使用环境变量存储 API Key，而不是保存在配置文件中。这更安全，符合 12-factor app 方法论。
:::

## JSON 输出

所有命令都支持 `--json` 标志以获取结构化输出：

```bash
viben provider list --json
```

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
      }
    ]
  }
}
```

错误响应遵循标准格式：

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_FOUND",
    "message": "Provider 'unknown-provider' not found"
  }
}
```

## 下一步

- [模型管理](./models) - 为您的 Provider 配置模型
- [模型别名](./aliases) - 创建便捷的模型名称快捷方式
- [模型回退](./fallbacks) - 设置自动回退链
