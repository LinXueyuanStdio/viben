---
sidebar_position: 4
title: "模型配置"
description: "在 Viben CLI 中配置模型、别名和回退链"
---

# 模型配置

模型配置定义 Viben 如何选择和使用 AI 模型。你可以设置便捷的别名、配置回退链以提高可靠性，以及自定义模型参数。

## 配置文件

模型配置存储在 `~/.viben/models.yaml` 中：

```yaml
# ~/.viben/models.yaml
version: 1

# 默认使用的模型
default: claude-sonnet-4-20250514

# 模型别名，便于快速访问
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514

# 可靠性回退链
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

# 每个模型的配置
model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

# 模型能力（用于智能选择）
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
```

## 模型别名

别名为常用模型提供简短、易记的名称。

### 内置别名建议

| 别名 | 模型 | 用途 |
|------|------|------|
| `fast` | `claude-3-5-haiku-latest` | 快速响应，简单任务 |
| `quick` | `gpt-4o-mini` | 低成本，快速操作 |
| `smart` | `claude-sonnet-4-20250514` | 平衡智能 |
| `balanced` | `gpt-4o` | 通用目的 |
| `best` | `claude-opus-4-20250514` | 最强能力 |
| `powerful` | `gpt-4-turbo` | 复杂推理 |
| `code` | `claude-sonnet-4-20250514` | 编码任务 |
| `chat` | `claude-3-5-haiku-latest` | 对话聊天 |
| `reasoning` | `o1-preview` | 深度推理 |

### Provider 特定别名

| 别名 | 模型 |
|------|------|
| `gpt` | `gpt-4-turbo` |
| `claude` | `claude-sonnet-4-20250514` |
| `gemini` | `gemini-1.5-pro` |

### 别名配置

```yaml
aliases:
  # 速度优化
  fast: claude-3-5-haiku-latest
  quick: gpt-4o-mini

  # 智能优化
  smart: claude-sonnet-4-20250514
  balanced: gpt-4o

  # 最强能力
  best: claude-opus-4-20250514
  powerful: gpt-4-turbo

  # 特定任务
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest
  reasoning: o1-preview
```

### 别名命令

```bash
# 列出所有别名
viben model aliases list

# 创建别名
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514

# 移除别名
viben model aliases remove -n fast
```

**`viben model aliases list` 的输出：**

```
Model Aliases:
  fast   → claude-3-5-haiku-latest
  smart  → claude-sonnet-4-20250514
  best   → claude-opus-4-20250514
  gpt    → gpt-4-turbo
```

## 回退链

回退链通过在主模型不可用时尝试替代模型来确保可靠性。

### 回退工作原理

1. Viben 尝试链中的第一个模型
2. 如果不可用（API 错误、速率限制等），尝试下一个
3. 继续直到某个模型成功或全部失败

### 回退配置

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # 首选
  - gpt-4-turbo                    # 第一备选
  - claude-3-5-haiku-latest        # 第二备选
  - gpt-4o-mini                    # 最后手段
```

### 回退命令

```bash
# 列出回退链
viben model fallbacks list

# 添加模型到回退链
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest

# 从回退链移除
viben model fallbacks remove -n gpt-4-turbo

# 清空整个回退链
viben model fallbacks clear
```

**`viben model fallbacks list` 的输出：**

```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

## 模型特定配置

为单个模型配置自定义参数：

```yaml
model_config:
  # Claude Sonnet 4
  claude-sonnet-4-20250514:
    provider: anthropic-main        # 使用哪个 provider
    max_tokens: 8192                # 最大输出 token 数
    temperature: 0.7                # 响应随机性（0-1）
    # 可选参数：
    # top_p: 0.9
    # top_k: 40
    # stop_sequences: ["\n\nHuman:"]

  # Claude Opus 4
  claude-opus-4-20250514:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.5                # 更确定性

  # Claude Haiku
  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8

  # GPT-4 Turbo
  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o
  gpt-4o:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  # GPT-4o Mini
  gpt-4o-mini:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.8

  # Azure GPT-4
  azure-gpt-4:
    provider: azure-gpt4            # 使用 Azure provider
    max_tokens: 4096
    temperature: 0.7

  # Gemini 1.5 Pro
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

定义模型能力以实现智能模型选择：

```yaml
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000          # 最大输入 token 数
    supports_vision: true           # 图像理解
    supports_tools: true            # 函数调用
    supports_streaming: true        # 流式响应
    cost_per_1k_input: 0.003        # 每 1K 输入 token 的美元成本
    cost_per_1k_output: 0.015       # 每 1K 输出 token 的美元成本

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

## 模型命令

### 列出可用模型

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

* = default model
```

### 按 Provider 过滤

```bash
viben model list --provider anthropic-main
```

### 检查模型状态

```bash
viben model status
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

```bash
viben model set-default -n claude-sonnet-4-20250514
```

## JSON 输出

所有模型命令都支持 `--json`：

```bash
viben model list --json
```

**输出：**

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
        "cost_input": 0.003,
        "cost_output": 0.015
      },
      {
        "name": "gpt-4-turbo",
        "provider": "openai-main",
        "context_window": 128000,
        "cost_input": 0.01,
        "cost_output": 0.03
      }
    ]
  }
}
```

```bash
viben model aliases list --json
```

**输出：**

```json
{
  "success": true,
  "data": {
    "aliases": {
      "fast": "claude-3-5-haiku-latest",
      "smart": "claude-sonnet-4-20250514",
      "best": "claude-opus-4-20250514",
      "gpt": "gpt-4-turbo"
    }
  }
}
```

## 快速设置示例

### 成本优化设置

```yaml
default: gpt-4o-mini

aliases:
  default: gpt-4o-mini
  upgrade: claude-sonnet-4-20250514

fallbacks:
  - gpt-4o-mini
  - claude-3-5-haiku-latest
```

### 质量优化设置

```yaml
default: claude-opus-4-20250514

aliases:
  default: claude-opus-4-20250514
  fast: claude-sonnet-4-20250514

fallbacks:
  - claude-opus-4-20250514
  - claude-sonnet-4-20250514
  - gpt-4-turbo
```

### 多 Provider 弹性

```yaml
default: claude-sonnet-4-20250514

fallbacks:
  - claude-sonnet-4-20250514    # Anthropic 主选
  - gpt-4-turbo                  # OpenAI 备选
  - gemini-1.5-pro              # Google 备选
  - llama3                       # 本地后备
```

### 本地优先开发

```yaml
default: llama3

aliases:
  local: llama3
  cloud: claude-sonnet-4-20250514

fallbacks:
  - llama3
  - claude-3-5-haiku-latest
```

## 故障排除

### 模型不可用

```bash
# 检查模型状态
viben model status -n claude-sonnet-4-20250514

# 验证 provider 是否已连接
viben provider status -n anthropic-main
```

### 回退不工作

```bash
# 检查回退链
viben model fallbacks list

# 验证链中所有 provider 是否已配置
viben provider status
```

### 别名未解析

```bash
# 列出所有别名
viben model aliases list

# 检查别名是否存在
viben model aliases list --json | jq '.data.aliases.fast'
```

## 下一步

- [Provider 配置](./providers.md) - 配置 API Provider
- [Config 命令](./config-command.md) - 通用配置管理
