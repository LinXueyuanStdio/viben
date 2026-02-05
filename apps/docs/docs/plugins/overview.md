---
sidebar_position: 1
title: "Plugin Overview"
description: "Understanding the Viben plugin system and ContentSource API"
---

# Plugin Overview

Viben uses a powerful plugin system that allows you to extend its capabilities beyond academic papers. This page explains how plugins work and what you can do with them.

## What are Plugins?

Plugins are Python packages that add new content sources to Viben. When you install a plugin, its sources are automatically discovered and become available through the same `browse_search`, `browse_download`, and `browse_read` tools.

```
browse-mcp (core)
    |
    +-- Built-in sources (arxiv, pubmed, semantic...)
    |
    +-- browse-mcp-plugin-social-media (github, twitter, zhihu...)
    |
    +-- browse-mcp-plugin-news (rss, hackernews...)
    |
    +-- your-custom-plugin (your sources...)
```

## How Plugins Work

### Stevedore Plugin Discovery

Viben uses [stevedore](https://docs.openstack.org/stevedore/) for plugin discovery. When the server starts:

1. Stevedore scans all installed packages for `browse_mcp.searchers` entry points
2. Each registered entry point is loaded and instantiated
3. The sources become available for searching, downloading, and reading

This means you do not need to modify any configuration files - just install the plugin and restart the server.

### Entry Point Registration

Plugins register their sources in `pyproject.toml`:

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
github = "my_plugin.github:GithubSearcher"
twitter = "my_plugin.twitter:TwitterSearcher"
```

Or in `setup.py`:

```python
entry_points={
    'browse_mcp.searchers': [
        'github = my_plugin.github:GithubSearcher',
        'twitter = my_plugin.twitter:TwitterSearcher',
    ],
}
```

## The ContentSource API

All plugins implement the `ContentSource[T]` interface, where `T` is the content type they return.

### Generic Content Sources

For non-paper content, implement `ContentSource[T]`:

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
        # Search implementation
        pass

    def download(self, content_id: str, save_path: str) -> str:
        # Download implementation
        pass

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        # Read implementation
        pass
```

### Paper Sources

For academic paper sources, extend `PaperSource`:

```python
from browse_mcp.types import PaperSource, Paper

class MyPaperSource(PaperSource):
    def search(self, query: str, **kwargs) -> List[Paper]:
        # Return list of Paper objects
        pass

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        # Download and return file path
        pass

    def read_paper(
        self,
        paper_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        # Extract and return text
        pass
```

## Key Concepts

### Content Types

Each plugin defines its own content type with a `to_text()` method:

| Plugin | Content Type | Fields |
|--------|--------------|--------|
| Core | `Paper` | title, authors, abstract, doi, pdf_url... |
| Social Media | `SocialPost` | title, content, author, platform, likes... |
| Custom | Your type | Your fields... |

### Unified Tools

Regardless of content type, users interact through the same tools:

```python
# Search any source
browse_search([{"searcher": "github", "query": "machine learning"}])

# Download any content
browse_download(searcher="github", paper_id="owner/repo")

# Read any content
browse_read(searcher="github", paper_id="owner/repo")
```

### Source Naming

Sources use flat names like `arxiv`, `github`, `twitter`. The plugin system also supports hierarchical naming:

| Flat Name | Hierarchical Name |
|-----------|-------------------|
| `arxiv` | `academic/arxiv` |
| `github` | `social/github` |
| `twitter` | `social/twitter` |

Both formats work, but flat names are recommended for simplicity.

## Plugin Benefits

### For Users

- **Easy installation** - Just `pip install` and restart
- **Consistent interface** - Same tools for all content types
- **Selective sources** - Enable/disable individual sources via environment variables

### For Developers

- **Type-safe API** - Generic `ContentSource[T]` with type hints
- **Auto-discovery** - No configuration files to edit
- **Independent development** - Plugins can be developed and released separately

## Next Steps

- [Installing Plugins](./installing-plugins) - How to install and manage plugins
- [Available Plugins](./available-plugins) - List of official and community plugins
- [Social Media Plugin](./social-media-plugin) - Detailed guide for the social media plugin
- [Plugin Configuration](./configuration) - Configure plugin-specific settings
