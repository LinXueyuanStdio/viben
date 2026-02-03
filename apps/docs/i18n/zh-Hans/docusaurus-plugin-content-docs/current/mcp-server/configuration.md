---
sidebar_position: 2
title: "配置"
description: "配置 Browse MCP 来源、API 密钥、插件和设置"
---

# 配置

Browse MCP 可以使用环境变量进行配置。本页涵盖核心功能和插件的所有可用配置选项。

## 环境变量概述

| 变量 | 描述 | 默认值 |
|----------|-------------|---------|
| `BROWSE_MCP_DOWNLOAD_PATH` | 下载内容的目录 | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | 启用来源的逗号分隔列表 | 所有来源 |
| `BROWSE_MCP_DISABLED_SOURCES` | 禁用来源的逗号分隔列表 | 无 |

## 下载路径

设置保存下载内容的目录：

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "/path/to/downloads"
  }
}
```

如果目录不存在，将自动创建。

## 来源控制

来源控制适用于所有来源，包括插件中的来源。

### 只启用特定来源

使用 `BROWSE_MCP_ENABLED_SOURCES` 只启用特定来源（白名单）：

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,semantic,github"
  }
}
```

只有列出的来源可用。这适用于内置和插件来源。

### 禁用特定来源

使用 `BROWSE_MCP_DISABLED_SOURCES` 禁用特定来源（黑名单）：

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,twitter"
  }
}
```

除了列出的来源外，所有来源都可用。

### 优先级规则

- 如果设置了 `BROWSE_MCP_ENABLED_SOURCES`，它优先
- 如果只设置了 `BROWSE_MCP_DISABLED_SOURCES`，除了列出的来源外所有来源都启用
- 如果两者都未设置，默认启用所有来源

:::tip 推荐配置
对于大多数用户，使用 `BROWSE_MCP_DISABLED_SOURCES` 禁用需要 API 密钥的高级来源：

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor"
  }
}
```
:::

## API 密钥

### 学术来源 API 密钥

