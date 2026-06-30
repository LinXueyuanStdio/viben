---
sidebar_position: 3
title: "Available Plugins"
description: "List of official and community plugins for Viben"
---

# Available Plugins

This page lists official and community plugins for Viben.

## Official Plugins

These plugins are maintained by the Viben team.

### Social Media Plugin

Search and fetch content from social media platforms.

```bash
pip install browse-mcp-plugin-social-media
```

| Data Source | Description | Requires API Key |
|-------------|-------------|------------------|
| `github` | GitHub repositories and code | Optional (for higher rate limits) |
| `twitter` | Twitter/X posts | Yes (`TWITTER_BEARER_TOKEN`) |
| `zhihu` | Zhihu Q&A articles | Optional |
| `xiaohongshu` | Xiaohongshu posts | Optional |

[Learn more about the Social Media Plugin](./social-media-plugin)

## Built-in Data Sources

These data sources are included in the browse-mcp core and require no additional installation.

### Academic Data Sources (Free)

| Data Source | Description |
|-------------|-------------|
| `arxiv` | Physics, mathematics, computer science preprints |
| `pubmed` | MEDLINE biomedical literature |
| `pmc` | PubMed Central full-text repository |
| `biorxiv` | Biology preprint server |
| `medrxiv` | Health sciences preprint server |
| `semantic` | Semantic Scholar AI-powered search |
| `crossref` | CrossRef DOI metadata |
| `google_scholar` | Google Scholar search |
| `core` | CORE open access aggregator |
| `iacr` | IACR cryptography preprints |

### Academic Data Sources (Paid)

These require API keys:

| Data Source | API Key Variable |
|-------------|------------------|
| `ieee` | `IEEE_API_KEY` |
| `scopus` | `SCOPUS_API_KEY` |
| `springer` | `SPRINGER_API_KEY` |
| `sciencedirect` | `SCIENCEDIRECT_API_KEY` |

## Community Plugins

:::info Coming Soon
Community plugins will be listed when available. If you create a Viben plugin, please submit a Pull Request to add it to this list.
:::

### Create Your Own Plugin

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

1. **Define a content type** with a `to_text()` method
2. **Implement `ContentSource[T]`** with `search()`, `download()`, and `read()` methods
3. **Register entry points in `pyproject.toml`**
4. **Publish to PyPI** for easy installation

See [Plugin Overview](./overview) for API details.

## Plugin Ideas

Here are some plugin ideas the community could implement:

### Documentation Sites

| Potential Data Source | Description |
|-----------------------|-------------|
| MDN Web Docs | Mozilla Developer Network |
| DevDocs | API documentation browser |
| Read the Docs | Documentation hosting platform |

### News and Blogs

| Potential Data Source | Description |
|-----------------------|-------------|
| Hacker News | Technology news aggregation |
| RSS Feeds | General RSS reader |
| Medium | Blog platform |
| Dev.to | Developer community |

### Code and Technology

| Potential Data Source | Description |
|-----------------------|-------------|
| Stack Overflow | Developer Q&A |
| GitLab | Code hosting platform |
| npm | JavaScript package repository |
| PyPI | Python Package Index |

### Other Academic

| Potential Data Source | Description |
|-----------------------|-------------|
| DBLP | Computer science bibliography |
| NASA ADS | Astrophysics Data System |
| SSRN | Social science research |
| PhilPapers | Philosophy research |

## Submit Your Plugin

To add your plugin to this list:

1. Create a GitHub Issue with plugin details
2. Or submit a Pull Request to edit this page

Listing requirements:

- Plugin must be published to PyPI
- Must have documentation or README
- Must follow Viben plugin conventions
- Should include tests

## Next Steps

- [Installing Plugins](./installing-plugins) - How to install plugins
- [Social Media Plugin](./social-media-plugin) - Detailed social media guide
- [Plugin Configuration](./configuration) - Configure plugin settings
