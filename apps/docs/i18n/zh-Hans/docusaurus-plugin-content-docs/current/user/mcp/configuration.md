---
sidebar_position: 2
title: "MCP Configuration"
description: "Configure Viben MCP server data sources, API keys and settings"
---

# MCP Configuration

## Viben: Agent Swarm x Code Evolution

Viben is an AI-driven code iteration optimization and agent swarm orchestration platform. The MCP server is a key component of the platform, providing knowledge acquisition capabilities for Agent Swarm:

- **FileEvo** - Acquire best practices through academic papers and technical documentation to optimize code iteration
- **Idea Generation** - Gather inspiration from diverse data sources to spark innovative ideas
- **Agent Swarm** - Agent swarms can uniformly call MCP tools for knowledge search

---

## Environment Variable Configuration

The Viben MCP server can be configured through environment variables. This page covers all available configuration options.

## Environment Variables Overview

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSE_MCP_DOWNLOAD_PATH` | Directory for saving downloaded content | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | Enabled data sources (comma-separated) | All |
| `BROWSE_MCP_DISABLED_SOURCES` | Disabled data sources (comma-separated) | None |

## Download Path

Set the directory for saving downloaded content:

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "/path/to/downloads"
  }
}
```

If the directory does not exist, it will be created automatically.

## Data Source Control

Data source control applies to all sources, including those provided by plugins.

### Enable Only Specific Data Sources

Use `BROWSE_MCP_ENABLED_SOURCES` to create a whitelist:

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,semantic,github"
  }
}
```

Only the listed data sources will be available. This works for both built-in and plugin data sources.

### Disable Specific Data Sources

Use `BROWSE_MCP_DISABLED_SOURCES` to create a blacklist:

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,twitter"
  }
}
```

All data sources except those listed will be available.

### Priority Rules

- If `BROWSE_MCP_ENABLED_SOURCES` is set, it takes precedence
- If only `BROWSE_MCP_DISABLED_SOURCES` is set, all except listed sources are enabled
- If neither is set, all data sources are enabled by default

:::tip Recommended Configuration
For most users, use `BROWSE_MCP_DISABLED_SOURCES` to disable paid data sources that require API keys:

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor"
  }
}
```
:::

## API Keys

### Academic Data Source API Keys

| Variable | Service | How to Obtain |
|----------|---------|---------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [Get API Key](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [Get API Key](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [Get API Key](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [Get API Key](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [Get API Key](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | ScienceDirect | [Get API Key](https://dev.elsevier.com/) |
| `WOS_API_KEY` | Web of Science | Requires institutional subscription |

### Plugin API Keys (Social Media)

| Variable | Service | How to Obtain |
|----------|---------|---------------|
| `GITHUB_TOKEN` | GitHub | [Personal Access Token](https://github.com/settings/tokens) |
| `TWITTER_BEARER_TOKEN` | Twitter/X | [Twitter Developer Platform](https://developer.twitter.com/) |
| `ZHIHU_API_KEY` | Zhihu | Contact platform |
| `XIAOHONGSHU_API_KEY` | Xiaohongshu | Contact platform |

### Free vs Paid Data Sources

**Free Data Sources** (no API key required):
- arxiv, pubmed, pmc, biorxiv, medrxiv
- google_scholar, iacr, crossref, researchgate
- github (with rate limits)

**Free but Optional API Key** (higher limits with key):
- `semantic` - Works without key, higher limits with `SEMANTIC_SCHOLAR_API_KEY`
- `core` - Requires `CORE_API_KEY`
- `github` - 60 requests/hour without key, 5000 requests/hour with key

**Paid Data Sources** (require API key):
- `ieee` - Requires `IEEE_API_KEY`
- `scopus` - Requires `SCOPUS_API_KEY`
- `springer` - Requires `SPRINGER_API_KEY`
- `sciencedirect` - Requires `SCIENCEDIRECT_API_KEY`
- `wos` - Requires `WOS_API_KEY` and institutional subscription
- `twitter` - Requires `TWITTER_BEARER_TOKEN`

## Available Data Source Names

### Built-in Academic Data Sources

| Data Source Name | Type | Description |
|------------------|------|-------------|
| `arxiv` | Free | Physics, math, computer science preprints |
| `pubmed` | Free | MEDLINE biomedical literature |
| `pmc` | Free | PubMed Central full-text repository |
| `biorxiv` | Free | Biology preprint server |
| `medrxiv` | Free | Health sciences preprint server |
| `google_scholar` | Free | Google Scholar search |
| `iacr` | Free | IACR cryptography preprints |
| `semantic` | Free | Semantic Scholar (optional API key) |
| `crossref` | Free | CrossRef DOI metadata |
| `core` | Free | CORE open access (requires API key) |
| `ieee` | Paid | IEEE Xplore digital library |
| `scopus` | Paid | Elsevier Scopus database |
| `springer` | Paid | Springer publications |
| `sciencedirect` | Paid | Elsevier ScienceDirect |
| `wos` | Paid | Web of Science |
| `acm` | Paid | ACM Digital Library |
| `jstor` | Paid | JSTOR archive |
| `researchgate` | Free | ResearchGate social network |

### Plugin Data Sources (Social Media)

These data sources require installing `browse-mcp-plugin-social-media`:

| Data Source Name | Type | Description |
|------------------|------|-------------|
| `github` | Free | GitHub repositories and code |
| `twitter` | Paid | Twitter/X posts (requires API key) |
| `zhihu` | Free | Zhihu Q&A articles |
| `xiaohongshu` | Free | Xiaohongshu posts |

## Configuration Examples

### Minimal Configuration (Free Sources Only)

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

### With Semantic Scholar API Key

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

### Academic + Social Media

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

### Research Focus (Medical/Biology)

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

### Computer Science Focus

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

### Social Media Only

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

## Troubleshooting

### Data Source Unavailable

If a data source is unavailable:

1. Check if it's in `BROWSE_MCP_DISABLED_SOURCES`
2. Check if `BROWSE_MCP_ENABLED_SOURCES` is set and includes the data source
3. For paid data sources, verify the API key is set
4. For plugin data sources, verify the plugin is installed: `pip show browse-mcp-plugin-social-media`

### API Rate Limits

If you encounter rate limits:

- **Semantic Scholar**: Add `SEMANTIC_SCHOLAR_API_KEY` for higher limits
- **CORE**: Get a free API key from [core.ac.uk](https://core.ac.uk/services/api)
- **Google Scholar**: May be rate limited; use other data sources as alternatives
- **GitHub**: Add `GITHUB_TOKEN` to increase from 60 requests/hour to 5000 requests/hour

### Downloaded Files Missing

If downloaded files are missing:

1. Check if `BROWSE_MCP_DOWNLOAD_PATH` is writable
2. Verify the directory exists or can be created
3. Check error messages in the response

### Plugin Not Loading

If plugin data sources are unavailable:

1. Verify the plugin is installed: `pip list | grep browse-mcp`
2. Check for loading errors: `browse-mcp --debug`
3. Verify entry points: `python -c "from stevedore import ExtensionManager; print([e.name for e in ExtensionManager('browse_mcp.searchers')])"`

## Next Steps

- [Client Configuration](../getting-started/client-configuration) - Configure MCP client
- [browse_search Tool](./tools/browse-search) - Learn search parameters
- [Plugin Configuration](../plugins/configuration) - Advanced plugin settings
