---
sidebar_position: 3
title: Skill 开发指南
description: 为 Agent 开发可复用的 Skill
---

# Skill 开发指南

Skill 是 Agent 的可复用能力单元，可以在多个 Agent 之间共享。本文档介绍如何为 Viben 平台开发和管理 Skill。

## 概述

### 什么是 Skill?

Skill 是一组预定义的提示词和配置，用于增强 Agent 在特定任务上的能力。例如：

- `code-review`: 代码审查技能
- `commit`: Git 提交消息生成技能
- `test-runner`: 测试执行技能
- `paper-search`: 论文搜索技能

### Skill 类型

| 类型 | 存储位置 | 作用域 |
|------|----------|--------|
| 全局 Skill | `~/.viben/skills/` | 所有 Agent 可用 |
| Agent Skill | `~/.viben/agents/<id>/skills/` | 仅特定 Agent 可用 |
| Claude Skill | `~/.claude/commands/` | Claude Code 专用 |

## 快速开始

### 1. 安装 Skill

```bash
# 全局安装
viben skill install code-review

# 安装到指定 agent
viben skill install code-review --agent my-agent

# 安装指定版本
viben skill install code-review@1.0.0

# 安装到 Claude skills 目录
viben skill install code-review --claude
```

### 2. 列出已安装的 Skills

```bash
# 列出所有已安装的 skills
viben skill list

# 列出特定 agent 的 skills
viben skill list --agent my-agent

# 仅列出全局 skills
viben skill list --global

# 仅列出 Claude skills
viben skill list --claude
```

### 3. 查看 Skill 详情

```bash
viben skill show code-review
```

输出示例：

```
Skill: Code Review

  ID:           code-review
  Name:         Code Review
  Version:      1.0.0
  Description:  Code review assistance
  Path:         /path/to/skills/code-review
  Source:       local
```

## 创建自定义 Skill

### 目录结构

```
my-skill/
├── skill.yaml          # Skill 配置文件
├── README.md           # 使用说明
├── prompts/
│   ├── main.md         # 主提示词
│   └── examples.md     # 示例提示词
└── examples/
    └── usage.md        # 使用示例
```

### Skill 配置文件

```yaml
# skill.yaml
name: my-skill
version: 1.0.0
description: My custom skill for specific tasks
author: your-name

# 触发词 - 用户说这些词时激活此 skill
triggers:
  - "my skill"
  - "do something"
  - "/myskill"

# 提示词文件
prompts:
  - prompts/main.md
  - prompts/examples.md

# 依赖的其他 skills
dependencies:
  - other-skill

# 所需的 MCP servers
requires_mcp:
  - filesystem
  - git

# 标签
tags:
  - productivity
  - coding
```

### 主提示词文件

```markdown
<!-- prompts/main.md -->

# My Skill

You are an assistant specialized in [specific task].

## Instructions

1. Understand the user's request
2. Process the information according to these rules:
   - Rule 1
   - Rule 2
   - Rule 3
3. Return formatted results

## Output Format

Always respond with:
- Summary
- Details
- Next steps

## Examples

### Example 1

Input: [example input]
Output: [example output]
```

### 初始化 Skill 项目

```bash
# 创建新 skill
viben skill create my-skill

# 这会生成基础目录结构
```

## Skill CLI 命令

### 安装 Skill

```bash
# 基础安装 (全局)
viben skill install <name>

# 安装指定版本
viben skill install <name>@<version>
viben skill install <name>@latest

# 安装到指定 agent
viben skill install <name> --agent <agent-id>

# 全局安装 (默认)
viben skill install <name> --global

# 安装到 Claude skills 目录 (.claude/commands/)
viben skill install <name> --claude

# 安装到自定义路径
viben skill install <name> --path /custom/path

# 从本地路径安装
viben skill install <name> --source /local/skill/path

# 强制重新安装
viben skill install <name> --force
```

### 卸载 Skill

```bash
# 从全局卸载 (默认)
viben skill uninstall <name>

# 从 agent 卸载
viben skill uninstall <name> --agent <agent-id>

# 从 Claude skills 目录卸载
viben skill uninstall <name> --claude
```

### 启用/禁用 Skill

