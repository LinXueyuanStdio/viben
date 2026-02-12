# Agent 开发指南

本文档为 Agent 开发者提供完整的开发指南，包括 MCP 开发、Skill 开发和 CLI 集成。

## 目录

| 文档 | 描述 |
|------|------|
| [MCP 开发](./mcp-development.md) | MCP Server 开发指南 |
| [Skill 开发](./skill-development.md) | Skill 开发指南 |
| [CLI 集成](./cli-integration.md) | Agent 如何调用 CLI |
| [Agent 模板](./templates/agent-templates.md) | Agent 模板开发指南 |
| [最佳实践](./best-practices.md) | Agent 开发最佳实践 |

## 快速开始

### 1. 创建 Agent

```bash
viben agent create my-agent
```

### 2. 配置 Skill

```bash
viben skill install my-skill --agent my-agent
```

### 3. 配置 MCP

```bash
viben mcp add my-mcp --agent my-agent
```

## 相关共享文档

- [架构概览](../shared/architecture/overview.md)
- [插件架构](../shared/plugin-architecture.md)
- [跨层思维指南](../shared/guides/cross-layer-thinking.md)
