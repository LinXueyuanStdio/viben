---
sidebar_position: 1
title: "插件概述"
description: "了解 Viben 插件系统和 ContentSource API"
---

# 插件概述

Viben 使用强大的插件系统，让你可以将其能力扩展到学术论文之外。本页解释插件的工作原理以及你可以用它们做什么。

## 什么是插件？

插件是为 Viben 添加新内容源的 Python 包。安装插件后，其数据源会被自动发现，并可通过相同的 `browse_search`、`browse_download` 和 `browse_read` 工具使用。

```
browse-mcp (核心)
    |
    +-- 内置数据源 (arxiv, pubmed, semantic...)
    |
    +-- browse-mcp-plugin-social-media (github, twitter, zhihu...)
    |
    +-- browse-mcp-plugin-news (rss, hackernews...)
    |
    +-- 你的自定义插件 (你的数据源...)
```

## 插件工作原理

### Stevedore 插件发现

Viben 使用 [stevedore](https://docs.openstack.org/stevedore/) 进行插件发现。服务器启动时：

1. Stevedore 扫描所有已安装包中的 `browse_mcp.searchers` 入口点
2. 每个注册的入口点被加载和实例化
3. 数据源变得可用于搜索、下载和阅读

这意味着你不需要修改任何配置文件 - 只需安装插件并重启服务器。

### 入口点注册

插件在 `pyproject.toml` 中注册其数据源：

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

### 通用内容源

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
        # 阅读实现
        pass
```

### 论文数据源

对于学术论文数据源，扩展 `PaperSource`：

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
|------|----------|------|
| 核心 | `Paper` | title, authors, abstract, doi, pdf_url... |
| 社交媒体 | `SocialPost` | title, content, author, platform, likes... |
| 自定义 | 你的类型 | 你的字段... |

### 统一工具

无论内容类型如何，用户都通过相同的工具进行交互：

```python
# 搜索任何数据源
browse_search([{"searcher": "github", "query": "machine learning"}])

# 下载任何内容
browse_download(searcher="github", paper_id="owner/repo")

# 阅读任何内容
browse_read(searcher="github", paper_id="owner/repo")
```

### 数据源命名

数据源使用扁平名称如 `arxiv`、`github`、`twitter`。插件系统也支持层级命名：

| 扁平名称 | 层级名称 |
|----------|----------|
| `arxiv` | `academic/arxiv` |
| `github` | `social/github` |
| `twitter` | `social/twitter` |

两种格式都可用，但推荐使用扁平名称以简化使用。

## 插件优势

### 对用户

- **轻松安装** - 只需 `pip install` 然后重启
- **一致接口** - 所有内容类型使用相同的工具
- **选择性数据源** - 通过环境变量启用/禁用单个数据源

### 对开发者

- **类型安全 API** - 带类型提示的泛型 `ContentSource[T]`
- **自动发现** - 无需编辑配置文件
- **独立开发** - 插件可以独立开发和发布

## 下一步

- [安装插件](./installing-plugins) - 如何安装和管理插件
- [可用插件](./available-plugins) - 官方和社区插件列表
- [社交媒体插件](./social-media-plugin) - 社交媒体插件详细指南
- [插件配置](./configuration) - 配置插件特定设置
