---
sidebar_position: 6
title: "智能体模板"
description: "创建和使用 Viben 智能体模板以实现可复用的配置"
---

# 智能体模板

模板是可复用的智能体配置，允许您快速创建具有预定义设置、MCP 服务器、技能和记忆结构的新智能体。

## 模板概念

### 什么是模板？

模板是创建智能体的蓝图。它包括:

- 智能体配置 (`config.yaml`)
- MCP 服务器配置
- 技能配置
- 初始记忆结构
- 启动配置 (`.agentrc`)

### 模板 vs 智能体

| 方面 | 模板 | 智能体 |
|------|------|--------|
| **用途** | 可复用的蓝图 | 活跃的实例 |
| **存储** | `~/.viben/agent-templates/` | `~/.viben/agents/` |
| **会话** | 无 | 有会话 |
| **记忆** | 仅初始结构 | 活跃记忆 |
| **使用** | 创建新智能体 | 直接交互 |

### 模板存储

模板存储在 `~/.viben/agent-templates/`:

```
~/.viben/agent-templates/
+-- coding-assistant/
|   |-- config.yaml
|   |-- mcp_servers.json
|   |-- skills/
|   |-- memory/
|   |   +-- MEMORY.md          # 初始记忆模板
|   +-- .agentrc
+-- code-reviewer/
|   |-- config.yaml
|   +-- ...
+-- researcher/
    |-- config.yaml
    +-- ...
```

## 模板命令

### 列出模板

```bash
viben agent template list
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
viben agent template list --json
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
        "path": "~/.viben/agent-templates/coding-assistant/"
      },
      {
        "id": "code-reviewer",
        "name": "代码审查专家",
        "type": "claude-code",
        "description": "专注于代码审查和最佳实践",
        "path": "~/.viben/agent-templates/code-reviewer/"
      }
    ]
  }
}
```

### 从智能体创建模板

从现有智能体创建新模板:

```bash
viben agent template create -n <template-id> --clone <agent-id>
```

**示例:**
```bash
viben agent template create -n my-template --clone my-agent
```

**输出:**
```
Created template: my-template
  From agent: my-agent
  Path: ~/.viben/agent-templates/my-template/

Included:
  - config.yaml
  - mcp_servers.json
  - skills/ (2 skills)
  - memory/MEMORY.md (initial structure)
  - .agentrc
```

### 创建模板选项

| 选项 | 说明 |
|------|------|
| `-n, --name <id>` | 模板 ID (必需) |
| `--clone <agent>` | 从现有智能体克隆 |
| `--include-memory` | 包含完整记忆内容 (默认: 仅结构) |
| `--include-history` | 包含命令历史 |
| `--description <text>` | 模板描述 |

### 查看模板详情

```bash
viben agent template show -n <template-id>
```

**示例:**
```bash
viben agent template show -n coding-assistant
```

**输出:**
```
Template: coding-assistant
Name: 通用编程助手
Type: claude-code
Description: 通用编程助手

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

Path: ~/.viben/agent-templates/coding-assistant/
```

### 删除模板

```bash
viben agent template remove -n <template-id>
```

**示例:**
```bash
viben agent template remove -n old-template
```

**输出:**
```
Are you sure you want to remove template 'old-template'? [y/N]: y
Removed template: old-template
```

## 使用模板

### 从模板创建智能体

```bash
viben agent create -n <agent-id> -f <template-id>
```

**示例:**
```bash
viben agent create -n my-coder -f coding-assistant
```

**输出:**
```
Created agent: my-coder
  From template: coding-assistant
  Path: ~/.viben/agents/my-coder/

Copied:
  - config.yaml (customized ID)
  - mcp_servers.json
  - skills/
  - memory/MEMORY.md
  - .agentrc
```

### 从模板初始化工作区

初始化工作区时，可以使用模板:

```bash
viben init --from <template-id>
```

这会基于模板创建工作区配置。

## 创建自定义模板

### 手动创建模板

1. **创建模板目录:**
   ```bash
   mkdir -p ~/.viben/agent-templates/my-template
   ```

2. **创建 config.yaml:**
   ```yaml
   # ~/.viben/agent-templates/my-template/config.yaml
   version: 1

   id: "{{AGENT_ID}}"  # 占位符，创建时替换
   name: "My Custom Agent"
   description: "自定义智能体模板"

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
   # ~/.viben/agent-templates/my-template/memory/MEMORY.md
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

Viben 包含几个内置模板:

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

```
~/.viben/agent-templates/
|-- personal/          # 个人模板
|   |-- my-coder/
|   +-- my-writer/
|-- team/              # 团队共享模板
|   |-- code-reviewer/
|   +-- qa-tester/
+-- experimental/      # 实验性模板
    +-- new-approach/
```

### 分享模板

导出模板以供分享:

```bash
viben agent template export -n coding-assistant -o ~/templates/
```

导入共享的模板:

```bash
viben agent template import ~/templates/coding-assistant.tar.gz
```

## 故障排除

### 模板未找到

```
Error: Template 'my-template' not found
```

**解决方案:** 检查模板目录是否存在:
```bash
ls ~/.viben/agent-templates/
```

### 无效的模板配置

```
Error: Template 'my-template' has invalid configuration
```

**解决方案:** 验证模板:
```bash
viben agent template validate -n my-template
```

### 变量未替换

如果 `{{AGENT_ID}}` 出现在创建的智能体中:

**解决方案:** 确保使用正确的变量语法，模板版本正确。

## 下一步

- [创建智能体](./creating-agents) - 从模板创建智能体
- [智能体配置](./agent-configuration) - 自定义智能体设置
- [记忆系统](./memory-system) - 配置记忆模板