| 变量 | 服务 | 获取方式 |
|----------|---------|------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [获取 API 密钥](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [获取 API 密钥](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [获取 API 密钥](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [获取 API 密钥](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [获取 API 密钥](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | Science Direct | [获取 API 密钥](https://dev.elsevier.com/) |
| `WOS_API_KEY` | Web of Science | 需要机构订阅 |

### 插件 API 密钥（社交媒体）

| 变量 | 服务 | 获取方式 |
|----------|---------|------------|
| `GITHUB_TOKEN` | GitHub | [个人访问令牌](https://github.com/settings/tokens) |
| `TWITTER_BEARER_TOKEN` | Twitter/X | [Twitter 开发者门户](https://developer.twitter.com/) |
| `ZHIHU_API_KEY` | 知乎 | 联系平台 |
| `XIAOHONGSHU_API_KEY` | 小红书 | 联系平台 |

### 免费 vs 高级来源

**免费来源**（不需要 API 密钥）：
- arxiv, pubmed, pmc, biorxiv, medrxiv
- google_scholar, iacr, crossref, researchgate
- github（有速率限制）

**可选 API 密钥的免费来源**（有密钥时速率限制更高）：
- `semantic` - 无密钥可用，使用 `SEMANTIC_SCHOLAR_API_KEY` 获得更高限制
- `core` - 需要 `CORE_API_KEY`
- `github` - 无密钥可用，使用 `GITHUB_TOKEN` 获得更高限制

**高级来源**（需要 API 密钥）：
- `ieee` - 需要 `IEEE_API_KEY`
- `scopus` - 需要 `SCOPUS_API_KEY`
- `springer` - 需要 `SPRINGER_API_KEY`
- `sciencedirect` - 需要 `SCIENCEDIRECT_API_KEY`
- `wos` - 需要 `WOS_API_KEY` 和机构订阅
- `twitter` - 需要 `TWITTER_BEARER_TOKEN`

## 可用来源名称

### 内置学术来源

| 来源名称 | 类型 | 描述 |
|-------------|------|-------------|
| `arxiv` | 免费 | 物理、数学、计算机科学的预印本库 |
| `pubmed` | 免费 | MEDLINE 生物医学文献 |
| `pmc` | 免费 | PubMed Central 全文档案 |
| `biorxiv` | 免费 | 生物学预印本服务器 |
| `medrxiv` | 免费 | 健康科学预印本服务器 |
| `google_scholar` | 免费 | Google Scholar 搜索 |
| `iacr` | 免费 | IACR 密码学预印本 |
| `semantic` | 免费 | Semantic Scholar（可选 API 密钥） |
| `crossref` | 免费 | CrossRef DOI 元数据 |
| `core` | 免费 | CORE 开放获取（需要 API 密钥） |
| `ieee` | 高级 | IEEE Xplore 数字图书馆 |
| `scopus` | 高级 | Elsevier Scopus 数据库 |
| `springer` | 高级 | Springer 出版物 |
| `sciencedirect` | 高级 | Elsevier ScienceDirect |
| `wos` | 高级 | Web of Science |
| `acm` | 高级 | ACM 数字图书馆 |
| `jstor` | 高级 | JSTOR 档案 |
| `researchgate` | 免费 | ResearchGate 社交网络 |

### 插件来源（社交媒体）

这些来源需要安装 `browse-mcp-plugin-social-media`：

| 来源名称 | 类型 | 描述 |
|-------------|------|-------------|
| `github` | 免费 | GitHub 仓库和代码 |
| `twitter` | 高级 | Twitter/X 帖子（需要 API 密钥） |
| `zhihu` | 免费 | 知乎问答文章 |
| `xiaohongshu` | 免费 | 小红书帖子 |

## 配置示例

### 最小配置（仅免费来源）

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

### 使用 Semantic Scholar API 密钥

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "your-api-key-here",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### 学术 + 社交媒体

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "GITHUB_TOKEN": "ghp_your_github_token",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### 完整配置（所有来源）

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "CORE_API_KEY": "your-key",
        "IEEE_API_KEY": "your-key",
        "SCOPUS_API_KEY": "your-key",
        "SPRINGER_API_KEY": "your-key",
        "SCIENCEDIRECT_API_KEY": "your-key",
        "GITHUB_TOKEN": "ghp_your_token",
        "TWITTER_BEARER_TOKEN": "your_bearer_token",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### 研究重点（医学/生物学）

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_ENABLED_SOURCES": "pubmed,pmc,biorxiv,medrxiv,semantic",
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "BROWSE_MCP_DOWNLOAD_PATH": "./medical-papers"
      }
    }
  }
}
```

### 计算机科学重点

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,semantic,ieee,acm,github",
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "IEEE_API_KEY": "your-key",
        "GITHUB_TOKEN": "ghp_your_token",
        "BROWSE_MCP_DOWNLOAD_PATH": "./cs-papers"
      }
    }
  }
}
```

### 仅社交媒体

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_ENABLED_SOURCES": "github,twitter,zhihu",
        "GITHUB_TOKEN": "ghp_your_token",
        "TWITTER_BEARER_TOKEN": "your_bearer_token",
        "BROWSE_MCP_DOWNLOAD_PATH": "./social-content"
      }
    }
  }
}
```

## 故障排除

### 来源不可用

如果某个来源不可用：

1. 检查它是否在 `BROWSE_MCP_DISABLED_SOURCES` 中
2. 检查是否设置了 `BROWSE_MCP_ENABLED_SOURCES` 并包含该来源
3. 对于高级来源，验证 API 密钥是否设置
4. 对于插件来源，验证插件是否已安装：`pip show browse-mcp-plugin-social-media`

### API 速率限制

如果您遇到速率限制：

- **Semantic Scholar**：添加 `SEMANTIC_SCHOLAR_API_KEY` 以获得更高限制
- **CORE**：从 [core.ac.uk](https://core.ac.uk/services/api) 获取免费 API 密钥
- **Google Scholar**：可能会被限速；使用其他来源作为替代
- **GitHub**：添加 `GITHUB_TOKEN` 以获得每小时 5000 个请求而不是 60 个

### 下载缺失

如果下载的文件丢失：

1. 检查 `BROWSE_MCP_DOWNLOAD_PATH` 是否可写
2. 验证目录存在或可以创建
3. 检查响应中的错误消息

### 插件未加载

如果插件来源不可用：

1. 验证插件是否已安装：`pip list | grep browse-mcp`
2. 检查加载错误：`browse-mcp --debug`
3. 验证入口点：`python -c "from stevedore import ExtensionManager; print([e.name for e in ExtensionManager('browse_mcp.searchers')])"`

## 下一步

- [客户端配置](../getting-started/client-configuration) - 配置您的 MCP 客户端
- [browse_search 工具](./tools/browse-search) - 了解搜索参数
- [插件配置](../plugins/configuration) - 高级插件设置
