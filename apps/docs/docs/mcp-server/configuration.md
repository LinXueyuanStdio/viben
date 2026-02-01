---
sidebar_position: 2
title: "Configuration"
description: "Configure Browse MCP sources, API keys, and settings"
---

# Configuration

Browse MCP can be configured using environment variables. This page covers all available configuration options.

## Environment Variables Overview

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSE_MCP_DOWNLOAD_PATH` | Directory for downloaded PDFs | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | Comma-separated list of enabled sources | All sources |
| `BROWSE_MCP_DISABLED_SOURCES` | Comma-separated list of disabled sources | None |

## Download Path

Set the directory where downloaded PDFs are saved:

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "/path/to/downloads"
  }
}
```

The directory is created automatically if it does not exist.

## Source Control

### Enable Specific Sources Only

Use `BROWSE_MCP_ENABLED_SOURCES` to enable only specific sources (whitelist):

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,semantic"
  }
}
```

Only `arxiv`, `pubmed`, and `semantic` will be available.

### Disable Specific Sources

Use `BROWSE_MCP_DISABLED_SOURCES` to disable specific sources (blacklist):

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect"
  }
}
```

All sources except the listed ones will be available.

### Priority Rules

- If `BROWSE_MCP_ENABLED_SOURCES` is set, it takes precedence
- If only `BROWSE_MCP_DISABLED_SOURCES` is set, all sources except listed ones are enabled
- If neither is set, all sources are enabled by default

:::tip Recommended Configuration
For most users, use `BROWSE_MCP_DISABLED_SOURCES` to disable premium sources that require API keys:

```json
{
  "env": {
    "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor"
  }
}
```
:::

## API Keys

### API Key Variables

| Variable | Service | How to Get |
|----------|---------|------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [Get API Key](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [Get API Key](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [Get API Key](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [Get API Key](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [Get API Key](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | Science Direct | [Get API Key](https://dev.elsevier.com/) |
| `WOS_API_KEY` | Web of Science | Requires institutional subscription |

### Free vs Premium Sources

**Free sources** (no API key required):
- arxiv, pubmed, pmc, biorxiv, medrxiv
- google_scholar, iacr, crossref, researchgate

**Free with optional API key** (higher rate limits with key):
- `semantic` - Works without key, higher limits with `SEMANTIC_SCHOLAR_API_KEY`
- `core` - Requires `CORE_API_KEY`

**Premium sources** (API key required):
- `ieee` - Requires `IEEE_API_KEY`
- `scopus` - Requires `SCOPUS_API_KEY`
- `springer` - Requires `SPRINGER_API_KEY`
- `sciencedirect` - Requires `SCIENCEDIRECT_API_KEY`
- `wos` - Requires `WOS_API_KEY` and institutional subscription

## Available Source Names

| Source Name | Type | Description |
|-------------|------|-------------|
| `arxiv` | Free | Pre-print repository for physics, mathematics, CS |
| `pubmed` | Free | Biomedical literature from MEDLINE |
| `pmc` | Free | PubMed Central full-text archive |
| `biorxiv` | Free | Pre-print server for biology |
| `medrxiv` | Free | Pre-print server for health sciences |
| `google_scholar` | Free | Google Scholar search |
| `iacr` | Free | IACR cryptology pre-prints |
| `semantic` | Free | Semantic Scholar (optional API key) |
| `crossref` | Free | CrossRef DOI metadata |
| `core` | Free | CORE open access (requires API key) |
| `ieee` | Premium | IEEE Xplore digital library |
| `scopus` | Premium | Elsevier Scopus database |
| `springer` | Premium | Springer publications |
| `sciencedirect` | Premium | Elsevier ScienceDirect |
| `wos` | Premium | Web of Science |
| `acm` | Premium | ACM Digital Library |
| `jstor` | Premium | JSTOR archive |
| `researchgate` | Free | ResearchGate social network |

## Configuration Examples

### Minimal (Free Sources Only)

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

### Full Configuration (All Sources)

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "CORE_API_KEY": "your-key",
        "IEEE_API_KEY": "your-key",
        "SCOPUS_API_KEY": "your-key",
        "SPRINGER_API_KEY": "your-key",
        "SCIENCEDIRECT_API_KEY": "your-key",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

### Research-Focused (Medical/Biology)

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

### Computer Science Focused

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,semantic,ieee,acm",
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "IEEE_API_KEY": "your-key",
        "BROWSE_MCP_DOWNLOAD_PATH": "./cs-papers"
      }
    }
  }
}
```

## Troubleshooting

### Source Not Available

If a source is not available:

1. Check if it is in `BROWSE_MCP_DISABLED_SOURCES`
2. Check if `BROWSE_MCP_ENABLED_SOURCES` is set and includes the source
3. For premium sources, verify the API key is set

### API Rate Limits

If you hit rate limits:

- **Semantic Scholar**: Add `SEMANTIC_SCHOLAR_API_KEY` for higher limits
- **CORE**: Get a free API key from [core.ac.uk](https://core.ac.uk/services/api)
- **Google Scholar**: May be rate-limited; use other sources as alternatives

### Missing Downloads

If downloaded files are missing:

1. Check `BROWSE_MCP_DOWNLOAD_PATH` is writable
2. Verify the directory exists or can be created
3. Check for error messages in the response

## Next Steps

- [Client Configuration](../getting-started/client-configuration) - Configure your MCP client
- [paper_search Tool](./tools/paper-search) - Learn search parameters
