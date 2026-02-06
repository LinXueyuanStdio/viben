---
sidebar_position: 10
title: "viben model"
description: "管理模型、别名和回退链"
---

# viben model

管理 AI 模型、别名和回退配置。

## 用法

```bash
viben model <子命令> [选项]
```

## 子命令

| 子命令 | 描述 |
|--------|------|
| `list` | 列出可用模型 |
| `status` | 显示模型状态 |
| `set-default` | 设置默认模型 |
| `aliases` | 管理模型别名 |
| `fallbacks` | 管理回退链 |

## 命令

### 列出模型

列出可用模型：

```bash
# 列出所有模型
viben model list

# 列出特定提供商的模型
viben model list --provider anthropic-main

# JSON 输出
viben model list --json
```

**输出（人类可读）：**

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

**输出（JSON）：**

```json
{
  "success": true,
  "data": {
    "default": "claude-sonnet-4-20250514",
    "models": [
      {
        "name": "claude-opus-4-20250514",
        "provider": "anthropic-main",
        "context_window": 200000,
        "cost_input": 0.015,
        "cost_output": 0.075
      },
      {
        "name": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "context_window": 200000,
        "cost_input": 0.003,
        "cost_output": 0.015
      }
    ]
  }
}
```

### 模型状态

检查模型可用性：

```bash
# 检查所有模型
viben model status

# 检查特定模型
viben model status -n claude-sonnet-4-20250514
```

**输出（人类可读）：**

```
Model Status:
  Default: claude-sonnet-4-20250514

  claude-sonnet-4-20250514   anthropic-main   available
  gpt-4-turbo                openai-main      available
  claude-3-5-haiku-latest    anthropic-main   available
  local-llama                local-ollama     provider offline
```

**输出（JSON）：**

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
        "status": "unavailable",
        "reason": "provider offline"
      }
    ]
  }
}
```

### 设置默认模型

设置默认模型：

```bash
viben model set-default -n claude-sonnet-4-20250514
```

**输出：**

```
Set 'claude-sonnet-4-20250514' as default model
```

## 别名管理

模型别名允许您使用简短名称来引用常用模型。

### 列出别名

```bash
viben model aliases list
```

**输出（人类可读）：**

```
Model Aliases:
  fast   -> claude-3-5-haiku-latest
  smart  -> claude-sonnet-4-20250514
  best   -> claude-opus-4-20250514
  gpt    -> gpt-4-turbo
```

**输出（JSON）：**

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

### 创建别名

```bash
# 创建别名
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514
```

**输出：**

```
Created alias 'fast' -> 'claude-3-5-haiku-latest'
```

### 删除别名

```bash
viben model aliases remove -n fast
```

**输出：**

```
Removed alias 'fast'
```

## 回退管理

回退链定义了当主要模型不可用时尝试模型的顺序。

### 列出回退

```bash
viben model fallbacks list
```

**输出（人类可读）：**

```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

**输出（JSON）：**

```json
{
  "success": true,
  "data": {
    "fallbacks": [
      {
        "position": 1,
        "model": "claude-sonnet-4-20250514",
        "provider": "anthropic-main"
      },
      {
        "position": 2,
        "model": "gpt-4-turbo",
        "provider": "openai-main"
      },
      {
        "position": 3,
        "model": "claude-3-5-haiku-latest",
        "provider": "anthropic-main"
      }
    ]
  }
}
```

### 添加到回退链

```bash
# 添加模型到回退链
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest
```

**输出：**

```
Added 'claude-sonnet-4-20250514' to fallback chain (position 1)
```

### 从回退链移除

```bash
viben model fallbacks remove -n gpt-4-turbo
```

**输出：**

```
Removed 'gpt-4-turbo' from fallback chain
```

### 清空回退链

```bash
viben model fallbacks clear
```

**输出：**

```
Cleared fallback chain
```

## 模型配置文件

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514
  gpt: gpt-4-turbo
  code: claude-sonnet-4-20250514
  chat: claude-3-5-haiku-latest

fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

model_config:
  claude-sonnet-4-20250514:
    provider: anthropic-main
    max_tokens: 8192
    temperature: 0.7

  gpt-4-turbo:
    provider: openai-main
    max_tokens: 4096
    temperature: 0.7

  claude-3-5-haiku-latest:
    provider: anthropic-main
    max_tokens: 4096
    temperature: 0.8
```

## 模型能力

```yaml
# 模型能力（用于智能选择）
model_capabilities:
  claude-sonnet-4-20250514:
    context_window: 200000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.003
    cost_per_1k_output: 0.015

  gpt-4-turbo:
    context_window: 128000
    supports_vision: true
    supports_tools: true
    supports_streaming: true
    cost_per_1k_input: 0.01
    cost_per_1k_output: 0.03
```

## 错误处理

### 模型未找到

```json
{
  "success": false,
  "error": {
    "code": "MODEL_NOT_FOUND",
    "message": "Model 'unknown-model' not found"
  }
}
```

### 别名已存在

```json
{
  "success": false,
  "error": {
    "code": "ALIAS_EXISTS",
    "message": "Alias 'fast' already exists (points to 'claude-3-5-haiku-latest')"
  }
}
```

### 提供商不可用

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "Provider 'local-ollama' is not available for model 'llama3'"
  }
}
```

## 相关命令

- [viben provider](./provider) - 提供商管理
- [viben agent](./agent) - 智能体管理
- [viben config](./config) - 配置管理
