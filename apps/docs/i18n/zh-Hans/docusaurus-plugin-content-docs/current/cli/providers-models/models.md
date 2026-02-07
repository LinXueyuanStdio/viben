---
sidebar_position: 2
title: "模型管理"
description: "使用 Viben CLI 管理 AI 模型、查看可用性、配置模型设置"
---

# 模型管理

模型是您与之交互的 AI 服务。每个模型都与一个 Provider 关联，可以有自定义的配置设置。

## 命令

### 列出模型

列出所有已配置 Provider 中可用的模型：

```bash
viben model list
```

**输出：**
```
Available Models:
  Provider: anthropic-main
    claude-opus-4-20250514        200K context   $15/$75
    claude-sonnet-4-20250514*     200K context   $3/$15
    claude-3-5-haiku-latest       200K context   $0.25/$1.25

  Provider: openai-main
    gpt-4-turbo                   128K context   $10/$30
    gpt-4o                        128K context   $2.5/$10
    gpt-4o-mini                   128K context   $0.15/$0.6

* = 默认模型
```

按 Provider 筛选：

```bash
viben model list --provider anthropic-main
```

JSON 格式输出：

```bash
viben model list --json
```

### 检查模型状态

查看已配置模型的可用状态：

```bash
# 检查所有模型
viben model status

# 检查特定模型
viben model status -n claude-sonnet-4-20250514
```

**输出：**
```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   ✓ available
  gpt-4-turbo                openai-main      ✓ available
  claude-3-5-haiku-latest    anthropic-main   ✓ available
  local-llama                local-ollama     ✗ provider offline
```

### 设置默认模型

设置一个模型为所有操作的默认值：

```bash
viben model set-default -n <model>
```

**示例：**
```bash
viben model set-default -n claude-sonnet-4-20250514
```

## 配置文件

模型配置在 `~/.viben/models.yaml`：

```yaml
# ~/.viben/models.yaml
version: 1

# 默认模型
default: claude-sonnet-4-20250514

# ============================================================
# 模型别名
# 使用短名称引用常用模型
# ============================================================
aliases:
  # 速度优先
  fast: claude-3-5-haiku-latest
  quick: gpt-4o-mini

  # 质量优先
  smart: claude-sonnet-4-20250514
  balanced: gpt-4o

  # 最强能力
  best: claude-opus-4-20250514
  powerful: gpt-4-turbo

  # 特定用途
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  reasoning: o1-preview

  # Provider 特定
  gpt: gpt-4-turbo
  claude: claude-sonnet-4-20250514
  gemini: gemini-1.5-pro

# ============================================================
# 回退链
# 当主要模型不可用时按顺序尝试
# ============================================================
fallbacks:
  - claude-sonnet-4-20250514      # 首选
  - gpt-4-turbo                    # 第一备选
  - claude-3-5-haiku-latest        # 第二备选
  - gpt-4o-mini                    # 最后备选

# ============================================================
# 模型特定配置
# 覆盖每个模型的默认参数
# ============================================================
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7
```

## 模型配置

每个模型可以有自定义设置来覆盖默认值：

```yaml
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main        # 使用哪个 provider
    max_tokens: 8192                # 最大输出 tokens
    temperature: 0.7                # 温度（0.0-1.0）
    # 可选参数
    # top_p: 0.9
    # top_k: 40
    # stop_sequences: ["\n\nHuman:"]

  claude-opus-4-20250514:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.5                # 更低的温度以获得更确定的输出

  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  gpt-4o:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  gpt-4o-mini:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.8

  # Azure 托管的模型
  azure-gpt-4:
    provider: azure-gpt4            # 使用 Azure provider
    max_tokens: 4096
    temperature: 0.7

  # Google Gemini 模型
  gemini-1.5-pro:
    provider: google-gemini
    max_tokens: 8192
    temperature: 0.7

  # 本地 Ollama 模型
  llama3:
    provider: local-ollama
    max_tokens: 4096
    temperature: 0.8

  # DeepSeek
  deepseek-chat:
    provider: deepseek
    max_tokens: 4096
    temperature: 0.7

  # Groq (LLaMA)
  llama-3.1-70b-versatile:
    provider: groq
    max_tokens: 4096
    temperature: 0.7
```

