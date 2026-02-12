# Agent 模板开发指南

> 创建可复用的 Agent 模板。

---

## 概述

Agent 模板是预配置的 Agent 定义，可以快速创建特定类型的 Agent。

## 模板结构

```
my-template/
├── template.yaml       # 模板配置
├── README.md
├── agent.yaml          # Agent 默认配置
├── skills/             # 预装 Skill
│   └── default.yaml
└── mcp/                # 预装 MCP
    └── default.yaml
```

## 模板配置

### template.yaml

```yaml
name: my-template
version: 1.0.0
description: A template for specific use case
author: your-name

# 模板参数
parameters:
  - name: agent_name
    description: Name of the agent
    required: true
  - name: model
    description: Model to use
    default: gpt-4

# 预装组件
includes:
  skills:
    - research-skill
    - summarize-skill
  mcp:
    - browse-mcp
```

## 使用模板

```bash
# 从模板创建 Agent
viben agent create my-agent --template my-template

# 列出可用模板
viben agent templates
```

## 创建自定义模板

### 1. 初始化模板

```bash
viben template create my-template
```

### 2. 配置模板

编辑 `template.yaml` 和 `agent.yaml`。

### 3. 发布模板

```bash
viben template publish my-template
```

## 相关文档

- [创建 Agent](../../cli/agents/creating-agents.md)
- [Agent 配置](../../cli/agents/agent-configuration.md)
