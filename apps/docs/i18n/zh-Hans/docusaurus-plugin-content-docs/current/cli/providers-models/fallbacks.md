---
sidebar_position: 4
title: "模型回退"
description: "配置当主要模型不可用时的自动回退链"
---

# 模型回退

回退链定义了当主要模型不可用时要尝试的模型顺序。这确保了即使某个 Provider 出现故障，您的工作流程也能继续运行。

## 概念

回退链是一个有序的模型列表：

```
1. claude-sonnet-4-20250514    (主要)
2. gpt-4-turbo                 (第一备选)
3. claude-3-5-haiku-latest     (第二备选)
4. gpt-4o-mini                 (最后备选)
```

当您请求一个模型时，微本会按顺序尝试每个，直到成功为止。

## 命令

### 列出回退链

查看当前的回退链：

```bash
viben model fallbacks list
```

**输出：**
```
Fallback Chain:
  1. claude-sonnet-4-20250514   (anthropic-main)
  2. gpt-4-turbo                (openai-main)
  3. claude-3-5-haiku-latest    (anthropic-main)
```

JSON 格式输出：

```bash
viben model fallbacks list --json
```

### 添加到回退链

将模型添加到回退链末尾：

```bash
viben model fallbacks create -n <model>
```

**示例：**

```bash
# 逐步构建回退链
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest
viben model fallbacks create -n gpt-4o-mini
```

### 从回退链移除

从回退链中移除模型：

```bash
viben model fallbacks remove -n <model>
```

**示例：**
```bash
viben model fallbacks remove -n gpt-4o-mini
```

### 清空回退链

移除回退链中的所有模型：

```bash
viben model fallbacks clear
```

## 配置文件

回退链存储在 `~/.viben/models.yaml`：

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

fallbacks:
  - claude-sonnet-4-20250514      # 首选
  - gpt-4-turbo                    # 第一备选
  - claude-3-5-haiku-latest        # 第二备选
  - gpt-4o-mini                    # 最后备选
```

## 回退策略

### 跨 Provider 回退

包含来自不同 Provider 的模型以确保韧性：

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Anthropic（主要）
  - gpt-4-turbo                    # OpenAI（备选）
  - gemini-1.5-pro                 # Google（第二备选）
```

这可以防止特定 Provider 的故障影响。

### 本地回退

将本地模型作为最后备选：

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # 云端（主要）
  - gpt-4-turbo                    # 云端（备选）
  - llama3                         # 本地 Ollama（最后备选）
```

这确保即使没有网络连接也能运行。

### 成本优化回退

按成本排列，从便宜的模型开始：

```yaml
fallbacks:
  - gpt-4o-mini                    # 最便宜
  - claude-3-5-haiku-latest        # 便宜
  - gpt-4o                         # 中等
  - claude-sonnet-4-20250514      # 较高质量
  - claude-opus-4-20250514        # 最高质量（最后备选）
```

### 质量优化回退

按质量排列，从最好的开始：

```yaml
fallbacks:
  - claude-opus-4-20250514        # 最高质量
  - claude-sonnet-4-20250514      # 高质量
  - gpt-4-turbo                    # 良好质量
  - claude-3-5-haiku-latest        # 更快但质量较低
  - gpt-4o-mini                    # 快速但基础
```

## 回退工作原理

当发出请求时：

1. 微本尝试链中的第一个模型
2. 如果失败（超时、速率限制、Provider 错误），转到下一个
3. 继续直到模型成功或链耗尽
4. 如果所有模型都失败，返回错误

```
请求
   |
   v
claude-sonnet-4-20250514 --> 失败（速率限制）
   |
   v
gpt-4-turbo --> 失败（超时）
   |
   v
claude-3-5-haiku-latest --> 成功
   |
   v
响应
```

## 与别名结合使用

回退链可以使用别名而不是完整的模型名称：

```yaml
aliases:
  smart: claude-sonnet-4-20250514
  gpt: gpt-4-turbo
  fast: claude-3-5-haiku-latest

fallbacks:
  - smart  # 解析为 claude-sonnet-4-20250514
  - gpt    # 解析为 gpt-4-turbo
  - fast   # 解析为 claude-3-5-haiku-latest
```

这使配置更易读、更易维护。

## 最佳实践

### 混合 Provider

在回退链中至少包含两个不同的 Provider：

```yaml
# 好 - 多个 provider
fallbacks:
  - claude-sonnet-4-20250514      # Anthropic
  - gpt-4-turbo                    # OpenAI
  - gemini-1.5-pro                 # Google

# 不够健壮 - 单个 provider
fallbacks:
  - claude-opus-4-20250514
  - claude-sonnet-4-20250514
  - claude-3-5-haiku-latest
```

### 包含快速选项

始终包含一个快速/便宜的模型作为最后备选：

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # 质量优先
  - gpt-4-turbo                    # 备选
  - gpt-4o-mini                    # 快速备选
```

### 保持链的合理长度

3-5 个模型的链通常就足够了：

```yaml
# 好 - 精简链
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest

# 可能过多 - 太多备选
fallbacks:
  - model1
  - model2
  - model3
  - model4
  - model5
  - model6
  - model7
```

### 测试您的链

定期测试回退链中的所有模型是否配置正确：

```bash
viben model status
```

## 推荐的回退链

### 通用

```yaml
fallbacks:
  - claude-sonnet-4-20250514
  - gpt-4-turbo
  - claude-3-5-haiku-latest
```

### 高可用性

```yaml
fallbacks:
  - claude-sonnet-4-20250514      # Anthropic
  - gpt-4o                         # OpenAI
  - gemini-1.5-pro                 # Google
  - llama3                         # 本地（无需网络）
```

### 成本敏感

```yaml
fallbacks:
  - gpt-4o-mini
  - claude-3-5-haiku-latest
  - gpt-4o
  - claude-sonnet-4-20250514
```

### 开发环境

```yaml
fallbacks:
  - llama3                         # 本地优先（免费、快速）
  - claude-3-5-haiku-latest        # 云端备选（便宜）
  - gpt-4o-mini                    # 替代（便宜）
```

## JSON 输出

```bash
viben model fallbacks list --json
```

```json
{
  "success": true,
  "data": {
    "fallbacks": [
      {
        "order": 1,
        "model": "claude-sonnet-4-20250514",
        "provider": "anthropic-main",
        "status": "available"
      },
      {
        "order": 2,
        "model": "gpt-4-turbo",
        "provider": "openai-main",
        "status": "available"
      },
      {
        "order": 3,
        "model": "claude-3-5-haiku-latest",
        "provider": "anthropic-main",
        "status": "available"
      }
    ]
  }
}
```

## 相关内容

- [模型别名](./aliases) - 创建便捷的模型名称快捷方式
- [模型管理](./models) - 配置模型设置
- [Provider 管理](./providers) - 为您的模型配置 Provider