## 模型能力

您可以为智能模型选择定义模型能力：

```yaml
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.003
    cost_per_1k_output: 0.015

  claude-opus-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.015
    cost_per_1k_output: 0.075

  gpt-4-turbo:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.01
    cost_per_1k_output: 0.03

  gpt-4o-mini:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.00015
    cost_per_1k_output: 0.0006
```

这些能力可以被智能体用于根据任务需求智能选择模型。

## 常用模型参考

### Anthropic 模型

| 模型 | 上下文 | 输入成本 | 输出成本 | 说明 |
|------|--------|----------|----------|------|
| `claude-opus-4-20250514` | 200K | $15/1M | $75/1M | 最强能力 |
| `claude-sonnet-4-20250514` | 200K | $3/1M | $15/1M | 均衡 |
| `claude-3-5-haiku-latest` | 200K | $0.25/1M | $1.25/1M | 最快 |

### OpenAI 模型

| 模型 | 上下文 | 输入成本 | 输出成本 | 说明 |
|------|--------|----------|----------|------|
| `gpt-4-turbo` | 128K | $10/1M | $30/1M | 最强能力 |
| `gpt-4o` | 128K | $2.5/1M | $10/1M | 均衡 |
| `gpt-4o-mini` | 128K | $0.15/1M | $0.6/1M | 最快 |
| `o1-preview` | 128K | $15/1M | $60/1M | 推理 |

### Google 模型

| 模型 | 上下文 | 输入成本 | 输出成本 | 说明 |
|------|--------|----------|----------|------|
| `gemini-1.5-pro` | 2M | $1.25/1M | $5/1M | 大上下文 |
| `gemini-1.5-flash` | 1M | $0.075/1M | $0.3/1M | 快速 |

### 本地模型 (Ollama)

| 模型 | 上下文 | 成本 | 说明 |
|------|--------|------|------|
| `llama3` | 8K | 免费 | 开源 |
| `llama3.1` | 128K | 免费 | 扩展上下文 |
| `mistral` | 32K | 免费 | 快速 |
| `codellama` | 16K | 免费 | 代码专用 |

## 使用别名访问模型

不必记住完整的模型名称，可以使用[别名](./aliases)：

```bash
# 不用这样：
viben model set-default -n claude-sonnet-4-20250514

# 使用别名：
viben model set-default -n smart
```

常见的别名约定：

| 别名 | 典型模型 | 使用场景 |
|------|----------|----------|
| `fast` | claude-3-5-haiku-latest | 快速响应 |
| `smart` | claude-sonnet-4-20250514 | 均衡质量 |
| `best` | claude-opus-4-20250514 | 最高质量 |
| `code` | claude-sonnet-4-20250514 | 编程任务 |
| `chat` | claude-3-5-haiku-latest | 日常对话 |

## 智能体集成

可以为每个智能体配置模型：

```bash
# 为特定智能体设置模型
viben agent config -n my-agent set model claude-sonnet-4-20250514

# 或使用别名
viben agent config -n my-agent set model smart
```

## JSON 输出

所有命令都支持 `--json` 标志：

```bash
viben model list --json
```

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "name": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "context_window": 200000,
        "status": "available"
      },
      {
        "name": "gpt-4-turbo",
        "provider": "openai-main",
        "context_window": 128000,
        "status": "available"
      }
    ]
  }
}
```

```bash
viben model status --json
```

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "name": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "status": "available"
      },
      {
        "name": "local-llama",
        "provider": "local-ollama",
        "status": "offline",
        "error": "Provider not running"
      }
    ]
  }
}
```

## 下一步

- [模型别名](./aliases) - 创建便捷的模型名称快捷方式
- [模型回退](./fallbacks) - 设置自动回退链
- [Provider 管理](./providers) - 为您的模型配置 Provider
