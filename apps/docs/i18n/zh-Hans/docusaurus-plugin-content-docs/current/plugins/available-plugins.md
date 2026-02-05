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

从社交媒体平台搜索和检索内容。

```bash
pip install browse-mcp-plugin-social-media
```

| 来源 | 描述 | 需要 API 密钥 |
|--------|-------------|------------------|
| `github` | GitHub 仓库和代码 | 可选（用于更高的速率限制） |
| `twitter` | Twitter/X 帖子 | 是（`TWITTER_BEARER_TOKEN`） |
| `zhihu` | 知乎问答文章 | 可选 |
| `xiaohongshu` | 小红书帖子 | 可选 |

[了解更多关于社交媒体插件](./social-media-plugin)

## 内置来源

这些来源包含在 browse-mcp 核心中，不需要额外安装。

### 学术来源（免费）

| 来源 | 描述 |
|--------|-------------|
| `arxiv` | 物理、数学、计算机科学的预印本库 |
| `pubmed` | MEDLINE 生物医学文献 |
| `pmc` | PubMed Central 全文档案 |
| `biorxiv` | 生物学预印本服务器 |
| `medrxiv` | 健康科学预印本服务器 |
| `semantic` | Semantic Scholar AI 驱动的搜索 |
| `crossref` | CrossRef DOI 元数据 |
| `google_scholar` | Google Scholar 搜索 |
| `core` | CORE 开放获取聚合器 |
| `iacr` | IACR 密码学预印本 |

### 学术来源（高级）

这些需要 API 密钥：

| 来源 | API 密钥变量 |
|--------|-----------------|
| `ieee` | `IEEE_API_KEY` |
| `scopus` | `SCOPUS_API_KEY` |
| `springer` | `SPRINGER_API_KEY` |
| `sciencedirect` | `SCIENCEDIRECT_API_KEY` |

## 社区插件

:::info 即将推出
社区插件将在可用时列在此处。如果您为 Viben 创建了插件，请提交 pull request 将其添加到此列表。
:::

### 创建您自己的插件

有兴趣创建插件？社交媒体插件作为参考实现：

```
backend/plugins/browse-mcp-plugin-social-media/
|-- pyproject.toml              # 带有入口点的包配置
|-- social_media_searchers/
    |-- __init__.py             # 包初始化
    |-- types.py                # SocialPost 数据类
    |-- github.py               # GitHub 搜索器
    |-- twitter.py              # Twitter 搜索器
    |-- zhihu.py                # 知乎搜索器
    |-- xiaohongshu.py          # 小红书搜索器
```

创建插件的关键步骤：

1. **定义您的内容类型**，带有 `to_text()` 方法
2. **实现 `ContentSource[T]`**，包含 `search()`、`download()` 和 `read()` 方法
3. **在 `pyproject.toml` 中注册入口点**
4. **发布到 PyPI** 以便于安装

查看[插件概述](./overview)了解 API 详情。

## 插件创意

以下是社区的一些插件创意：

### 文档站点

| 潜在来源 | 描述 |
|------------------|-------------|
| MDN Web Docs | Mozilla 开发者网络 |
| DevDocs | API 文档浏览器 |
| Read the Docs | 文档托管 |

### 新闻和博客

| 潜在来源 | 描述 |
|------------------|-------------|
| Hacker News | 技术新闻聚合器 |
| RSS Feeds | 通用 RSS 订阅阅读器 |
| Medium | 博客平台 |
| Dev.to | 开发者社区 |

### 代码和技术

| 潜在来源 | 描述 |
|------------------|-------------|
| Stack Overflow | 开发者问答 |
| GitLab | 代码托管平台 |
| npm | JavaScript 包注册表 |
| PyPI | Python 包索引 |

### 其他学术

| 潜在来源 | 描述 |
|------------------|-------------|
| DBLP | 计算机科学书目 |
| NASA ADS | 天体物理数据系统 |
| SSRN | 社会科学研究 |
| PhilPapers | 哲学研究 |

## 提交您的插件

要将您的插件添加到此列表：

1. 创建 GitHub issue 并提供您的插件详情
2. 或提交 pull request 编辑此页面

列出要求：

- 插件必须发布在 PyPI 上
- 必须有文档或 README
- 必须遵循 Viben 插件约定
- 应包含测试

## 下一步

- [安装插件](./installing-plugins) - 如何安装插件
- [社交媒体插件](./social-media-plugin) - 社交媒体详细指南
- [插件配置](./configuration) - 配置插件设置
