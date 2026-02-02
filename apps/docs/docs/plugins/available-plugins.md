---
sidebar_position: 3
title: "Available Plugins"
description: "List of official and community plugins for Browse MCP"
---

# Available Plugins

This page lists official and community plugins for Browse MCP.

## Official Plugins

These plugins are maintained by the Browse MCP team.

### Social Media Plugin

Search and retrieve content from social media platforms.

```bash
pip install browse-mcp-plugin-social-media
```

| Source | Description | API Key Required |
|--------|-------------|------------------|
| `github` | GitHub repositories and code | Optional (for higher rate limits) |
| `twitter` | Twitter/X posts | Yes (`TWITTER_BEARER_TOKEN`) |
| `zhihu` | Zhihu Q&A articles (Chinese) | Optional |
| `xiaohongshu` | Xiaohongshu posts (Chinese) | Optional |

[Learn more about the Social Media Plugin](./social-media-plugin)

## Built-in Sources

These sources are included with browse-mcp core and do not require additional installation.

### Academic Sources (Free)

| Source | Description |
|--------|-------------|
| `arxiv` | Pre-print repository for physics, mathematics, CS |
| `pubmed` | Biomedical literature from MEDLINE |
| `pmc` | PubMed Central full-text archive |
| `biorxiv` | Pre-print server for biology |
| `medrxiv` | Pre-print server for health sciences |
| `semantic` | Semantic Scholar AI-powered search |
| `crossref` | CrossRef DOI metadata |
| `google_scholar` | Google Scholar search |
| `core` | CORE open access aggregator |
| `iacr` | IACR cryptology pre-prints |

### Academic Sources (Premium)

These require API keys:

| Source | API Key Variable |
|--------|-----------------|
| `ieee` | `IEEE_API_KEY` |
| `scopus` | `SCOPUS_API_KEY` |
| `springer` | `SPRINGER_API_KEY` |
| `sciencedirect` | `SCIENCEDIRECT_API_KEY` |

## Community Plugins

:::info Coming Soon
Community plugins will be listed here as they become available. If you have created a plugin for Browse MCP, please submit a pull request to add it to this list.
:::

### Creating Your Own Plugin

Interested in creating a plugin? The social media plugin serves as a reference implementation:

```
backend/plugins/browse-mcp-plugin-social-media/
|-- pyproject.toml              # Package configuration with entry points
|-- social_media_searchers/
    |-- __init__.py             # Package initialization
    |-- types.py                # SocialPost dataclass
    |-- github.py               # GitHub searcher
    |-- twitter.py              # Twitter searcher
    |-- zhihu.py                # Zhihu searcher
    |-- xiaohongshu.py          # Xiaohongshu searcher
```

Key steps to create a plugin:

1. **Define your content type** with a `to_text()` method
2. **Implement `ContentSource[T]`** with `search()`, `download()`, and `read()` methods
3. **Register entry points** in `pyproject.toml`
4. **Publish to PyPI** for easy installation

See the [Plugin Overview](./overview) for API details.

## Plugin Ideas

Here are some plugin ideas for the community:

### Documentation Sites

| Potential Source | Description |
|------------------|-------------|
| MDN Web Docs | Mozilla Developer Network |
| DevDocs | API documentation browser |
| Read the Docs | Documentation hosting |

### News and Blogs

| Potential Source | Description |
|------------------|-------------|
| Hacker News | Tech news aggregator |
| RSS Feeds | Generic RSS feed reader |
| Medium | Blog platform |
| Dev.to | Developer community |

### Code and Technical

| Potential Source | Description |
|------------------|-------------|
| Stack Overflow | Q&A for developers |
| GitLab | Code hosting platform |
| npm | JavaScript package registry |
| PyPI | Python package index |

### Other Academic

| Potential Source | Description |
|------------------|-------------|
| DBLP | Computer science bibliography |
| NASA ADS | Astrophysics Data System |
| SSRN | Social science research |
| PhilPapers | Philosophy research |

## Submit Your Plugin

To add your plugin to this list:

1. Create a GitHub issue with your plugin details
2. Or submit a pull request editing this page

Requirements for listing:

- Plugin must be published on PyPI
- Must have documentation or README
- Must follow Browse MCP plugin conventions
- Should include tests

## Next Steps

- [Installing Plugins](./installing-plugins) - How to install plugins
- [Social Media Plugin](./social-media-plugin) - Detailed social media guide
- [Plugin Configuration](./configuration) - Configure plugin settings
