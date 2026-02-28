---
sidebar_position: 1
title: "桌面应用"
description: "Viben 桌面应用 - 多智能体工作空间管理器"
---

# 桌面应用

Viben Desktop 是一个原生桌面应用，帮助你统一管理多个 AI 编程助手、MCP 服务器和开发任务。基于 Tauri 构建，提供快速、轻量、安全的跨平台体验。

## 核心功能

### 多工作空间管理

管理多个项目工作空间，每个工作空间是文件系统上的一个文件夹：

| 工作空间类型 | 说明 |
|-------------|------|
| **全局工作空间** | 默认存在，代表 `~` 目录下的全局配置 |
| **自定义工作空间** | 用户添加的项目目录 |

每个工作空间可以包含：
- 智能体配置（`.claude/`、`.cursor/`、`.codex/`）
- MCP 服务器配置
- Skills 配置
- 任务看板

### 智能体编排

自动检测和管理多种 AI 编程助手：

| 智能体 | 检测目录 | 配置文件 |
|--------|----------|----------|
| **Claude Code** | `.claude/` | `mcp.json`、`settings.json` |
| **Cursor** | `.cursor/` | `mcp.json` |
| **Codex** | `.codex/` | `config.json` |

### MCP 服务器管理

为每个智能体配置 MCP 服务器：
- 添加、编辑、删除 MCP 服务器
- 配置命令、参数、环境变量
- 启用/禁用服务器
- 查看服务器状态

### 任务看板

集成看板系统管理开发任务：
- 任务卡片拖拽排序
- 优先级和标签管理
- 子任务和依赖关系
- 活动记录和评论

### AI 聊天界面

与智能体进行对话：
- 支持多种 Provider（OpenAI、Anthropic、Ollama 等）
- 模型选择和参数配置
- 会话历史管理
- SSE 流式响应

## 下载

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

从 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop) 下载。

| 平台 | 文件格式 | 大小 |
|------|----------|------|
| macOS (Universal) | `.dmg` | ~15 MB |
| Windows (x64) | `.msi` / `.exe` | ~10 MB |
| Linux (x64) | `.AppImage` / `.deb` | ~15 MB |

## 系统要求

### 最低要求

| 平台 | 要求 |
|------|------|
| **macOS** | macOS 10.15 (Catalina) 或更高 |
| **Windows** | Windows 10 (64 位) 或更高 |
| **Linux** | Ubuntu 20.04 或同等版本 (64 位) |

### 推荐配置

- 4 GB RAM
- 100 MB 磁盘空间
- 网络连接

## 技术架构

Viben Desktop 采用现代技术栈构建：

| 层 | 技术 |
|----|------|
| **前端** | React 19 + TypeScript + Tailwind CSS 4.1 |
| **后端** | Rust + Tauri v2 |
| **UI 组件** | shadcn/ui (Radix UI) |
| **动画** | Framer Motion |
| **图标** | Lucide React + @lobehub/icons |
| **状态管理** | Zustand + TanStack Query |
| **本地存储** | SQLite |

### 数据存储

| 平台 | 位置 |
|------|------|
| macOS | `~/Library/Application Support/com.viben.app` |
| Windows | `%APPDATA%\com.viben.app` |
| Linux | `~/.config/viben` |

## 快速开始

1. **下载安装**
   - 访问 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
   - 下载对应平台的安装包
   - 完成安装

2. **添加工作空间**
   - 点击侧边栏的 **+** 按钮
   - 选择"打开现有文件夹"或"创建新文件夹"
   - 完成向导配置

3. **管理智能体**
   - 选择工作空间
   - 查看检测到的智能体
   - 配置 MCP 服务器

4. **开始使用**
   - 使用看板管理任务
   - 与智能体聊天
   - 浏览 MCP 市场

## 下一步

- [安装指南](./installation) - 详细安装说明
- [功能介绍](./features) - 完整功能列表
- [快速入门](../getting-started/quick-start) - 2 分钟上手
