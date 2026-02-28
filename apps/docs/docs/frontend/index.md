---
sidebar_position: 1
title: 前端开发指南
description: Viben 项目前端开发最佳实践
---

# 前端开发指南

> Viben 项目前端开发的最佳实践指南。

---

## 概述

本目录包含前端开发的规范指南。这些规范确保桌面应用程序中代码的一致性和高质量。

---

## 指南索引

### 核心指南

| 指南 | 描述 | 状态 |
|------|------|------|
| [设计系统](./design-system.md) | 完整设计系统：颜色、字体、动效、组件 | ✅ 完成 |
| [组件指南](./components.md) | React 组件模式与最佳实践 | ✅ 完成 |
| Hook 指南 | 自定义 hooks 与状态管理 | 📋 计划中 |
| 类型安全 | TypeScript 模式与类型定义 | 📋 计划中 |
| 质量指南 | 代码标准与禁止模式 | 📋 计划中 |
| [Tailwind v4 工作空间包配置](./tailwind-v4-setup.md) | **关键** - Tailwind v4 工作空间包扫描配置 | ✅ 完成 |

### 功能指南

| 指南 | 描述 | 规范 | 实现 |
|------|------|------|------|
| [Marketplace 发布流程](./marketplace-publish-flow.md) | "Publish My MCP" 和 "Publish My Skill" 向导流程 | ✅ | ❌ |
| [聊天集成](./chat-integration.md) | 工作空间聊天页面集成 (**仅限桌面端**) | ✅ | ✅ |
| [聊天输入组件](./chat-input-components.md) | ChatInput 统一组件使用指南 | ✅ | ✅ |

> **图例:** 规范 = 规格文档完成, 实现 = 代码实现完成

---

## 相关模块规范

### Kanban 看板

| 指南 | 描述 | 状态 |
|------|------|------|
| [模块概述](./kanban/index.md) | Kanban 模块规范索引 | ✅ 完成 |
| [Kanban 集成](./kanban/integration.md) | Kanban 整体架构设计 | ✅ 完成 |
| [Kanban 功能](./kanban/features.md) | Kanban 核心功能 | 📝 规划中 |
| [Phase 3: 高级功能](./kanban/phase3-advanced.md) | 高级任务管理功能 | 📝 规划中 |
| [Phase 4: 协作](./kanban/phase4-collaboration.md) | 多人协作功能 | 📝 规划中 |
| [Phase 5: 自动化](./kanban/phase5-automation.md) | 工作流自动化 | 📝 规划中 |
| [Phase 6: 视图](./kanban/phase6-views.md) | 多视图支持 | 📝 规划中 |
| [Phase 7: AI](./kanban/phase7-ai.md) | AI 辅助功能 | 📝 规划中 |
| [Phase 8: 定制](./kanban/phase8-customization.md) | 自定义配置 | 📝 规划中 |

### 社交聊天

| 指南 | 描述 | 状态 |
|------|------|------|
| [Social Chat 概述](./social-chat/index.md) | 社交聊天模块索引 | ✅ 完成 |
| [聊天规范](./social-chat/chat-spec.md) | 聊天功能开发规范 | ✅ 完成 |
| [联系人规范](./social-chat/contacts-spec.md) | 联系人功能开发规范 | ✅ 完成 |
| [聊天 PRD](./social-chat/chat-prd.md) | 聊天功能产品需求 | ✅ 完成 |

### Web UI 模块

| 指南 | 描述 | 状态 |
|------|------|------|
| [模块概述](./modules/index.md) | Web 模块规范索引 | ✅ 完成 |
| [UI Shell](./modules/ui-shell.md) | 应用外壳：布局、导航、主题 | ✅ 完成 |
| [Auth UI](./modules/auth-ui.md) | 认证 UI：登录、注册、OAuth | ✅ 完成 |
| [Profile UI](./modules/profile-ui.md) | 用户资料：设置、API 密钥 | ✅ 完成 |
| [Admin UI](./modules/admin-ui.md) | 管理后台：审核、用户管理 | ✅ 完成 |

---

## 快速开始

### 1. 首先阅读设计系统

在编写任何前端代码之前，阅读[设计系统](./design-system.md)以了解：

- 品牌颜色（温暖的琥珀/橙色调色板）
- 字体（Crimson Pro 衬线 + Inter 无衬线）
- 动效模式（编排式动画序列）
- Bento 网格布局系统
- 组件模式与示例

### 2. 设计理念

Viben 遵循 **"温暖的未来主义"** 美学：

- **温暖**：橙色/琥珀色调色板（而非典型的蓝色/紫色）
- **面向未来**：现代、创新，配合精致的动效
- **学术权威感**：衬线字体 + 专业数据可视化
- **令人难忘**：标志性的动效设计与自定义 SVG 图表

### 3. 技术栈

- **框架**: React 19 + TypeScript
- **样式**: Tailwind CSS 4.1 + CSS 自定义属性
- **UI 组件**: shadcn/ui (Radix UI 原语)
- **动画**: Framer Motion + CSS 动画
- **图标**: Lucide React + @lobehub/icons (AI 模型图标)
- **构建**: Vite + Tauri (桌面应用)

---

## 核心原则

1. **遵循设计系统**
   - 使用 CSS 变量设置颜色（切勿硬编码）
   - 使用间距比例（4, 6, 8, 12 等）
   - 使用定义的字体比例和字体栈

2. **有目的的动效**
   - 每个动画必须有意义
   - 使用交错显示编排页面加载
   - 使用定义的缓动曲线和持续时间

3. **组件一致性**
   - 创建新组件前先复用现有组件
   - 遵循 CVA (class-variance-authority) 模式定义变体
   - 确保深色模式兼容性

4. **自定义可视化**
   - 所有图表使用 SVG（不使用带默认样式的第三方库）
   - 图表挂载时带动画
   - 使用品牌色（琥珀色主色，青色辅助色）

---

## AI 模型图标

使用 `@lobehub/icons` 获取 AI 模型品牌图标：

```tsx
import Claude from "@lobehub/icons/es/Claude";
import OpenAI from "@lobehub/icons/es/OpenAI";

<Claude.Color size={20} />  // 彩色版本
<OpenAI size={20} />        // 单色版本
```

**带 `.Color` 变体的图标**: Claude, Gemini, Mistral, Meta, DeepSeek, Qwen, Cohere, HuggingFace

**无 `.Color`（使用默认）的图标**: OpenAI, Ollama, Groq, Anthropic

---

## 迁移计划

我们正在从通用设计迁移到 Viben 设计系统：

### 阶段 1: 基础（进行中）
- [x] 定义颜色系统（温暖的琥珀/橙色）
- [x] 定义字体系统（衬线 + 无衬线）
- [x] 定义动效模式
- [ ] 更新 `index.css` 中的 CSS 变量
- [ ] 添加字体导入

### 阶段 2: 组件
- [ ] 更新 Button 组件
- [ ] 将卡片重构为 Bento 网格
- [ ] 添加动画类
- [ ] 更新侧边栏样式

### 阶段 3: 润色
- [ ] 添加背景纹理
- [ ] 实现页面过渡
- [ ] 增强图表动画
- [ ] 添加加载序列

---

**语言**: 文档内容使用中文，代码示例使用英文。
