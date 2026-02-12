# Skill 开发指南

> 为 Agent 开发者提供的 Skill 开发指南。

---

## 概述

Skill 是 Agent 的可复用能力单元，可以在多个 Agent 之间共享。本文档介绍如何为 Viben 平台开发 Skill。

## 快速开始

### 创建 Skill

```bash
# 使用 CLI 创建 Skill
viben skill create my-skill
```

### 目录结构

```
my-skill/
├── skill.yaml          # Skill 配置
├── README.md
├── prompts/
│   └── main.md         # 主提示词
└── examples/
    └── example.md      # 使用示例
```

## Skill 配置

### skill.yaml

```yaml
name: my-skill
version: 1.0.0
description: My custom skill
author: your-name

triggers:
  - "my skill"
  - "do something"

prompts:
  - prompts/main.md

dependencies:
  - other-skill
```

## 开发流程

### 1. 编写提示词

```markdown
# prompts/main.md

You are an assistant that helps with specific tasks.

## Instructions

1. Understand the user's request
2. Process the information
3. Return formatted results
```

### 2. 安装到 Agent

```bash
viben skill install my-skill --agent my-agent
```

### 3. 测试

```bash
viben skill test my-skill
```

## 最佳实践

### 提示词设计

- 保持简洁明确
- 使用结构化格式
- 包含示例输入输出

### 版本管理

- 遵循语义化版本
- 记录变更日志
- 保持向后兼容

## 相关文档

- [Skills API](../backend/api/skills-api.md)
- [CLI Skill 命令](../cli/commands/skill.md)
