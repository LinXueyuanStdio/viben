---
sidebar_position: 1
title: Web 模块规范
description: Viben Web 应用的前端模块开发规范
---

# Web 模块规范

> Viben Web 应用 (apps/web) 的前端模块开发规范文档。

---

## 概述

本目录包含 Viben Web 应用的各个功能模块的前端开发规范，涵盖 UI Shell、认证、用户资料和管理后台等核心模块。

---

## 模块索引

| 模块 | 描述 | 状态 |
|------|------|------|
| [UI Shell](./ui-shell.md) | 应用外壳：布局、导航、主题 | 完成 |
| [Auth UI](./auth-ui.md) | 认证 UI：登录、注册、OAuth | 完成 |
| [Profile UI](./profile-ui.md) | 用户资料：设置、API 密钥管理 | 完成 |
| [Admin UI](./admin-ui.md) | 管理后台：内容审核、用户管理 | 完成 |

---

## 架构决策

### 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 15 | React 框架，App Router |
| shadcn/ui | UI 组件库 |
| Tailwind CSS | 样式系统 |
| Zustand | 客户端状态管理 |
| react-hook-form | 表单处理 |
| zod | 表单验证 |

### 设计原则

1. **Server Components 优先**：数据获取使用服务端组件
2. **渐进增强**：表单和交互使用客户端组件
3. **类型安全**：全程 TypeScript，zod 验证
4. **一致体验**：遵循 Viben Design System

---

## 相关文档

- [Design System](../design-system.md) - 设计系统规范
- [Components](../components.md) - 组件开发指南
