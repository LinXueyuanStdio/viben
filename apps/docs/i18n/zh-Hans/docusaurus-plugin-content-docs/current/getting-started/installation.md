---
sidebar_position: 1
title: "安装"
description: "使用 pip、uv 或从源码安装 Viben 和插件"
---

# 安装

Viben 可以使用 `pip`、`uv` 或从源码安装进行开发。本指南涵盖所有安装方法，包括插件安装。

## 先决条件

- **Python 3.10 或更高版本** - Viben 需要 Python 3.10+
- **pip 或 uv** - 用于安装的包管理器

检查您的 Python 版本：

```bash
python --version
```

## 安装方法

### 使用 pip（推荐）

安装 Viben 最简单的方法：

```bash
pip install browse-mcp
```

### 使用 uv

如果您使用 [uv](https://github.com/astral-sh/uv) 进行更快的包管理：

```bash
uv pip install browse-mcp
```

或添加到您的项目：

```bash
uv add browse-mcp
```

### 从源码安装（开发）

对于想要修改代码或贡献的开发者：

1. **克隆仓库**：

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
```

2. **创建并激活虚拟环境**：

```bash
# 使用 uv（推荐）
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 或使用标准 venv
python -m venv .venv
source .venv/bin/activate
```

3. **以开发模式安装**：

```bash
# 使用 uv
uv pip install -e .

# 或使用 pip
pip install -e .
```

4. **安装开发依赖**（可选）：

```bash
pip install pytest flake8
```

## 安装插件

插件使用额外的内容来源扩展 Viben。将它们与核心包一起安装。

### 社交媒体插件

添加对 GitHub、Twitter、知乎和小红书的支持：

```bash
pip install browse-mcp-plugin-social-media
```

### 多个插件

一次安装多个插件：

```bash
pip install browse-mcp browse-mcp-plugin-social-media
```

### 插件自动发现

插件在服务器启动时自动发现。不需要更改配置 - 只需安装并重启即可。

```bash
# 安装插件后，验证它是否加载
browse-mcp --debug
```

您应该在启动日志中看到插件来源：

```
INFO     Successfully loaded 15 searcher plugins: arxiv, github, twitter...
```

查看[安装插件](../plugins/installing-plugins)了解详细的插件管理。

## 验证安装

安装后，验证 Viben 是否正确安装：

```bash
browse-mcp --help
```

您应该看到类似这样的输出：

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

## 启动服务器

以 stdio 模式启动 MCP 服务器（用于 MCP 客户端）：

```bash
browse-mcp
```

:::tip
服务器默认以 stdio 模式运行，这是 Claude Desktop 等 MCP 客户端期望的模式。您不需要保持终端打开 - MCP 客户端会自动启动服务器。
:::

## 下一步

- [快速开始](./quick-start) - 2 分钟内搜索您的第一篇论文
- [客户端配置](./client-configuration) - 配置您的 MCP 客户端
- [插件概述](../plugins/overview) - 了解插件系统
- [可用插件](../plugins/available-plugins) - 浏览可用插件
