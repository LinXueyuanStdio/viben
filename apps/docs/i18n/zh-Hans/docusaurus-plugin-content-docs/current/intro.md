---
sidebar_position: 1
title: "简介"
description: "Browse MCP - 通过 MCP 插件从可扩展的来源搜索、下载和阅读任何内容"
---

# Browse MCP

**Browse MCP** 是一个基于 Python 的 MCP（模型上下文协议）服务器，它使 AI 助手能够通过可扩展的插件系统从任何来源搜索、下载和阅读内容。开箱即用，它支持 19+ 个学术数据库，您还可以扩展它以支持社交媒体、文档站点、新闻源等。

## 主要特性

- **多源支持** - 从 19+ 个内置学术来源搜索和下载内容，包括 arXiv、PubMed、Semantic Scholar 等。通过插件扩展支持任何内容类型。

- **可扩展插件系统** - 通过安装插件或创建自己的插件来添加新的内容来源。使用 `ContentSource[T]` API 支持学术论文之外的任何内容类型。

- **统一接口** - 所有来源都可以通过三个一致的工具访问：`paper_search`、`paper_download` 和 `paper_read`。

- **标准化输出** - 无论来源如何，内容都以一致的格式返回，使 AI 助手易于处理结果。

- **MCP 集成** - 与 MCP 客户端兼容，如 Claude Desktop、Claude Code、Cline（VS Code）和 Zed Editor。

- **异步操作** - 高效处理并发搜索和下载，快速获取结果。

- **分页支持** - 使用 `page`、`start_page` 和 `end_page` 参数从文档中读取特定页面或页面范围。

## 快速安装

```bash
pip install browse-mcp
```

然后启动服务器：

```bash
browse-mcp
```

## 可用工具

| 工具 | 描述 |
|------|-------------|
| `paper_search` | 在多个来源中搜索内容 |
| `paper_download` | 下载内容文件并返回文件路径 |
| `paper_read` | 从文件中提取和阅读文本内容 |

## 超越学术论文

虽然 Browse MCP 最初是一个学术论文搜索工具，但现在它通过插件系统支持**任何内容类型**。以下是一些您可以做的事情：

### 社交媒体插件

安装社交媒体插件以从 GitHub、Twitter、知乎和小红书等平台搜索内容：

```bash
pip install browse-mcp-plugin-social-media
```

然后搜索社交媒体内容：

```python
# 搜索 GitHub 仓库
paper_search([{"searcher": "github", "query": "machine learning", "max_results": 10}])

# 搜索 Twitter 帖子
paper_search([{"searcher": "twitter", "query": "#AI", "max_results": 20}])

# 搜索中文平台
paper_search([{"searcher": "zhihu", "query": "人工智能", "max_results": 5}])
```

### 插件架构

Browse MCP 使用 stevedore 进行自动插件发现。任何在 `browse_mcp.searchers` 命名空间中注册的已安装插件都会自动加载：

```
browse-mcp (核心)
    |
    +-- browse-mcp-plugin-social-media (GitHub, Twitter, 知乎...)
    |
    +-- browse-mcp-plugin-news (RSS 源, 新闻站点...)
    |
    +-- your-custom-plugin (您的内容来源...)
```

查看[插件](./plugins/overview)部分了解更多信息。

## 支持的学术平台

### 免费和开放获取

| 来源 | 描述 |
|--------|-------------|
| arXiv | 物理、数学、计算机科学的预印本库 |
| PubMed | 生物医学文献数据库 |
| PubMed Central (PMC) | 免费全文生物医学文章 |
| bioRxiv | 生物学预印本服务器 |
| medRxiv | 健康科学预印本服务器 |
| Semantic Scholar | AI 驱动的研究工具 |
| CrossRef | DOI 注册和元数据提供商 |
| Google Scholar | 学术搜索引擎 |
| CORE | 开放获取研究论文聚合器 |
| IACR | 密码学预印本 |

### 需要 API 密钥

| 来源 | 描述 |
|--------|-------------|
| IEEE Xplore | IEEE 数字图书馆 |
| Scopus | Elsevier 的引文数据库 |
| Springer Link | Springer 的科学出版物 |
| Science Direct | Elsevier 的全文数据库 |

## 下一步

- [安装](./getting-started/installation) - 详细的安装说明
- [快速开始](./getting-started/quick-start) - 2 分钟内快速上手
- [客户端配置](./getting-started/client-configuration) - 配置 Claude Desktop、Cline 等
- [插件概述](./plugins/overview) - 了解插件系统
- [paper_search 工具](./mcp-server/tools/paper-search) - 了解如何搜索内容
