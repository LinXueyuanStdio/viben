---
sidebar_position: 1
title: "Plugin Overview"
description: "Learn about the Viben plugin system and ContentSource API"
---

# Plugin Overview

The Viben plugin system is an important extension mechanism for the **Agent Swarm x Code Evolution** platform. Through plugins, agent swarms can access a wider range of knowledge sources and tools, supporting:

- **Idea Generation** - Obtain inspiration and knowledge from diverse data sources
- **FileEvo** - Provide reference materials and best practices for code optimization
- **Agent Swarm** - Extend the toolset and capability boundaries of agents

## What is a Plugin?

A plugin is a Python package that adds new content sources to Viben. After installing a plugin, its data sources are automatically discovered and can be used through the same `browse_search`, `browse_download`, and `browse_read` tools, providing a unified knowledge acquisition interface for agent swarms.

```
browse-mcp (core)
    |
    +-- Built-in data sources (arxiv, pubmed, semantic...)
    |
    +-- browse-mcp-plugin-social-media (github, twitter, zhihu...)
    |
    +-- browse-mcp-plugin-news (rss, hackernews...)
    |
    +-- Your custom plugin (your data sources...)
```

## How Plugins Work

### Stevedore Plugin Discovery

Viben uses [stevedore](https://docs.openstack.org/stevedore/) for plugin discovery. When the server starts:

1. Stevedore scans all installed packages for `browse_mcp.searchers` entry points
2. Each registered entry point is loaded and instantiated
3. Data sources become available for search, download, and read

This means you don't need to modify any configuration files - just install the plugin and restart the server.

### Entry Point Registration

Plugins register their data sources in `pyproject.toml`:

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

## ContentSource API

All plugins implement the `ContentSource[T]` interface, where `T` is the content type they return.

### Generic Content Source

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

### Paper Data Source

For academic paper data sources, extend `PaperSource`:

```python
from browse_mcp.types import PaperSource, Paper

class MyPaperSource(PaperSource):
    def search(self, query: str, **kwargs) -> List[Paper]:
        # Return a list of Paper objects
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
# Search any data source
browse_search([{"searcher": "github", "query": "machine learning"}])

# Download any content
browse_download(searcher="github", paper_id="owner/repo")

# Read any content
browse_read(searcher="github", paper_id="owner/repo")
```

### Data Source Naming

Data sources use flat names like `arxiv`, `github`, `twitter`. The plugin system also supports hierarchical naming:

| Flat Name | Hierarchical Name |
|-----------|-------------------|
| `arxiv` | `academic/arxiv` |
| `github` | `social/github` |
| `twitter` | `social/twitter` |

Both formats work, but flat names are recommended for simplicity.

## Plugin Benefits

### For Users

- **Easy Installation** - Just `pip install` and restart
- **Consistent Interface** - Same tools for all content types
- **Selective Data Sources** - Enable/disable individual data sources via environment variables
- **Enhanced Agent Swarm** - Provide richer knowledge sources for agent swarms

### For Developers

- **Type-Safe API** - Generic `ContentSource[T]` with type hints
- **Automatic Discovery** - No need to edit configuration files
- **Independent Development** - Plugins can be developed and released independently
- **FileEvo Integration** - Plugin data can serve as reference input for code optimization

## Next Steps

- [Installing Plugins](./installing-plugins) - How to install and manage plugins
- [Available Plugins](./available-plugins) - List of official and community plugins
- [Social Media Plugin](./social-media-plugin) - Detailed guide for the social media plugin
- [Plugin Configuration](./configuration) - Configure plugin-specific settings