```bash
# 为 agent 启用 skill
viben skill enable <name> --agent <agent-id>

# 为 agent 禁用 skill
viben skill disable <name> --agent <agent-id>

# 列出 agent 已启用的 skills
viben skill enabled --agent <agent-id>
```

### 获取 Skill 路径

```bash
# 获取全局 skill 路径
viben skill path <name>

# 获取 agent skill 路径
viben skill path <name> --agent <agent-id>

# 获取 Claude skill 路径
viben skill path <name> --claude
```

## Skill 开发最佳实践

### 1. 提示词设计

**保持简洁明确**

```markdown
<!-- Good -->
You are a code reviewer. Review the provided code for:
- Bugs and errors
- Performance issues
- Code style

<!-- Bad -->
You are an expert code reviewer with years of experience...
[过长的描述]
```

**使用结构化格式**

```markdown
## Task
[明确的任务描述]

## Input
[输入格式说明]

## Output
[输出格式要求]

## Examples
[具体示例]
```

**包含示例**

```markdown
## Example

Input:
```python
def add(a, b):
    return a + b
```

Output:
- No bugs found
- Consider adding type hints
- Function is well-named
```

### 2. 版本管理

遵循语义化版本：

```yaml
# 主版本号：不兼容的 API 变更
# 次版本号：向下兼容的功能新增
# 修订号：向下兼容的问题修正
version: 1.2.3
```

### 3. 文档规范

每个 Skill 应包含 README.md：

```markdown
# Skill Name

## 功能描述
[描述 skill 的功能]

## 安装
```bash
viben skill install my-skill
```

## 使用方法
[使用说明和示例]

## 配置选项
[可配置项说明]

## 限制
[已知限制和注意事项]
```

### 4. 依赖管理

明确声明依赖：

```yaml
# skill.yaml
dependencies:
  - base-skill@^1.0.0

requires_mcp:
  - filesystem
  - git
```

## Claude Code Skills

### 安装到 Claude Code

```bash
# 安装到 Claude Code 的 commands 目录
viben skill install my-skill --claude
```

这会将 skill 安装到 `~/.claude/commands/` 目录，使其可以作为 Claude Code 的自定义命令使用。

### Claude Code 命令格式

```markdown
<!-- ~/.claude/commands/my-skill.md -->

# My Skill

This is a custom command for Claude Code.

## Usage

Use this command by typing `/my-skill` in the chat.

## Instructions

[Instructions for Claude Code]
```

## 示例 Skills

### Code Review Skill

```yaml
# skill.yaml
name: code-review
version: 1.0.0
description: Automated code review assistance

triggers:
  - "review code"
  - "code review"
  - "/review"

prompts:
  - prompts/review.md
```

```markdown
<!-- prompts/review.md -->

# Code Review

You are a code reviewer. When reviewing code:

1. **Check for bugs**: Look for logic errors, edge cases, null checks
2. **Performance**: Identify inefficient algorithms or unnecessary operations
3. **Security**: Check for vulnerabilities (SQL injection, XSS, etc.)
4. **Style**: Ensure consistent naming, formatting, and documentation
5. **Best practices**: Suggest improvements based on language idioms

## Output Format

```
## Summary
[Overall assessment]

## Issues Found
- [Critical] Issue description
- [Warning] Issue description
- [Suggestion] Improvement suggestion

## Recommendations
1. Recommendation 1
2. Recommendation 2
```
```

### Commit Message Skill

```yaml
# skill.yaml
name: commit-helper
version: 1.0.0
description: Generate meaningful commit messages

triggers:
  - "commit"
  - "generate commit"
  - "/commit"

prompts:
  - prompts/commit.md
```

```markdown
<!-- prompts/commit.md -->

# Commit Message Generator

Generate a commit message following conventional commits:

## Format

```
type(scope): subject

body

footer
```

## Types
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code refactoring
- test: Tests
- chore: Maintenance

## Guidelines
- Subject line max 50 characters
- Body max 72 characters per line
- Reference issues in footer
```

## 相关文档

- [Agent 开发指南](./index.md)
- [MCP 开发指南](./mcp-development.md)
- [CLI 集成指南](./cli-integration.md)
- [最佳实践](./best-practices.md)
