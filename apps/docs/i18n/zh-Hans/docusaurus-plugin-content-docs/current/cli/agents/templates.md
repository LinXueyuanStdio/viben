---
sidebar_position: 6
title: "智能体模板"
description: "创建和使用微本智能体模板以实现可复用的配置"
---

# 智能体模板

模板是可复用的智能体配置，允许您快速创建具有预定义设置、MCP 服务器、技能和记忆结构的新智能体。

## 模板概念

### 什么是模板？

模板是带有 `isTemplate: true` 标记的普通智能体，用作创建新智能体的蓝图。它包括:

- 智能体配置 (`config.yaml`，带 `isTemplate: true`)
- MCP 服务器配置
- 技能配置
- 初始记忆结构
- 启动配置 (`.agentrc`)

### 模板 vs 智能体

| 方面 | 模板 | 智能体 |
|------|------|--------|
| **用途** | 可复用的蓝图 | 活跃的实例 |
| **存储** | `~/.viben/agents/` (带 `isTemplate: true`) | `~/.viben/agents/` |
| **会话** | 无 | 有会话 |
| **记忆** | 仅初始结构 | 活跃记忆 |
| **使用** | 创建新智能体 | 直接交互 |

### 模板存储

模板与普通智能体存储在相同的目录 `~/.viben/agents/`，通过配置文件中的 `isTemplate: true` 标记区分:

```
~/.viben/agents/
+-- coding-assistant/            # 模板 (isTemplate: true)
|   |-- config.yaml
|   |-- mcp_servers.json
|   |-- skills/
|   |-- memory/
|   |   +-- MEMORY.md            # 初始记忆模板
|   +-- .agentrc
+-- code-reviewer/               # 模板 (isTemplate: true)
|   |-- config.yaml
|   +-- ...
+-- my-agent/                    # 普通智能体 (isTemplate: false 或未设置)
    |-- config.yaml
    +-- ...
```

## 模板命令

### 列出模板

```bash
viben agent list --templates
```

**输出:**
```
Agent Templates:
  coding-assistant    claude-code   "通用编程助手"
  code-reviewer       claude-code   "代码审查专家"
  researcher          gemini        "研究与分析"
  doc-writer          claude-code   "文档编写者"
```

### JSON 输出

```bash
viben agent list --templates --json
```

**输出:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "coding-assistant",
        "name": "通用编程助手",
        "type": "claude-code",
        "description": "通用编程助手",
        "isTemplate": true,
        "path": "~/.viben/agents/coding-assistant/"
      },
      {
        "id": "code-reviewer",
        "name": "代码审查专家",
        "type": "claude-code",
        "description": "专注于代码审查和最佳实践",
        "isTemplate": true,
        "path": "~/.viben/agents/code-reviewer/"
      }
    ]
  }
}
```

### 将智能体标记为模板

将现有智能体标记为模板:

```bash
viben agent update <agent-id> --is-template true
```

**示例:**
```bash
viben agent update my-agent --is-template true
```

**输出:**
```
Updated agent: my-agent
  isTemplate: true
  Path: ~/.viben/agents/my-agent/
```

### 取消模板标记

将模板转换回普通智能体:

```bash
viben agent update <template-id> --is-template false
```

### 查看模板详情

```bash
viben agent show <template-id>
```

**示例:**
```bash
viben agent show coding-assistant
```

**输出:**
```
Agent: coding-assistant
Name: 通用编程助手
Type: claude-code
Description: 通用编程助手
Is Template: true

Configuration:
  type_config:
    plan: true
    dangerously_skip_permissions: false

MCP Servers:
  - filesystem
  - git

Skills:
  - code-review
  - commit

Memory Structure:
  - MEMORY.md (带章节的模板)

Path: ~/.viben/agents/coding-assistant/
```

### 删除模板

```bash
viben agent remove <template-id>
```

**示例:**
```bash
viben agent remove old-template
```

**输出:**
```
Are you sure you want to remove agent 'old-template'? [y/N]: y
Removed agent: old-template
```

## 使用模板

### 从模板创建智能体

```bash
viben agent create <agent-id> --from-template <template-id>
```

**示例:**
```bash
viben agent create my-coder --from-template coding-assistant
```

**输出:**
```
Created agent: my-coder
  From template: coding-assistant
  Path: ~/.viben/agents/my-coder/

Copied:
  - config.yaml (customized ID, isTemplate: false)
  - mcp_servers.json
  - skills/
  - memory/MEMORY.md
  - .agentrc
