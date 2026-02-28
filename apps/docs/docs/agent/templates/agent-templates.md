---
sidebar_position: 5
title: Agent 模板开发指南
description: 创建可复用的 Agent 模板
---

# Agent 模板开发指南

Agent 模板是预配置的 Agent 定义，可以快速创建特定类型的 Agent。本文档介绍如何创建和使用 Agent 模板。

## 概述

### 什么是 Agent 模板?

Agent 模板是一组预定义的配置，包括：

- Agent 基础配置（名称、描述、类型）
- 预装的 Skills
- 预配置的 MCP Servers
- 默认的系统提示词
- 模型参数设置

使用模板可以快速创建针对特定场景优化的 Agent。

### 模板类型

| 类型 | 存储位置 | 说明 |
|------|----------|------|
| 内置模板 | `~/.viben/templates/` | Viben 提供的官方模板 |
| 用户模板 | `~/.viben/templates/` | 用户创建的自定义模板 |
| 项目模板 | `<project>/.viben/templates/` | 项目级别的模板 |

## 快速开始

### 从模板创建 Agent

```bash
# 列出可用模板
viben agent template list

# 从模板创建 Agent
viben agent create -n my-agent -f coding-assistant

# 查看模板详情
viben agent template show -n coding-assistant
```

### 从现有 Agent 创建模板

```bash
# 将现有 agent 保存为模板
viben agent template create -n my-template --clone my-agent

# 添加描述
viben agent set-template -n my-agent --description "A general coding assistant template"
```

## 模板结构

### 目录结构

```
my-template/
├── template.yaml       # 模板元数据
├── README.md           # 模板说明文档
├── agent.yaml          # Agent 默认配置
├── mcp_servers.json    # MCP 配置
├── skills/             # 预装 Skills
│   └── skill.yaml
├── prompts/            # 提示词文件
│   └── system.md
└── memory/             # 初始记忆
    └── MEMORY.md
```

### template.yaml

模板元数据配置：

```yaml
# template.yaml
name: my-template
version: 1.0.0
description: A template for specific use case
author: your-name

# 模板参数（创建时可自定义）
parameters:
  - name: agent_name
    description: Name of the agent
    required: true
  - name: model
    description: Model to use
    default: claude-3-sonnet
  - name: workdir
    description: Default working directory
    required: false

# 预装组件
includes:
  skills:
    - code-review
    - commit-helper
  mcp:
    - filesystem
    - git

# 模板标签
tags:
  - coding
  - development
  - productivity
```

### agent.yaml

Agent 默认配置：

```yaml
# agent.yaml
version: 1

# Agent 元数据（可被参数覆盖）
id: "{{ agent_name }}"
name: "{{ agent_name }}"
description: "Agent created from my-template"

# Agent 类型
type: claude-code

# 类型特定配置
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: |
    You are a helpful coding assistant.
    Follow best practices and write clean code.

# 模型配置
model: "{{ model }}"
temperature: 0.7
max_tokens: 4096

# MCP 配置
mcp:
  enabled:
    - filesystem
    - git

# Skills 配置
skills:
  enabled:
    - code-review
    - commit-helper
```

### prompts/system.md

系统提示词：

```markdown
<!-- prompts/system.md -->

# System Prompt

You are a coding assistant created from the my-template template.

## Your Capabilities

- Code review and analysis
- Bug fixing and optimization
- Documentation generation
- Git operations

## Guidelines

1. Always explain your reasoning
2. Follow coding best practices
3. Suggest improvements proactively
4. Ask for clarification when needed
```

## 创建自定义模板

### 步骤 1: 初始化模板

```bash
# 创建模板目录
viben template create my-template

# 或者从现有 agent 创建
viben agent template create -n my-template --clone my-agent
```

### 步骤 2: 配置模板

编辑 `template.yaml`：

```yaml
name: my-template
version: 1.0.0
description: My custom template

parameters:
  - name: agent_name
    required: true
  - name: project_type
    description: Type of project (web/api/cli)
    default: web

includes:
  skills:
    - code-review
```

### 步骤 3: 配置默认 Agent

编辑 `agent.yaml`：

```yaml
type: claude-code
type_config:
  plan: true
model: claude-3-sonnet
```

### 步骤 4: 添加 Skills 和 MCP

