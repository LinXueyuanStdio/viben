---
sidebar_position: 3
title: "可用插件"
description: "Viben 官方和社区插件列表"
---

# 可用插件

本页列出 Viben 的官方和社区插件。

## 官方插件

这些插件由 Viben 团队维护。

### 社交媒体插件

搜索和获取社交媒体平台的内容。

```bash
pip install browse-mcp-plugin-social-media
```

| 数据源 | 说明 | 需要 API 密钥 |
|--------|------|---------------|
| `github` | GitHub 仓库和代码 | 可选（获得更高速率限制）|
| `twitter` | Twitter/X 帖子 | 是（`TWITTER_BEARER_TOKEN`）|
| `zhihu` | 知乎问答文章 | 可选 |
| `xiaohongshu` | 小红书帖子 | 可选 |

[了解更多关于社交媒体插件](./social-media-plugin)

## 内置数据源

这些数据源包含在 browse-mcp 核心中，无需额外安装。

### 学术数据源（免费）

| 数据源 | 说明 |
|--------|------|
| `arxiv` | 物理、数学、计算机科学预印本 |
| `pubmed` | MEDLINE 生物医学文献 |
| `pmc` | PubMed Central 全文库 |
| `biorxiv` | 生物学预印本服务器 |
| `medrxiv` | 健康科学预印本服务器 |
| `semantic` | Semantic Scholar AI 驱动搜索 |
| `crossref` | CrossRef DOI 元数据 |
| `google_scholar` | Google 学术搜索 |
| `core` | CORE 开放获取聚合器 |
| `iacr` | IACR 密码学预印本 |

### 学术数据源（付费）

这些需要 API 密钥：

| 数据源 | API 密钥变量 |
|--------|--------------|
| `ieee` | `IEEE_API_KEY` |
| `scopus` | `SCOPUS_API_KEY` |
| `springer` | `SPRINGER_API_KEY` |
| `sciencedirect` | `SCIENCEDIRECT_API_KEY` |

## 社区插件

:::info 即将推出
社区插件将在可用时列出。如果你创建了 Viben 插件，请提交 Pull Request 将其添加到此列表。
:::

### 创建你自己的插件

有兴趣创建插件？社交媒体插件可作为参考实现：

```
backend/plugins/browse-mcp-plugin-social-media/
|-- pyproject.toml              # 带入口点的包配置
|-- social_media_searchers/
    |-- __init__.py             # 包初始化
    |-- types.py                # SocialPost 数据类
    |-- github.py               # GitHub 搜索器
    |-- twitter.py              # Twitter 搜索器
    |-- zhihu.py                # 知乎搜索器
    |-- xiaohongshu.py          # 小红书搜索器
```

创建插件的关键步骤：

1. **定义内容类型**，带 `to_text()` 方法
2. **实现 `ContentSource[T]`**，包含 `search()`、`download()` 和 `read()` 方法
3. **在 `pyproject.toml` 中注册入口点**
4. **发布到 PyPI** 以便轻松安装

参阅 [插件概述](./overview) 了解 API 详情。

## 插件创意

以下是一些社区可以实现的插件创意：

### 文档站点

| 潜在数据源 | 说明 |
|------------|------|
| MDN Web Docs | Mozilla 开发者网络 |
| DevDocs | API 文档浏览器 |
| Read the Docs | 文档托管平台 |

### 新闻和博客

| 潜在数据源 | 说明 |
|------------|------|
| Hacker News | 技术新闻聚合 |
| RSS Feeds | 通用 RSS 阅读器 |
| Medium | 博客平台 |
| Dev.to | 开发者社区 |

### 代码和技术

| 潜在数据源 | 说明 |
|------------|------|
| Stack Overflow | 开发者问答 |
| GitLab | 代码托管平台 |
| npm | JavaScript 包仓库 |
| PyPI | Python 包索引 |

### 其他学术

| 潜在数据源 | 说明 |
|------------|------|
| DBLP | 计算机科学书目 |
| NASA ADS | 天体物理数据系统 |
| SSRN | 社会科学研究 |
| PhilPapers | 哲学研究 |

## 提交你的插件

要将你的插件添加到此列表：

1. 创建 GitHub Issue 并提供插件详情
2. 或提交 Pull Request 编辑此页面

列出要求：

- 插件必须发布到 PyPI
- 必须有文档或 README
- 必须遵循 Viben 插件约定
- 应包含测试

## 下一步

- [安装插件](./installing-plugins) - 如何安装插件
- [社交媒体插件](./social-media-plugin) - 详细的社交媒体指南
- [插件配置](./configuration) - 配置插件设置
