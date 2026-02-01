---
sidebar_position: 1
title: "简介"
description: "Browse MCP - 通过 MCP 从 19+ 个来源搜索、下载和阅读学术论文"
---

# Browse MCP

**Browse MCP** 是一个基于 Python 的 MCP（模型上下文协议）服务器，它使 AI 助手能够从 19+ 个学术数据库中搜索、下载和阅读学术论文。它通过三个简单的工具提供了访问研究文献的统一接口。

## 主要特性

- **多源支持** - 从 19+ 个学术数据库搜索和下载论文，包括 arXiv、PubMed、PubMed Central、bioRxiv、medRxiv、Google Scholar、Semantic Scholar、IEEE Xplore 等。

- **统一接口** - 所有平台都可以通过三个一致的工具访问：`paper_search`、`paper_download` 和 `paper_read`。

- **标准化输出** - 无论来源如何，论文都以一致的格式返回，使 AI 助手易于处理结果。

- **MCP 集成** - 与 MCP 客户端兼容，如 Claude Desktop、Claude Code、Cline（VS Code）和 Zed Editor。

- **异步操作** - 高效处理并发搜索和下载，快速获取结果。

- **可扩展插件系统** - 通过 stevedore 创建插件来添加新的学术平台。

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
| `paper_search` | 在多个学术数据库中搜索论文 |
| `paper_download` | 下载论文 PDF 并返回文件路径 |
| `paper_read` | 从论文中提取和阅读文本内容 |

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
- [paper_search 工具](./mcp-server/tools/paper-search) - 了解如何搜索论文
