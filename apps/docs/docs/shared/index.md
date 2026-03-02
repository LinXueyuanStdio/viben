# 共享文档

本目录包含多个受众分类共用的文档。

## 目录结构

| 子目录 | 内容 | 相关受众 |
|-------|------|---------|
| [architecture/](./architecture/overview.md) | 系统架构、核心集成 | backend, frontend, agent |
| [guides/](./guides/index.md) | 开发思维指南 | backend, frontend, agent |
| [data-models/](./data-models/workspace.md) | 数据模型定义 | backend, frontend |

## 核心文档

| 文档 | 描述 | 相关受众 |
|------|------|---------|
| [Provider System](./provider-system.md) | Provider 系统设计 | frontend, backend |
| [Plugin Architecture](./plugin-architecture.md) | 插件架构设计 | backend, agent |

## 使用说明

- **前端开发者** 查看 architecture/ 和 data-models/
- **后端开发者** 查看 architecture/ 和 data-models/
- **Agent 开发者** 查看 architecture/ 和 guides/
- **CLI 文档** 已移至独立的 [CLI](/cli/) 分类

## 各分类如何引用

在各分类的 index.md 中添加对 shared/ 的引用链接：

```markdown
## 相关共享文档

- [架构概览](../shared/architecture/overview.md)
- [数据模型](../shared/data-models/)
```
