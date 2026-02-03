---
sidebar_position: 1
title: "Introduction"
description: "Browse MCP - Search, download, and read any content from extensible sources via MCP plugins"
---

# Browse MCP

**Browse MCP** is a Python-based MCP (Model Context Protocol) server that enables AI assistants to search, download, and read content from any source through an extensible plugin system. Out of the box, it supports 19+ academic databases, and you can extend it to support social media, documentation sites, news feeds, and more.

## Key Features

- **Multi-Source Support** - Search and download content from 19+ built-in academic sources including arXiv, PubMed, Semantic Scholar, and more. Extend with plugins for any content type.

- **Extensible Plugin System** - Add new content sources by installing plugins or creating your own. Use the `ContentSource[T]` API to support any content type beyond academic papers.

- **Unified Interface** - All sources accessible through three consistent tools: `browse_search`, `browse_download`, and `browse_read`.

- **Standardized Output** - Content is returned in a consistent format regardless of source, making it easy for AI assistants to process results.

- **MCP Integration** - Compatible with MCP clients like Claude Desktop, Claude Code, Cline (VS Code), and Zed Editor.

- **Asynchronous Operations** - Efficiently handles concurrent searches and downloads for fast results.

- **Pagination Support** - Read specific pages or page ranges from documents using the `page`, `start_page`, and `end_page` parameters.

## Quick Install

```bash
pip install browse-mcp
```

Then start the server:

```bash
browse-mcp
```

## Available Tools

| Tool | Description |
|------|-------------|
| `browse_search` | Search content across multiple sources |
| `browse_download` | Download content files and return file paths |
| `browse_read` | Extract and read text content from files |

## Beyond Academic Papers

While Browse MCP started as an academic paper search tool, it now supports **any content type** through its plugin system. Here are some examples of what you can do:

### Social Media Plugin

Install the social media plugin to search content from platforms like GitHub, Twitter, Zhihu, and Xiaohongshu:

```bash
pip install browse-mcp-plugin-social-media
```

Then search social media content:

```python
# Search GitHub repositories
browse_search([{"searcher": "github", "query": "machine learning", "max_results": 10}])

# Search Twitter posts
browse_search([{"searcher": "twitter", "query": "#AI", "max_results": 20}])

# Search Chinese platforms
browse_search([{"searcher": "zhihu", "query": "artificial intelligence", "max_results": 5}])
```

### Plugin Architecture

Browse MCP uses stevedore for automatic plugin discovery. Any installed plugin that registers in the `browse_mcp.searchers` namespace is automatically loaded:

```
browse-mcp (core)
    |
    +-- browse-mcp-plugin-social-media (GitHub, Twitter, Zhihu...)
    |
    +-- browse-mcp-plugin-news (RSS feeds, news sites...)
    |
    +-- your-custom-plugin (your content sources...)
```

See the [Plugins](./plugins/overview) section for more information.

## Supported Academic Platforms

### Free and Open Access

| Source | Description |
|--------|-------------|
| arXiv | Pre-print repository for physics, mathematics, CS |
| PubMed | Biomedical literature database |
| PubMed Central (PMC) | Free full-text biomedical articles |
| bioRxiv | Pre-print server for biology |
| medRxiv | Pre-print server for health sciences |
| Semantic Scholar | AI-powered research tool |
| CrossRef | DOI registration and metadata provider |
| Google Scholar | Academic search engine |
| CORE | Open access research papers aggregator |
| IACR | Cryptology pre-prints |

### API Key Required

| Source | Description |
|--------|-------------|
| IEEE Xplore | IEEE's digital library |
| Scopus | Elsevier's citation database |
| Springer Link | Springer's scientific publications |
| Science Direct | Elsevier's full-text database |

## Next Steps

- [Installation](./getting-started/installation) - Detailed installation instructions
- [Quick Start](./getting-started/quick-start) - Get up and running in 2 minutes
- [Client Configuration](./getting-started/client-configuration) - Configure Claude Desktop, Cline, and more
- [Plugins Overview](./plugins/overview) - Learn about the plugin system
- [browse_search Tool](./mcp-server/tools/browse-search) - Learn how to search content
