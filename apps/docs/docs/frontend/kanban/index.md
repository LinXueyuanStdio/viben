---
sidebar_position: 1
title: Kanban 模块规范
description: Viben Desktop 工作空间任务看板功能开发规范
---

# Kanban 模块规范

> Viben Desktop 工作空间中的任务看板功能开发规范文档。

---

## 概述

Kanban 模块为 Viben Desktop 工作空间提供项目级任务管理能力，采用 `@viben/kanban` 共享包实现核心功能。

---

## 文档索引

| 文档 | 描述 | 阶段 |
|------|------|------|
| [Integration](./integration.md) | 看板集成规格，符号链接策略 | Phase 1 |
| [Features](./features.md) | 核心功能：优先级、标签、过滤 | Phase 2 |
| [Phase 3](./phase3-advanced.md) | 高级功能规格 | Phase 3 |
| [Phase 4](./phase4-collaboration.md) | 协作功能规格 | Phase 4 |
| [Phase 5](./phase5-automation.md) | UI 优化规格 | Phase 5 |
| [Phase 6](./phase6-views.md) | UI 修复与布局 | Phase 6 |
| [Phase 7](./phase7-ai.md) | 布局关键修复 | Phase 7 |
| [Phase 8](./phase8-customization.md) | 匹配 vibe-kanban 布局 | Phase 8 |

---

## 架构概览

```
packages/kanban/              # 共享包 @viben/kanban
├── src/
│   ├── kanban.tsx           # 主看板组件
│   ├── kanban-column.tsx    # 列组件
│   ├── task-card.tsx        # 任务卡片
│   └── task-detail.tsx      # 任务详情面板

apps/desktop/src/
├── pages/
│   └── workspace-kanban.tsx # 看板页面
└── stores/
    └── kanban-store.ts      # 状态管理
```

---

## 核心特性

- **拖拽排序**：任务卡片和列的拖拽支持
- **优先级系统**：紧急/高/中/低四级优先级
- **标签管理**：自定义颜色标签
- **智能过滤**：按状态、优先级、标签过滤
- **任务详情**：侧边栏详情面板

---

## 相关文档

- [Design System](../design-system.md) - 设计系统规范
- [Components](../components.md) - 组件开发指南
- [Chat Integration](../chat-integration.md) - 聊天集成规范
