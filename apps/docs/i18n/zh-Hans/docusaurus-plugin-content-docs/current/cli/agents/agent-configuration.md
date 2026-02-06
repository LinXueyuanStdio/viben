---
sidebar_position: 3
title: "智能体配置"
description: "配置 Viben 智能体 - config.yaml、MCP 服务器、技能和 RC 文件"
---

# 智能体配置

本指南涵盖智能体配置的所有方面，包括主配置文件、MCP 服务器、技能和启动配置。

## 配置文件概述

每个智能体有多个配置文件:

| 文件 | 用途 |
|------|------|
| `config.yaml` | 主智能体配置 |
| `mcp_servers.json` | MCP 服务器配置 |
| `.agentrc` | 启动配置 (环境变量、默认值) |
| `skills/` | 智能体专属技能目录 |

## 主配置 (config.yaml)

### 文件位置

```
~/.viben/agents/<agent-id>/config.yaml
```

### 结构

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

# 智能体元数据
id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

# 智能体类型 (决定运行时行为)
type: claude-code  # claude-code | cursor | gemini | codex | ...

# 类型特定配置
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: "You are a helpful coding assistant."

# MCP 配置 (也可以在 mcp_servers.json 中)
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# 技能配置
skills:
  enabled:
    - code-review
    - commit
```

### 配置字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | number | 配置版本 (始终为 `1`) |
| `id` | string | 智能体 ID (必须与目录名匹配) |
| `name` | string | 人类可读的智能体名称 |
| `description` | string | 智能体描述 |
| `created` | string | 创建时间戳 (ISO 8601) |
| `type` | string | 智能体类型 (见支持的类型) |
| `type_config` | object | 类型特定配置 |
| `mcp` | object | MCP 服务器配置 |
| `skills` | object | 技能配置 |

### 类型特定配置

每种智能体类型都有自己的配置选项:

**Claude Code (`claude-code`):**
```yaml
type_config:
  plan: true                          # 启用规划模式
  dangerously_skip_permissions: false # 跳过权限检查
  append_prompt: "Custom instructions" # 额外系统提示
```

**Cursor (`cursor`):**
```yaml
type_config:
  composer: true      # 启用 composer 模式
  rules_file: ".cursorrules"
```

**Gemini (`gemini`):**
```yaml
type_config:
  safety_settings: default
  generation_config:
    temperature: 0.7
    max_output_tokens: 8192
```

## 通过 CLI 配置

### 查看配置

```bash
viben agent config -n <agent-id>
```

**示例:**
```bash
viben agent config -n my-agent
```

**输出:**
```yaml
version: 1
id: my-agent
name: "My Coding Assistant"
type: claude-code
type_config:
  plan: true
mcp:
  enabled:
    - filesystem
    - git
skills:
  enabled:
    - code-review
```

### 设置配置值

```bash
viben agent config -n <agent-id> set <key> <value>
```

**示例:**
```bash
# 设置模型
viben agent config -n my-agent set model gpt-4

# 启用规划
viben agent config -n my-agent set plan true

# 设置智能体名称
viben agent config -n my-agent set name "My Custom Agent"

# 配置 MCP 服务器 (JSON 数组)
viben agent config -n my-agent set mcp.enabled '["filesystem","git"]'

# 使用点符号设置嵌套值
viben agent config -n my-agent set type_config.temperature 0.8
```

### 获取特定值

```bash
viben agent config -n <agent-id> get <key>
```

**示例:**
```bash
viben agent config -n my-agent get type_config.plan
```

**输出:**
```
true
```

## MCP 服务器配置

### 文件位置

```
~/.viben/agents/<agent-id>/mcp_servers.json
```

### 结构

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem"],
      "env": {
        "ROOT": "/path/to/workspace"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    },
    "custom-mcp": {
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### MCP 服务器条目字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | string | 要运行的命令 (如 `npx`, `python`) |
| `args` | array | 命令参数 |
| `env` | object | 服务器的环境变量 |

### 通过 CLI 管理 MCP

```bash
# 启用 MCP 服务器
viben mcp enable filesystem -n my-agent

# 禁用 MCP 服务器
viben mcp disable browser -n my-agent

# 列出智能体的 MCP 服务器
viben mcp list -n my-agent

# 配置 MCP 服务器
viben mcp config filesystem set root /path/to/dir -n my-agent
```

## 技能配置

技能在智能体的 `config.yaml` 中配置，存储在 `skills/` 目录:

### 目录结构

```
~/.viben/agents/<agent-id>/skills/
|-- code-review/
|   |-- config.yaml
|   +-- prompts/
+-- commit/
    |-- config.yaml
    +-- templates/
```

### config.yaml 中的技能

```yaml
skills:
  enabled:
    - code-review
    - commit
    - test-runner
  disabled:
    - documentation
```

### 通过 CLI 管理技能

```bash
# 为智能体安装技能
viben skill install code-review -n my-agent

# 列出智能体的技能
viben skill list -n my-agent

# 启用/禁用技能
viben skill enable code-review -n my-agent
viben skill disable documentation -n my-agent
```

## 智能体 RC 文件 (.agentrc)

`.agentrc` 文件包含智能体启动时运行的配置。

### 文件位置

```
~/.viben/agents/<agent-id>/.agentrc
```

### 结构

```bash
# ~/.viben/agents/my-agent/.agentrc
# 智能体启动配置

# 环境变量
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# 默认会话
DEFAULT_SESSION="main"

# 记忆配置
MEMORY_FILES="MEMORY.md"
DAILY_LOG_DAYS=2  # 读取今天+昨天

# 自定义设置
CUSTOM_VAR="custom-value"
```

### RC 文件变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEFAULT_SESSION` | 使用的默认会话 | `main` |
| `MEMORY_FILES` | 要加载的记忆文件 | `MEMORY.md` |
| `DAILY_LOG_DAYS` | 要读取的每日日志数量 | `2` |

## 配置优先级

配置按以下顺序合并 (后者覆盖前者):

1. **智能体基础配置** (`~/.viben/agents/<id>/config.yaml`)
2. **工作区配置** (`<project>/.viben/config.yaml`)
3. **智能体类型工作区配置** (`<project>/.claude/`, `.cursor/` 等)
4. **环境变量**
5. **命令行参数**

### 示例

```bash
# 智能体配置设置模型为 claude-sonnet-4
# 工作区配置设置模型为 gpt-4
# 命令行覆盖为 gpt-4-turbo

viben agent run -n my-agent --model gpt-4-turbo
# 结果: 使用 gpt-4-turbo
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VIBEN_STATE_DIR` | 状态目录 | `~/.viben` |
| `VIBEN_AGENT` | 当前智能体 ID | `main` |
| `VIBEN_CONFIG_PATH` | 配置文件路径 | `~/.viben/config.yaml` |
| `VIBEN_SCOPE` | 配置作用域 | 自动检测 |

## 最佳实践

### 安全性

1. **永远不要提交 API 密钥**到版本控制
2. 使用环境变量存储敏感值
3. 使用 `encrypted:` 前缀存储加密凭据

### 组织

1. 保持配置最小化 - 尽可能使用默认值
2. 用注释记录自定义设置
3. 使用模板进行常见配置

### 调试

```bash
# 查看应用所有合并后的有效配置
viben agent config -n my-agent --effective

# 显示配置来源
viben agent config -n my-agent --show-origin
```

## 下一步

- [记忆系统](./memory-system) - 配置智能体记忆
- [会话](./sessions) - 管理智能体会话
- [模板](./templates) - 创建配置模板
