---
sidebar_position: 1
title: "安装指南"
description: "安装 Viben 桌面应用、CLI 工具或 MCP 服务器"
---

# 安装指南

## Viben：Agent Swarm x Code Evolution

Viben 是一个 AI 驱动的代码迭代优化与智能体集群编排平台。核心能力包括：

- **FileEvo（基于文件的自进化）** - 基于反馈的代码迭代优化系统
- **Agent Swarm** - 多智能体集群编排与协作
- **Task System（XState）** - 基于状态机的任务工作流管理
- **Idea Generation** - AI 辅助创意生成与知识探索

---

## 产品形态

Viben 提供多种产品形态，您可以根据需求选择安装：

| 产品 | 安装方式 | 使用场景 |
|------|----------|----------|
| **桌面应用** | 下载安装包 | Agent Swarm 编排、FileEvo 代码优化、任务管理 |
| **CLI 工具** | npm/npx | 命令行自动化、任务状态机、Queue 系统 |
| **MCP 服务器** | pip/uv | AI 助手集成，用于学术搜索、知识获取 |

---

## 桌面应用（推荐）

桌面应用是体验 **Agent Swarm x Code Evolution** 最直观的方式，提供完整的图形界面：

- **Agent Swarm** - 可视化编排和管理智能体集群
- **FileEvo** - 可视化反馈界面，进行代码迭代优化
- **Task System** - 基于 XState 的任务状态机管理
- **Idea Generation** - AI 辅助知识探索与创意生成

### 下载

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

从 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop) 下载最新版本：

| 平台 | 下载格式 | 说明 |
|------|----------|------|
| **macOS** | `.dmg`（Universal） | 支持 Intel 和 Apple Silicon |
| **Windows** | `.msi` 或 `.exe` | 64 位 Windows 10/11 |
| **Linux** | `.AppImage` 或 `.deb` | 64 位 Linux |

### macOS 安装

1. 下载 `.dmg` 文件
2. 双击打开磁盘映像
3. 将 **Viben** 拖到 **应用程序** 文件夹
4. 首次启动时，右键选择"打开"（绕过 Gatekeeper）

:::note macOS 安全提示
如果您看到"Viben 已损坏，无法打开"，请在终端中运行：
```bash
sudo /usr/bin/xattr -cr /Applications/Viben.app
```
:::

### Windows 安装

1. 下载 `.msi` 或 `.exe` 安装程序
2. 运行安装程序
3. 按照安装向导完成安装
4. 从开始菜单启动 Viben

### Linux 安装

**AppImage（便携版）：**
```bash
chmod +x Viben_*.AppImage
./Viben_*.AppImage
```

**Debian/Ubuntu：**
```bash
sudo dpkg -i Viben_*_amd64.deb
sudo apt-get install -f  # 修复依赖
```

---

## CLI 工具

Viben CLI 是 **Agent Swarm x Code Evolution** 的命令行入口，适合自动化和脚本集成：

- **Task System** - `viben task` 管理任务状态机工作流
- **Queue System** - `viben queue` 后台命令执行队列
- **Agent Management** - 命令行管理智能体集群

### 使用 npx（推荐）

无需安装，直接运行：

```bash
npx viben
```

### 全局安装

```bash
npm install -g viben
```

安装后，可以直接使用 `viben` 命令：

```bash
viben --help
```

### 验证安装

```bash
viben version
```

### 主要命令

```
viben <command> [options]

Core:
  init          使用 AI 辅助开发工作流初始化 Viben 工作空间
  config        管理 Viben 配置（git 风格的 get/set）
  gateway       管理 Viben Gateway（start/stop/status）
  service       管理后台服务

Agent:
  agent         管理 AI 智能体（create、update、list、chat、memory、sessions）
  executor      管理 AI 编码智能体执行器（list、show、chat）

Task:
  task          管理开发任务（状态机工作流）
  queue         管理后台命令执行队列
  swarm         使用 git worktree 管理多智能体流水线

AI:
  idea          AI 驱动的创意生成与管理
  evo           Evo - 基于文件的自进化代码优化
  reward        Evo 的奖励类型管理

Tools:
  mcp           MCP（Model Context Protocol）工具
  skill         管理技能（install、search、enable/disable）
  channel       管理通知渠道
  cron          管理定时任务

Workspace:
  workspace     工作空间操作（list、current）
  session       会话录制管理
  context       获取当前开发上下文
  user          管理用户身份
  page          管理工作空间页面

Config:
  provider      管理 AI Provider
  model         管理 AI 模型（aliases、fallback、config）
  update        更新 Viben CLI 或工作空间组件

Telemetry:
  telemetry     管理遥测追踪与日志

Auth:
  login         使用 API token 登录 Viben
  logout        登出并移除已保存的 token
  whoami        显示当前登录用户
```

---

## MCP 服务器

MCP 服务器为 **Agent Swarm** 提供知识获取能力，支持学术论文搜索和多源数据访问。它是 **Idea Generation** 和 **FileEvo** 的重要知识来源。

### 快速安装

```bash
pip install browse-mcp
```

### 使用 uv

如果您使用 [uv](https://github.com/astral-sh/uv) 作为包管理器：

```bash
uv pip install browse-mcp
```

### Shell 脚本安装

在 macOS 或 Linux 上快速安装：

```bash
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
```

### 验证安装

```bash
browse-mcp --help
```

示例输出：

```
Usage: browse-mcp [OPTIONS] COMMAND [ARGS]...

  Run the Browse MCP server.

Options:
  --host TEXT           Bind host (SSE/HTTP only).  [default: 127.0.0.1]
  --port INTEGER        Bind port (SSE/HTTP only).  [default: 8000]
  --debug / --no-debug  Enable debug logging.  [default: no-debug]
  -t, --transport TEXT  Transport method: stdio, sse, streamable-http, http
  --help                Show this message and exit.
```

### 启动服务器

```bash
browse-mcp
```

:::tip
服务器默认以 stdio 模式运行，这是 Claude Desktop 等 MCP 客户端期望的模式。您不需要保持终端打开 - MCP 客户端会自动启动服务器。
:::

---

## 从源码安装（开发者）

### 克隆仓库

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
```

### 安装依赖

```bash
pnpm install
```

### 构建项目

```bash
pnpm build
```

### 启动开发服务

**桌面应用：**
```bash
pnpm dev:desktop
```

**Gateway 服务：**
```bash
pnpm gateway:build
```

---

## 系统要求

### 桌面应用

| 平台 | 最低要求 |
|------|----------|
| **macOS** | macOS 10.15 (Catalina) 或更高版本 |
| **Windows** | Windows 10（64 位）或更高版本 |
| **Linux** | Ubuntu 20.04 或同等版本（64 位） |

**推荐配置：**
- 4 GB 内存
- 100 MB 磁盘空间
- 网络连接

### CLI 工具

- Node.js 18+ 或 20+
- npm 或 pnpm

### MCP 服务器

- Python 3.10 或更高版本
- pip 或 uv

---

## 下一步

- [快速开始](./quick-start) - 2 分钟内搜索您的第一篇论文
- [客户端配置](./client-configuration) - 配置 Claude Desktop、Cline 等
- [桌面应用功能](../desktop/features) - 探索完整的桌面应用功能
