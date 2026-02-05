---
sidebar_position: 1
title: "桌面应用"
description: "Viben 桌面应用 - 一个原生内容搜索应用"
---

# 桌面应用

Viben Desktop 是一个原生应用程序，将内容搜索的强大功能直接带到您的桌面上。它基于 Tauri 构建，在 macOS、Windows 和 Linux 上提供快速、轻量且安全的体验。

## 功能特点

- **原生性能**：使用 Rust 和 Tauri 构建，启动快、内存占用低
- **跨平台**：支持 macOS（通用版）、Windows（x64）和 Linux（x64）
- **离线就绪**：核心功能无需持续联网即可使用
- **MCP 集成**：内置 MCP 服务器管理，可与 AI 助手集成
- **隐私优先**：您的数据保存在本地

## 下载

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

从 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop) 下载。

| 平台 | 文件 | 大小 |
|----------|------|------|
| macOS（通用版） | `.dmg` | ~15 MB |
| Windows（x64） | `.msi` / `.exe` | ~10 MB |
| Linux（x64） | `.AppImage` / `.deb` | ~15 MB |

## 系统要求

### 最低要求

| 平台 | 要求 |
|----------|-------------|
| **macOS** | macOS 10.15 (Catalina) 或更高版本 |
| **Windows** | Windows 10（64 位）或更高版本 |
| **Linux** | Ubuntu 20.04 或同等版本（64 位） |

### 推荐配置

- 4 GB 内存
- 100 MB 可用磁盘空间
- 用于论文搜索的网络连接

## 快速开始

1. **下载**适用于您平台的安装程序
2. **安装**，按照[平台特定说明](/docs/desktop-app/installation)操作
3. **启动** Viben 应用
4. **搜索**，使用搜索栏搜索论文

## 架构

Viben Desktop 使用现代技术构建：

- **前端**：React 19 + TypeScript + Tailwind CSS
- **后端**：Rust + Tauri v2
- **UI 组件**：shadcn/ui (Radix UI)
- **动画**：Framer Motion

应用与各种学术 API（arXiv、PubMed、Semantic Scholar 等）通信以搜索和检索论文。

## 下一步

- [安装指南](/docs/desktop-app/installation) - 详细安装说明
- [功能特点](/docs/desktop-app/features) - 探索所有功能
- [快速开始](/docs/getting-started/quick-start) - 搜索您的第一篇论文
