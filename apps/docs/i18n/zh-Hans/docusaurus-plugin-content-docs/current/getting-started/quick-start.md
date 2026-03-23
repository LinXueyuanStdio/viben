---
sidebar_position: 2
title: "快速入门"
description: "快速上手微本"
---

# 快速入门

本指南帮助你快速上手使用微本。根据你的使用场景选择合适的方式。

:::tip 核心概念
开始之前，建议先了解 [核心概念](./concepts)，理解智能体与执行器的区别。
:::

## 方式一：使用桌面应用（推荐）

桌面应用提供完整的图形界面，适合日常开发使用。

### 第一步：下载安装

1. 访问 [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)
2. 下载对应平台的安装包
3. 安装并启动微本

### 第二步：添加工作空间

1. 点击侧边栏的 **+** 按钮
2. 选择"打开现有文件夹"或"创建新文件夹"
3. 按向导完成工作空间配置

### 第三步：管理智能体

1. 系统自动检测工作空间中的执行器 (Claude Code、Cursor 等)
2. 创建自定义智能体或使用内置模板
3. 为智能体配置 MCP 服务器和 Skills

### 第四步：开始使用

- 使用看板管理任务
- 与智能体聊天
- 配置 MCP 服务器

## 方式二：使用 MCP 服务器

如果你只需要 MCP 服务器功能：

### 第一步：安装 MCP 服务器

```bash
pip install browse-mcp
```

### 第二步：配置 Claude Desktop

打开 Claude Desktop 配置文件：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### 第三步：重启 Claude Desktop

完全退出并重新打开 Claude Desktop，使配置生效。

### 第四步：搜索论文

在 Claude Desktop 中，尝试询问：

> "在 arXiv 上搜索关于大语言模型的最新论文"

## 方式三：使用 CLI 工具

CLI 工具适合自动化脚本和高级用户。

:::info CLI 文档
完整的 CLI 命令参考请查看 [CLI 文档](/cli/)。
:::

### 第一步：安装 CLI

```bash
npm install -g viben
```

### 第二步：启动 Gateway

```bash
viben gateway start
```

Gateway 会在端口 18790 启动，提供 API 服务。

### 第三步：发现执行器

```bash
# 列出可用的执行器
viben executor list

# 检查执行器可用性
viben executor show CLAUDE_CODE
```

### 第四步：管理智能体

```bash
# 列出智能体
viben agent list

# 从模板创建智能体
viben agent create --from-template coding-assistant

# 查看智能体详情
viben agent show <agent-name>
```

### 第五步：管理 MCP 服务器

```bash
# 列出 MCP 服务器
viben mcp list

# 添加 MCP 服务器
viben mcp add
```

更多 CLI 用法请参考 [CLI 快速入门](/cli/quick-start)。

## 下一步

- [核心概念](./concepts) - 理解智能体、执行器、配置等核心概念
- [客户端配置](./client-configuration) - 配置 Cline、Zed 等其他客户端
- [桌面应用功能](../desktop/features.md) - 探索完整功能
- [CLI 文档](/cli/) - 命令行工具参考
- [browse_search 工具](../mcp/tools/browse-search.md) - 学习高级搜索选项
- [MCP 配置](../mcp/configuration.md) - 配置 API 密钥启用付费数据源
