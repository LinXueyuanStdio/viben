---
sidebar_position: 2
title: "MCP 配置"
description: "配置 Viben MCP 服务器的数据源、API 密钥和设置"
---

# MCP 配置

:::info Agent Swarm x Code Evolution
Viben 通过 **Agent Swarm（智能体集群）** 和 **Code Evolution（代码进化）** 实现自主代码迭代优化。MCP 服务器是扩展智能体能力的核心机制，让智能体能够访问外部数据源、工具和服务。

通过配置 MCP 服务器，你可以：
- 为智能体提供学术论文、代码仓库等数据源
- 集成文件系统、数据库等工具
- 扩展智能体的知识和能力边界
:::

Viben MCP 服务器可以通过环境变量进行配置。本页涵盖所有可用的配置选项。

## 环境变量概览

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `BROWSE_MCP_DOWNLOAD_PATH` | 下载内容的保存目录 | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | 启用的数据源（逗号分隔）| 全部 |
| `BROWSE_MCP_DISABLED_SOURCES` | 禁用的数据源（逗号分隔）| 无 |

## 下载路径

设置下载内容的保存目录：

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "/path/to/downloads"
  }
}
```

如果目录不存在，会自动创建。

## 数据源控制

数据源控制适用于所有来源，包括插件提供的数据源。

### 仅启用特定数据源

使用 `BROWSE_MCP_ENABLED_SOURCES` 创建白名单：

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,semantic,github"
  }
}
```

只有列出的数据源可用。这对内置和插件数据源都有效。

### 禁用特定数据源

使用 `BROWSE_MCP_DISABLED_SOURCES` 创建黑名单：

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,twitter"
  }
}
```

除了列出的数据源外，其他所有数据源都可用。

### 优先级规则

- 如果设置了 `BROWSE_MCP_ENABLED_SOURCES`，它优先生效
- 如果只设置了 `BROWSE_MCP_DISABLED_SOURCES`，除列出的外都启用
- 如果都未设置，默认启用所有数据源

:::tip 推荐配置
对于大多数用户，使用 `BROWSE_MCP_DISABLED_SOURCES` 禁用需要 API 密钥的付费数据源：

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor"
  }
}
```
:::

## API 密钥

### 学术数据源 API 密钥

