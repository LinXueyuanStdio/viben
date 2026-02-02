---
sidebar_position: 1
title: "插件概述"
description: "了解 Browse MCP 插件系统和 ContentSource API"
---

# 插件概述

Browse MCP 使用强大的插件系统，允许您将其功能扩展到学术论文之外。本页解释插件的工作原理以及您可以用它们做什么。

## 什么是插件？

插件是为 Browse MCP 添加新内容来源的 Python 包。当您安装插件时，其来源会被自动发现，并可通过相同的 `paper_search`、`paper_download` 和 `paper_read` 工具使用。

```
browse-mcp (核心)
    |
    +-- 内置来源 (arxiv, pubmed, semantic...)
    |
    +-- browse-mcp-plugin-social-media (github, twitter, zhihu...)
    |
    +-- browse-mcp-plugin-news (rss, hackernews...)
    |
    +-- your-custom-plugin (您的来源...)
```

## 插件工作原理

### Stevedore 插件发现

Browse MCP 使用 [stevedore](https://docs.openstack.org/stevedore/) 进行插件发现。当服务器启动时：

1. Stevedore 扫描所有已安装的包，查找 `browse_mcp.searchers` 入口点
2. 每个注册的入口点都被加载和实例化
3. 这些来源可用于搜索、下载和阅读

这意味着您不需要修改任何配置文件 - 只需安装插件并重启服务器即可。

### 入口点注册

插件在 `pyproject.toml` 中注册其来源：

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
github = "my_plugin.github:GithubSearcher"
twitter = "my_plugin.twitter:TwitterSearcher"
```

或在 `setup.py` 中：

```python
entry_points={
    'browse_mcp.searchers': [
        'github = my_plugin.github:GithubSearcher',
        'twitter = my_plugin.twitter:TwitterSearcher',
    ],
}
```

## ContentSource API

所有插件都实现 `ContentSource[T]` 接口，其中 `T` 是它们返回的内容类型。

### 通用内容来源

对于非论文内容，实现 `ContentSource[T]`：

```python
from dataclasses import dataclass
from typing import List, Optional
from browse_mcp.types import ContentSource

@dataclass
class SocialPost:
    post_id: str
    title: str
    content: str
    author: str
    platform: str
    url: str

    def to_text(self) -> str:
        return f"Platform: {self.platform}\nTitle: {self.title}\nContent: {self.content}"

class TwitterSearcher(ContentSource[SocialPost]):
    def search(self, query: str, **kwargs) -> List[SocialPost]:
        # 搜索实现
        pass

    def download(self, content_id: str, save_path: str) -> str:
        # 下载实现
        pass

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        # 读取实现
        pass
```

### 论文来源

对于学术论文来源，扩展 `PaperSource`：

```python
from browse_mcp.types import PaperSource, Paper

class MyPaperSource(PaperSource):
    def search(self, query: str, **kwargs) -> List[Paper]:
        # 返回 Paper 对象列表
        pass

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        # 下载并返回文件路径
        pass

    def read_paper(
        self,
        paper_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        # 提取并返回文本
        pass
```

## 关键概念

### 内容类型

每个插件定义自己的内容类型，带有 `to_text()` 方法：

| 插件 | 内容类型 | 字段 |
|--------|--------------|--------|
| 核心 | `Paper` | title, authors, abstract, doi, pdf_url... |
| 社交媒体 | `SocialPost` | title, content, author, platform, likes... |
| 自定义 | 您的类型 | 您的字段... |

### 统一工具

无论内容类型如何，用户都通过相同的工具进行交互：

```python
# 搜索任何来源
paper_search([{"searcher": "github", "query": "machine learning"}])

# 下载任何内容
paper_download(searcher="github", paper_id="owner/repo")

# 阅读任何内容
paper_read(searcher="github", paper_id="owner/repo")
```

### 来源命名

来源使用扁平名称，如 `arxiv`、`github`、`twitter`。插件系统还支持层级命名：

| 扁平名称 | 层级名称 |
|-----------|-------------------|
| `arxiv` | `academic/arxiv` |
| `github` | `social/github` |
| `twitter` | `social/twitter` |

两种格式都可以工作，但建议使用扁平名称以简化操作。

## 插件优势

### 对于用户

- **易于安装** - 只需 `pip install` 并重启
- **一致的接口** - 所有内容类型使用相同的工具
- **选择性来源** - 通过环境变量启用/禁用单个来源

### 对于开发者

- **类型安全的 API** - 带有类型提示的泛型 `ContentSource[T]`
- **自动发现** - 无需编辑配置文件
- **独立开发** - 插件可以单独开发和发布

## 下一步

- [安装插件](./installing-plugins) - 如何安装和管理插件
- [可用插件](./available-plugins) - 官方和社区插件列表
- [社交媒体插件](./social-media-plugin) - 社交媒体插件详细指南
- [插件配置](./configuration) - 配置插件特定设置