```

### 从模板初始化工作区

初始化工作区时，可以使用模板:

```bash
viben init --from-template <template-id>
```

这会基于模板创建工作区配置。

## 创建自定义模板

### 方法一：从现有智能体创建模板

最简单的方式是先创建并配置好一个智能体，然后将其标记为模板:

```bash
# 1. 创建并配置智能体
viben agent create my-template
viben agent config my-template set type claude-code
# ... 其他配置

# 2. 将智能体标记为模板
viben agent update my-template --is-template true
```

### 方法二：手动创建模板

1. **创建智能体目录:**
   ```bash
   mkdir -p ~/.viben/agents/my-template
   ```

2. **创建 config.yaml (注意 isTemplate: true):**
   ```yaml
   # ~/.viben/agents/my-template/config.yaml
   version: 1

   id: "{{AGENT_ID}}"  # 占位符，创建时替换
   name: "My Custom Agent"
   description: "自定义智能体模板"
   isTemplate: true    # 标记为模板

   type: claude-code

   type_config:
     plan: true
     append_prompt: |
       你是一个专门用于...的助手

   mcp:
     enabled:
       - filesystem
       - git

   skills:
     enabled:
       - code-review
   ```

3. **创建记忆模板:**
   ```markdown
   # ~/.viben/agents/my-template/memory/MEMORY.md
   # 智能体记忆

   ## 用户偏好
   <!-- 在此添加用户偏好 -->

   ## 项目上下文
   <!-- 在此添加项目上下文 -->

   ## 重要备注
   <!-- 在此添加重要备注 -->
   ```

4. **创建 MCP 配置:**
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@anthropic-ai/mcp-server-filesystem"]
       }
     }
   }
   ```

### 模板变量

模板支持在创建智能体时替换的变量:

| 变量 | 替换为 |
|------|--------|
| `{{AGENT_ID}}` | 新智能体 ID |
| `{{AGENT_NAME}}` | 智能体名称 |
| `{{CREATED_DATE}}` | 创建时间戳 |
| `{{USER_HOME}}` | 用户主目录 |

## 内置模板

微本包含几个内置模板:

### coding-assistant

通用编程助手:
- MCP: filesystem, git
- Skills: code-review, commit
- Type: claude-code

### code-reviewer

专业代码审查智能体:
- MCP: filesystem, git
- Skills: code-review, security-audit
- Type: claude-code
- 针对审查的自定义提示

### researcher

研究与分析智能体:
- MCP: browser, filesystem
- Skills: summarize, cite
- Type: gemini
- 针对研究任务优化

### doc-writer

文档专家:
- MCP: filesystem
- Skills: documentation, markdown
- Type: claude-code
- 专注于文档质量

## 模板最佳实践

### 设计原则

1. **单一用途**: 每个模板应有明确的用途
2. **最小配置**: 只包含必要的设置
3. **良好默认值**: 提供合理的默认值
4. **清晰文档**: 包含描述和注释

### 模板组织

由于模板与智能体存储在同一目录，建议使用命名约定来组织:

```
~/.viben/agents/
|-- tpl-personal-coder/        # 个人模板 (isTemplate: true)
|-- tpl-personal-writer/       # 个人模板 (isTemplate: true)
|-- tpl-team-reviewer/         # 团队共享模板 (isTemplate: true)
|-- tpl-team-qa/               # 团队共享模板 (isTemplate: true)
|-- my-agent/                  # 普通智能体
+-- research-bot/              # 普通智能体
```

或者使用描述性的前缀/后缀来区分模板和普通智能体。

### 分享模板

导出模板以供分享:

```bash
viben agent export coding-assistant -o ~/templates/
```

导入共享的模板:

```bash
viben agent import ~/templates/coding-assistant.tar.gz
```

导入后，如果是模板，确保 `isTemplate: true` 已设置在 config.yaml 中。

## 故障排除

### 模板未找到

```
Error: Template 'my-template' not found
```

**解决方案:** 检查模板是否存在并已标记为模板:
```bash
# 列出所有模板
viben agent list --templates

# 检查智能体是否存在
viben agent show my-template
```

如果智能体存在但未出现在模板列表中，需要标记为模板:
```bash
viben agent update my-template --is-template true
```

### 无效的模板配置

```
Error: Template 'my-template' has invalid configuration
```

**解决方案:** 验证智能体配置:
```bash
viben agent show my-template
```

### 变量未替换

如果 `{{AGENT_ID}}` 出现在创建的智能体中:

**解决方案:** 确保使用正确的变量语法，模板版本正确。

## 下一步

- [创建智能体](./creating-agents) - 从模板创建智能体
- [智能体配置](./agent-configuration) - 自定义智能体设置
- [记忆系统](./memory-system) - 配置记忆模板