| 变量 | 服务 | 获取方式 |
|------|------|----------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [获取 API 密钥](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [获取 API 密钥](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [获取 API 密钥](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [获取 API 密钥](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [获取 API 密钥](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | ScienceDirect | [获取 API 密钥](https://dev.elsevier.com/) |
| `WOS_API_KEY` | Web of Science | 需要机构订阅 |

### 插件 API 密钥（社交媒体）

| 变量 | 服务 | 获取方式 |
|------|------|----------|
| `GITHUB_TOKEN` | GitHub | [个人访问令牌](https://github.com/settings/tokens) |
| `TWITTER_BEARER_TOKEN` | Twitter/X | [Twitter 开发者平台](https://developer.twitter.com/) |
| `ZHIHU_API_KEY` | 知乎 | 联系平台 |
| `XIAOHONGSHU_API_KEY` | 小红书 | 联系平台 |

### 免费 vs 付费数据源

**免费数据源**（无需 API 密钥）：
- arxiv、pubmed、pmc、biorxiv、medrxiv
- google_scholar、iacr、crossref、researchgate
- github（有速率限制）

**免费但可选 API 密钥**（有密钥可获得更高限制）：
- `semantic` - 无密钥可用，有 `SEMANTIC_SCHOLAR_API_KEY` 限制更高
- `core` - 需要 `CORE_API_KEY`
- `github` - 无密钥 60 请求/小时，有密钥 5000 请求/小时

**付费数据源**（需要 API 密钥）：
- `ieee` - 需要 `IEEE_API_KEY`
- `scopus` - 需要 `SCOPUS_API_KEY`
- `springer` - 需要 `SPRINGER_API_KEY`
- `sciencedirect` - 需要 `SCIENCEDIRECT_API_KEY`
- `wos` - 需要 `WOS_API_KEY` 和机构订阅
- `twitter` - 需要 `TWITTER_BEARER_TOKEN`

## 可用数据源名称

### 内置学术数据源

| 数据源名称 | 类型 | 说明 |
|------------|------|------|
| `arxiv` | 免费 | 物理、数学、计算机科学预印本 |
| `pubmed` | 免费 | MEDLINE 生物医学文献 |
| `pmc` | 免费 | PubMed Central 全文库 |
| `biorxiv` | 免费 | 生物学预印本服务器 |
| `medrxiv` | 免费 | 健康科学预印本服务器 |
| `google_scholar` | 免费 | Google 学术搜索 |
| `iacr` | 免费 | IACR 密码学预印本 |
| `semantic` | 免费 | Semantic Scholar（可选 API 密钥）|
| `crossref` | 免费 | CrossRef DOI 元数据 |
| `core` | 免费 | CORE 开放获取（需要 API 密钥）|
| `ieee` | 付费 | IEEE Xplore 数字图书馆 |
| `scopus` | 付费 | Elsevier Scopus 数据库 |
| `springer` | 付费 | Springer 出版物 |
| `sciencedirect` | 付费 | Elsevier ScienceDirect |
| `wos` | 付费 | Web of Science |
| `acm` | 付费 | ACM 数字图书馆 |
| `jstor` | 付费 | JSTOR 档案 |
| `researchgate` | 免费 | ResearchGate 社交网络 |

### 插件数据源（社交媒体）

这些数据源需要安装 `browse-mcp-plugin-social-media`：

| 数据源名称 | 类型 | 说明 |
|------------|------|------|
| `github` | 免费 | GitHub 仓库和代码 |
| `twitter` | 付费 | Twitter/X 帖子（需要 API 密钥）|
| `zhihu` | 免费 | 知乎问答文章 |
| `xiaohongshu` | 免费 | 小红书帖子 |

## 配置示例

### 最小配置（仅免费数据源）

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

### 带 Semantic Scholar API 密钥

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

### 研究聚焦（医学/生物）

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

### 计算机科学聚焦

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

### 数据源不可用

如果某个数据源不可用：

1. 检查是否在 `BROWSE_MCP_DISABLED_SOURCES` 中
2. 检查 `BROWSE_MCP_ENABLED_SOURCES` 是否设置且包含该数据源
3. 对于付费数据源，验证 API 密钥是否设置
4. 对于插件数据源，验证插件是否安装：`pip show browse-mcp-plugin-social-media`

### API 速率限制

如果遇到速率限制：

- **Semantic Scholar**：添加 `SEMANTIC_SCHOLAR_API_KEY` 获得更高限制
- **CORE**：从 [core.ac.uk](https://core.ac.uk/services/api) 获取免费 API 密钥
- **Google Scholar**：可能被限流；使用其他数据源作为替代
- **GitHub**：添加 `GITHUB_TOKEN` 从 60 请求/小时提升到 5000 请求/小时

### 下载文件缺失

如果下载的文件不见了：

1. 检查 `BROWSE_MCP_DOWNLOAD_PATH` 是否可写
2. 验证目录存在或可以创建
3. 检查响应中的错误信息

### 插件未加载

如果插件数据源不可用：

1. 验证插件已安装：`pip list | grep browse-mcp`
2. 检查加载错误：`browse-mcp --debug`
3. 验证入口点：`python -c "from stevedore import ExtensionManager; print([e.name for e in ExtensionManager('browse_mcp.searchers')])"`

## 下一步

- [客户端配置](../getting-started/client-configuration) - 配置 MCP 客户端
- [browse_search 工具](./tools/browse-search) - 学习搜索参数
- [插件配置](../plugins/configuration) - 高级插件设置
