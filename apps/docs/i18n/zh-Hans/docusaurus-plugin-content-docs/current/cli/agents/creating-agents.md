---
sidebar_position: 2
title: "创建智能体"
description: "使用 CLI 创建、克隆和管理 Viben 智能体"
---

# 创建智能体

本指南介绍如何使用 Viben CLI 创建、克隆和管理智能体。

## 创建新智能体

### 基本创建

使用唯一 ID 创建新智能体:

```bash
viben agent create -n <agent-id>
```

**示例:**
```bash
viben agent create -n my-coding-assistant
```

**输出:**
```
Created agent: my-coding-assistant
  Path: ~/.viben/agents/my-coding-assistant/
  Type: claude-code (default)

Next steps:
  viben agent config -n my-coding-assistant set model <model>
  viben agent show -n my-coding-assistant
```

### 从模板创建

从预定义模板创建智能体:

```bash
viben agent create -n <agent-id> -f <template-id>
```

**示例:**
```bash
viben agent create -n my-reviewer -f code-reviewer
```

这会复制模板中的所有配置，包括:
- 智能体配置 (`config.yaml`)
- MCP 服务器配置
- 技能配置
- 初始记忆结构

### 从配置文件创建

从 YAML 配置文件创建智能体:

```bash
viben agent create -n <agent-id> -f /path/to/config.yaml
```

**示例:**
```bash
viben agent create -n custom-agent -f ~/configs/my-agent-config.yaml
```

### 克隆现有智能体

克隆现有智能体以创建新智能体:

```bash
viben agent create -n <new-agent-id> --clone <existing-agent-id>
```

**示例:**
```bash
viben agent create -n my-agent-v2 --clone my-agent
```

这会创建完整副本，包括:
- 所有配置文件
- 记忆文件 (MEMORY.md 和每日日志)
- 技能
- 会话历史 (可选，使用 `--with-sessions`)

:::note
默认情况下不会克隆会话。使用 `--with-sessions` 来包含会话:
```bash
viben agent create -n my-agent-v2 --clone my-agent --with-sessions
```
:::

## 列出智能体

### 列出所有智能体

```bash
viben agent list
```

**输出:**
```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = 当前智能体
```

### JSON 输出

```bash
viben agent list --json
```

**输出:**
```json
{
  "success": true,
  "data": {
    "current": "main",
    "agents": [
      {
        "id": "main",
        "name": "Main Agent",
        "type": "claude-code",
        "path": "~/.viben/agents/main/",
        "session_count": 3,
        "memory_size": "5.6 KB"
      },
      {
        "id": "my-agent",
        "name": "My Coding Assistant",
        "type": "claude-code",
        "path": "~/.viben/agents/my-agent/",
        "session_count": 1,
        "memory_size": "3.4 KB"
      }
    ]
  }
}
```

## 查看智能体详情

### 显示智能体信息

```bash
viben agent show -n <agent-id>
```

**示例:**
```bash
viben agent show -n my-agent
```

**输出:**
```
Agent: my-agent
Name: My Coding Assistant
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/

Memory:
  MEMORY.md     2.3 KB    last modified 2h ago
  2024-01-16.md 1.1 KB    today
  2024-01-15.md 3.2 KB    yesterday

Sessions (1):
  main   "Feature development"   2h ago   42 messages

MCP: filesystem, git (2 enabled)
Skills: code-review, commit (2 enabled)
```

### 检查智能体状态

```bash
viben agent status
viben agent status -n <agent-id>
```

**输出:**
```
Agent Status:
  main*         active    last used 5m ago
  my-agent      idle      last used 2h ago
  research-bot  inactive  last used 3d ago

* = 当前智能体
```

## 设置默认智能体

设置未指定 `-n` 时使用的默认智能体:

```bash
viben agent set-default -n <agent-id>
```

**示例:**
```bash
viben agent set-default -n my-agent
```

**输出:**
```
Default agent set to: my-agent
```

您也可以使用 `VIBEN_AGENT` 环境变量:

```bash
export VIBEN_AGENT=my-agent
```

## 删除智能体

### 标准删除

```bash
viben agent remove -n <agent-id>
```

**示例:**
```bash
viben agent remove -n old-agent
```

**输出:**
```
Are you sure you want to remove agent 'old-agent'? [y/N]: y
Removed agent: old-agent
```

### 强制删除

跳过确认提示:

```bash
viben agent remove -n <agent-id> --force
```

**示例:**
```bash
viben agent remove -n old-agent --force
```

:::warning
强制删除不会请求确认。请谨慎使用，因为这会永久删除所有智能体数据，包括记忆和会话。
:::

## 智能体创建选项

| 选项 | 说明 | 示例 |
|------|------|------|
| `-n, --name <id>` | 智能体 ID (必需) | `-n my-agent` |
| `-f, --from <source>` | 模板 ID 或配置文件 | `-f coding-assistant` |
| `--clone <id>` | 从现有智能体克隆 | `--clone my-agent` |
| `--with-sessions` | 克隆时包含会话 | `--with-sessions` |
| `--type <type>` | 智能体类型 | `--type claude-code` |
| `--json` | 以 JSON 格式输出 | `--json` |

## 最佳实践

### 命名规范

- 使用小写字母、数字和连字符
- 保持名称描述性但简洁
- 示例: `code-reviewer`, `research-assistant`, `main-v2`

### 何时创建 vs 克隆

| 场景 | 建议 |
|------|------|
| 全新开始 | 创建新智能体 |
| 保留记忆 | 克隆现有智能体 |
| 测试配置 | 使用 `--with-sessions` 克隆 |
| 生产备份 | 定期克隆 |

### 组织建议

1. **使用模板**进行常见配置
2. **按用途命名智能体** (如 `code-reviewer`, `doc-writer`)
3. **保留一个主要智能体**用于日常工作
4. **归档旧智能体**而不是删除

## 故障排除

### 智能体已存在

```
Error: Agent 'my-agent' already exists
```

**解决方案:** 选择不同的名称或先删除现有智能体。

### 模板未找到

```
Error: Template 'unknown-template' not found
```

**解决方案:** 使用 `viben agent template list` 列出可用模板。

### 无效的智能体 ID

```
Error: Invalid agent ID 'my agent'
```

**解决方案:** 只使用小写字母、数字和连字符。不允许空格。

## 下一步

- [智能体配置](./agent-configuration) - 配置您的智能体
- [记忆系统](./memory-system) - 设置智能体记忆
- [模板](./templates) - 创建和使用模板
