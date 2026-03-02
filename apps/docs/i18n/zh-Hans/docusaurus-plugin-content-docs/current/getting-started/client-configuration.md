---
sidebar_position: 3
title: "客户端配置"
description: "为 Claude Desktop、Claude Code、Cline 和 Zed 配置 Viben"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# 客户端配置

Viben 可与任何兼容 MCP 的客户端配合使用。本指南涵盖了常用客户端的配置方法。

## 配置概述

所有 MCP 客户端都需要相同的基本信息：
- **命令**：`python`（或 Python 的完整路径）
- **参数**：`["-m", "browse_mcp"]`
- **环境变量**：API 密钥和设置（可选）

<Tabs>
  <TabItem value="claude-desktop" label="Claude Desktop" default>

## Claude Desktop

**配置文件位置：**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**最小配置**（仅免费来源）：

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

**完整配置**（包含可选的 API 密钥）：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "SCIENCEDIRECT_API_KEY": "",
        "SPRINGER_API_KEY": "",
        "IEEE_API_KEY": "",
        "SCOPUS_API_KEY": "",
        "CORE_API_KEY": "",
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
        "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

编辑后，**完全重启 Claude Desktop** 使更改生效。

  </TabItem>
  <TabItem value="claude-code" label="Claude Code (CLI)">

## Claude Code (CLI)

**配置文件位置：** `~/.config/claude/config.json`

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "SCIENCEDIRECT_API_KEY": "",
        "SPRINGER_API_KEY": "",
        "IEEE_API_KEY": "",
        "SCOPUS_API_KEY": "",
        "CORE_API_KEY": "",
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
        "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

**验证安装：**

```bash
# 检查 browse-mcp 是否已加载
claude mcp list

# 测试服务器
claude mcp test browse-mcp
```

  </TabItem>
  <TabItem value="cline" label="Cline (VS Code)">

## Cline (VS Code 扩展)

**方法 1：通过 VS Code 设置界面**

1. 打开 VS Code 设置（`Cmd/Ctrl + ,`）
2. 搜索 "Cline MCP"
3. 点击 "在 settings.json 中编辑"
4. 添加以下配置

**方法 2：直接编辑 settings.json**

编辑您的 VS Code 设置文件：
- **macOS/Linux**: `~/.config/Code/User/settings.json`
- **Windows**: `%APPDATA%\Code\User\settings.json`

```json
{
  "cline.mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "SCIENCEDIRECT_API_KEY": "",
        "SPRINGER_API_KEY": "",
        "IEEE_API_KEY": "",
        "SCOPUS_API_KEY": "",
        "CORE_API_KEY": "",
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
        "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

添加配置后，重新加载 VS Code。

  </TabItem>
  <TabItem value="zed" label="Zed Editor">

## Zed Editor

**配置文件位置：** `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "browse-mcp": {
      "command": {
        "path": "python",
        "args": ["-m", "browse_mcp"]
      },
      "settings": {
        "env": {
          "SEMANTIC_SCHOLAR_API_KEY": "",
          "SCIENCEDIRECT_API_KEY": "",
          "SPRINGER_API_KEY": "",
          "IEEE_API_KEY": "",
          "SCOPUS_API_KEY": "",
          "CORE_API_KEY": "",
          "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
          "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
          "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
        }
      }
    }
  }
}
```

  </TabItem>
  <TabItem value="custom" label="自定义客户端">

## 自定义 MCP 客户端

对于其他 MCP 客户端，请使用以下连接详情：

**服务器命令：**
```bash
python -m browse_mcp
```

**传输方式：** stdio（默认）

**协议：** MCP 1.0

**可用工具：**
- `browse_search` - 搜索学术论文
- `browse_download` - 下载论文 PDF
- `browse_read` - 从论文中提取文本

**环境变量**（全部可选）：

| 变量 | 描述 |
|----------|-------------|
| `BROWSE_MCP_DOWNLOAD_PATH` | 下载 PDF 的目录（默认：`./downloads`） |
| `BROWSE_MCP_ENABLED_SOURCES` | 逗号分隔的启用来源列表 |
| `BROWSE_MCP_DISABLED_SOURCES` | 逗号分隔的禁用来源列表 |
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar 的 API 密钥 |
| `SCIENCEDIRECT_API_KEY` | Science Direct 的 API 密钥 |
| `SPRINGER_API_KEY` | Springer Link 的 API 密钥 |
| `IEEE_API_KEY` | IEEE Xplore 的 API 密钥 |
| `SCOPUS_API_KEY` | Scopus 的 API 密钥 |
| `CORE_API_KEY` | CORE 的 API 密钥 |

  </TabItem>
</Tabs>

## 故障排除

### Python 未找到

如果您收到 "python not found" 错误，请使用 Python 的完整路径：

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "/usr/local/bin/python3",
      "args": ["-m", "browse_mcp"]
    }
  }
}
```

使用以下命令查找您的 Python 路径：
```bash
which python3
```

### 模块未找到

如果您收到 "No module named browse_mcp" 错误，请确保该包已安装在同一 Python 环境中：

```bash
pip install browse-mcp
```

### 服务器无法启动

检查您的 MCP 客户端日志。对于 macOS 上的 Claude Desktop：
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

## 下一步

- [配置](../mcp/configuration.md) - 配置来源和 API 密钥
- [browse_search 工具](../mcp/tools/browse-search.md) - 了解搜索参数
