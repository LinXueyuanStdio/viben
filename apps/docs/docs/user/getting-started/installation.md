---
sidebar_position: 1
title: "安装指南"
description: "安装 Viben 桌面应用、CLI 工具或 MCP 服务器"
---

# 安装指南

Viben 提供多种产品形态，你可以根据需求选择安装：

| 产品 | 安装方式 | 适用场景 |
|------|----------|----------|
| **桌面应用** | 下载安装包 | 可视化管理工作空间和任务 |
| **CLI 工具** | npm/npx | 命令行操作、自动化脚本 |
| **MCP 服务器** | pip/uv | AI 助手集成学术搜索 |

---

## 桌面应用（推荐）

桌面应用是使用 Viben 最简单的方式，提供完整的图形界面。

### 下载

[![最新版本](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

从 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop) 下载最新版本：

| 平台 | 下载格式 | 说明 |
|------|----------|------|
| **macOS** | `.dmg` (Universal) | 支持 Intel 和 Apple Silicon |
| **Windows** | `.msi` 或 `.exe` | 64 位 Windows 10/11 |
| **Linux** | `.AppImage` 或 `.deb` | 64 位 Linux |

### macOS 安装

1. 下载 `.dmg` 文件
2. 双击打开磁盘映像
3. 拖动 **Viben** 到 **Applications** 文件夹
4. 首次启动时，右键点击选择"打开"（绕过 Gatekeeper）

:::note macOS 安全提示
如果看到"Viben 已损坏，无法打开"的提示，在终端运行：
```bash
xattr -cr /Applications/Viben.app
```
:::

### Windows 安装

1. 下载 `.msi` 或 `.exe` 安装包
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

Viben CLI 提供命令行管理能力，适合自动化和脚本集成。

### 使用 npx（推荐）

无需安装，直接运行：

```bash
npx viben
```

### 全局安装

```bash
npm install -g viben
```

安装后可以直接使用 `viben` 命令：

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

Commands:
  gateway       启动 Gateway 服务
  agent         管理智能体
  provider      管理 API Provider
  model         管理模型配置
  mcp           管理 MCP 服务器
  skill         管理 Skills
  channel       管理聊天通道
  cron          管理定时任务
  workspace     工作空间操作
```

---

## MCP 服务器

MCP 服务器为 AI 助手提供学术搜索能力。

### 快速安装

```bash
pip install browse-mcp
```

### 使用 uv

如果你使用 [uv](https://github.com/astral-sh/uv) 作为包管理器：

```bash
uv pip install browse-mcp
```

### Shell 脚本安装

macOS 或 Linux 上的快速安装：

```bash
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
```

### 验证安装

```bash
browse-mcp --help
```

输出示例：

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
服务器默认以 stdio 模式运行，这是 Claude Desktop 等 MCP 客户端期望的方式。你不需要保持终端打开，MCP 客户端会自动启动服务器。
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
| **macOS** | macOS 10.15 (Catalina) 或更高 |
| **Windows** | Windows 10 (64 位) 或更高 |
| **Linux** | Ubuntu 20.04 或同等版本 (64 位) |

**推荐配置：**
- 4 GB RAM
- 100 MB 磁盘空间
- 网络连接

### CLI 工具

- Node.js 18+ 或 20+
- npm 或 pnpm

### MCP 服务器

- Python 3.10 或更高
- pip 或 uv

---

## 下一步

- [快速入门](./quick-start) - 2 分钟搜索你的第一篇论文
- [客户端配置](./client-configuration) - 配置 Claude Desktop、Cline 等
- [桌面应用功能](../desktop/features) - 探索桌面应用完整功能