配置 `skills/` 目录和 `mcp_servers.json`。

### 步骤 5: 测试模板

```bash
# 从模板创建测试 agent
viben agent create -n test-agent -f my-template

# 验证配置
viben agent show -n test-agent
```

### 步骤 6: 发布模板

```bash
# 发布到本地模板库
viben template publish my-template

# 或分享模板配置
```

## 模板参数

模板支持参数化配置，创建 Agent 时可以自定义：

### 定义参数

```yaml
# template.yaml
parameters:
  - name: agent_name
    description: Name of the agent
    required: true

  - name: model
    description: Model to use
    default: claude-3-sonnet
    enum:
      - claude-3-opus
      - claude-3-sonnet
      - gpt-4

  - name: temperature
    description: Model temperature
    default: 0.7
    type: number
    min: 0
    max: 1
```

### 使用参数

在配置文件中使用 `{{ param_name }}` 语法：

```yaml
# agent.yaml
id: "{{ agent_name }}"
model: "{{ model }}"
temperature: {{ temperature }}
```

### 创建时指定参数

```bash
viben agent create -n my-agent -f my-template \
  --param model=gpt-4 \
  --param temperature=0.5
```

## 内置模板

### coding-assistant

通用编码助手模板：

```bash
viben agent create -n my-coder -f coding-assistant
```

特点：
- 支持多种编程语言
- 内置代码审查 skill
- 配置 filesystem 和 git MCP

### research-assistant

研究助手模板：

```bash
viben agent create -n my-researcher -f research-assistant
```

特点：
- 论文搜索和总结
- 内置学术搜索 MCP
- 引用格式化 skill

### devops-assistant

DevOps 助手模板：

```bash
viben agent create -n my-devops -f devops-assistant
```

特点：
- CI/CD 配置
- Docker 和 Kubernetes 支持
- 监控和日志分析

## CLI 命令

### viben agent template list

列出所有可用模板：

```bash
viben agent template list
viben agent template list --json
```

输出示例：

```
Agent Templates:
  coding-assistant    claude-code   "General coding assistant"
  researcher          gemini        "Research and analysis"
  code-reviewer       claude-code   "Code review specialist"
```

### viben agent template show

查看模板详情：

```bash
viben agent template show -n coding-assistant
```

### viben agent template create

从 agent 创建模板：

```bash
viben agent template create -n <template-id> --clone <agent-id>
viben agent template create -n my-template --clone my-agent
```

### viben agent template remove

删除模板：

```bash
viben agent template remove -n <template-id>
```

## 最佳实践

### 1. 模板命名

使用描述性的名称：

```
# Good
coding-assistant
research-helper
devops-automation

# Bad
template1
my-template
test
```

### 2. 版本管理

遵循语义化版本：

```yaml
version: 1.0.0  # 主版本.次版本.修订版本
```

- 主版本：不兼容的变更
- 次版本：向后兼容的功能添加
- 修订版本：向后兼容的问题修复

### 3. 文档完善

每个模板应包含完整的 README.md：

```markdown
# Template Name

## 功能描述
[模板用途和特点]

## 使用方法
```bash
viben agent create -n my-agent -f template-name
```

## 参数说明
| 参数 | 说明 | 默认值 |
|------|------|--------|
| model | 使用的模型 | claude-3-sonnet |

## 包含的 Skills
- skill-1: 描述
- skill-2: 描述

## 包含的 MCP
- mcp-1: 描述
- mcp-2: 描述

## 注意事项
[使用注意事项]
```

### 4. 参数设计

- 提供合理的默认值
- 必需参数尽量少
- 使用枚举限制选项

```yaml
parameters:
  - name: model
    default: claude-3-sonnet  # 有默认值
    enum:                     # 限制选项
      - claude-3-opus
      - claude-3-sonnet
```

### 5. 测试模板

发布前充分测试：

```bash
# 创建测试 agent
viben agent create -n test-agent -f my-template

# 验证配置
viben agent show -n test-agent

# 测试对话
viben agent chat -n test-agent -p "Hello"

# 清理
viben agent remove -n test-agent
```

## 相关文档

- [Agent 开发指南](../index.md)
- [Skill 开发指南](../skill-development.md)
- [MCP 开发指南](../mcp-development.md)
- [CLI 集成指南](../cli-integration.md)
