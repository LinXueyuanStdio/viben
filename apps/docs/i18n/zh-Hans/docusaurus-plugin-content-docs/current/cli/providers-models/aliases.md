---
sidebar_position: 3
title: "模型别名"
description: "使用微本 CLI 为模型名称创建便捷的快捷方式"
---

# 模型别名

别名让您可以用简短、易记的名称来引用模型，而不是完整的模型标识符如 `claude-sonnet-4-20250514`。

## 概念

别名是一个映射到完整模型名称的短名称：

```
fast   ->  claude-3-5-haiku-latest
smart  ->  claude-sonnet-4-20250514
best   ->  claude-opus-4-20250514
```

这意味着您可以在任何需要使用 `claude-3-5-haiku-latest` 的地方使用 `fast`。

## 命令

### 列出别名

查看所有已配置的别名：

```bash
viben model aliases list
```

**输出：**
```
Model Aliases:
  fast   -> claude-3-5-haiku-latest
  smart  -> claude-sonnet-4-20250514
  best   -> claude-opus-4-20250514
  gpt    -> gpt-4-turbo
```

JSON 格式输出：

```bash
viben model aliases list --json
```

### 创建别名

创建新的别名：

```bash
viben model aliases create -n <alias> -f <model>
```

**示例：**

```bash
# 创建速度优先的别名
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n quick -f gpt-4o-mini

# 创建质量优先的别名
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514

# 创建特定用途的别名
viben model aliases create -n code -f claude-sonnet-4-20250514
viben model aliases create -n chat -f claude-3-5-haiku-latest
viben model aliases create -n reasoning -f o1-preview

# 创建 Provider 特定的别名
viben model aliases create -n gpt -f gpt-4-turbo
viben model aliases create -n claude -f claude-sonnet-4-20250514
viben model aliases create -n gemini -f gemini-1.5-pro
```

### 删除别名

删除现有别名：

```bash
viben model aliases remove -n <alias>
```

**示例：**
```bash
viben model aliases remove -n old-alias
```

## 配置文件

别名存储在 `~/.viben/models.yaml`：

```yaml
# ~/.viben/models.yaml
version: 1

default: claude-sonnet-4-20250514

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
```

## 推荐的别名分类

### 按性能

| 别名 | 描述 | 示例模型 |
|------|------|----------|
| `fast` | 最快响应时间 | claude-3-5-haiku-latest |
| `quick` | 快速响应 | gpt-4o-mini |
| `balanced` | 均衡速度/质量 | gpt-4o |
| `smart` | 高质量 | claude-sonnet-4-20250514 |
| `best` | 最高质量 | claude-opus-4-20250514 |
| `powerful` | 最强能力 | gpt-4-turbo |

### 按用途

| 别名 | 描述 | 示例模型 |
|------|------|----------|
| `code` | 代码生成/审查 | claude-sonnet-4-20250514 |
| `chat` | 日常对话 | claude-3-5-haiku-latest |
| `reasoning` | 复杂推理 | o1-preview |
| `analysis` | 数据分析 | claude-opus-4-20250514 |
| `creative` | 创意写作 | claude-opus-4-20250514 |

### 按 Provider

| 别名 | 描述 | 示例模型 |
|------|------|----------|
| `claude` | 默认 Claude 模型 | claude-sonnet-4-20250514 |
| `gpt` | 默认 GPT 模型 | gpt-4-turbo |
| `gemini` | 默认 Gemini 模型 | gemini-1.5-pro |
| `local` | 本地 Ollama 模型 | llama3 |

## 使用别名

配置后，在任何指定模型的地方都可以使用别名：

```bash
# 使用别名设置默认模型
viben model set-default -n fast

# 在智能体配置中使用
viben agent config -n my-agent set model smart
```

## 更新别名

要将别名更新为指向不同的模型，只需重新创建：

```bash
# 将 'fast' 更新为指向不同的模型
viben model aliases create -n fast -f gpt-4o-mini
```

这将覆盖现有的别名。

## 最佳实践

### 使用语义化名称

选择描述用途的别名名称，而不是特定模型：

```bash
# 好 - 语义化命名
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n best -f claude-opus-4-20250514

# 不太理想 - 模型特定命名
viben model aliases create -n haiku -f claude-3-5-haiku-latest
viben model aliases create -n opus -f claude-opus-4-20250514
```

语义化名称允许您在不改变工作流程的情况下更换底层模型。

### 团队内统一

如果在团队中工作，约定一套标准的别名：

```yaml
aliases:
  # 团队标准
  fast: claude-3-5-haiku-latest    # 用于快速操作
  default: claude-sonnet-4-20250514 # 大多数任务的默认值
  premium: claude-opus-4-20250514   # 当质量最重要时
```

### 保持别名精简

过多的别名会造成混乱。保持一小组常用的：

```yaml
# 好 - 精简集合
aliases:
  fast: claude-3-5-haiku-latest
  smart: claude-sonnet-4-20250514
  best: claude-opus-4-20250514

# 不太理想 - 别名太多
aliases:
  fast: ...
  quick: ...
  speedy: ...
  rapid: ...
  # 等等
```

## JSON 输出

```bash
viben model aliases list --json
```

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

## 下一步

- [模型回退](./fallbacks) - 设置自动回退链
- [模型管理](./models) - 配置模型设置
- [Provider 管理](./providers) - 为您的模型配置 Provider
