---
sidebar_position: 3
title: "客户端配置"
description: "为 Claude Desktop、Claude Code、Cline 和 Zed 配置 Viben MCP 服务器"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# 客户端配置

Viben MCP 服务器兼容任何支持 MCP 协议的客户端。本指南涵盖主流客户端的配置方法。

## 配置概览

所有 MCP 客户端需要相同的基本信息：
- **命令**: `python`（或 Python 的完整路径）
- **参数**: `["-m", "browse_mcp"]`
- **环境变量**: API 密钥和设置（可选）

<Tabs>
  <TabItem value="claude-desktop" label="Claude Desktop" default>

## Claude Desktop

**配置文件位置：**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**最小配置**（仅免费数据源）：

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

**完整配置**（含可选 API 密钥）：

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

编辑后，**完全重启 Claude Desktop** 以使更改生效。

  </TabItem>
  <TabItem value="claude-code" label="Claude Code (CLI)">

## Claude Code (CLI)

**配置文件位置：** `~/.claude/mcp.json`

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

**方法一：通过 VS Code 设置界面**

1. 打开 VS Code 设置（`Cmd/Ctrl + ,`）
2. 搜索 "Cline MCP"
3. 点击"在 settings.json 中编辑"
4. 添加以下配置

**方法二：直接编辑 settings.json**

编辑 VS Code 设置文件：
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
  <TabItem value="zed" label="Zed 编辑器">

## Zed 编辑器

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
  <TabItem value="cursor" label="Cursor">

## Cursor

**配置文件位置：** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

  </TabItem>
  <TabItem value="custom" label="自定义客户端">

## 自定义 MCP 客户端

对于其他 MCP 客户端，使用以下连接信息：

**服务器命令：**
```bash
python -m browse_mcp
```

**传输方式：** stdio（默认）

**协议：** MCP 1.0

**可用工具：**
- `browse_search` - 搜索学术论文
- `browse_download` - 下载论文 PDF
- `browse_read` - 提取论文文本

**环境变量**（全部可选）：

| 变量 | 说明 |
|------|------|
| `BROWSE_MCP_DOWNLOAD_PATH` | PDF 下载目录（默认：`./downloads`）|
| `BROWSE_MCP_ENABLED_SOURCES` | 启用的数据源（逗号分隔）|
| `BROWSE_MCP_DISABLED_SOURCES` | 禁用的数据源（逗号分隔）|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar API 密钥 |
| `SCIENCEDIRECT_API_KEY` | ScienceDirect API 密钥 |
| `SPRINGER_API_KEY` | Springer Link API 密钥 |
| `IEEE_API_KEY` | IEEE Xplore API 密钥 |
| `SCOPUS_API_KEY` | Scopus API 密钥 |
| `CORE_API_KEY` | CORE API 密钥 |

  </TabItem>
</Tabs>

## 使用 Viben 桌面应用管理 MCP 配置

如果你安装了 Viben 桌面应用，可以通过图形界面管理 MCP 服务器配置：

1. 打开 Viben 桌面应用
2. 选择工作空间
3. 点击要配置的智能体（如 Claude Code）
4. 在 MCP 服务器列表中添加、编辑或删除服务器
5. 更改会自动保存到对应的配置文件

这比手动编辑 JSON 文件更加方便和安全。

## 故障排除

### Python 未找到

如果出现"python not found"错误，使用 Python 的完整路径：

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

查找 Python 路径：
```bash
which python3
```

### 模块未找到

如果出现"No module named browse_mcp"，确保包已安装在同一 Python 环境中：

```bash
pip install browse-mcp
```

### 服务器无法启动

检查 MCP 客户端的日志。对于 macOS 上的 Claude Desktop：
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

### 检查已加载的数据源

运行调试模式查看已加载的数据源：

```bash
browse-mcp --debug
```

## 下一步

- [MCP 配置](../mcp/configuration) - 配置数据源和 API 密钥
- [browse_search 工具](../mcp/tools/browse-search) - 学习搜索参数
- [插件配置](../plugins/configuration) - 高级插件设置
