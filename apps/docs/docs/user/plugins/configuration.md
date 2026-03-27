---
sidebar_position: 5
title: "Plugin Configuration"
description: "Configure Viben plugins using environment variables and settings"
---

# Plugin Configuration

This page covers configuration options for Viben plugins, including environment variables, data source control, and API keys.

## Environment Variables

### Core Variables

These variables apply to all data sources (built-in and plugins):

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSE_MCP_DOWNLOAD_PATH` | Directory for downloaded content | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | Enabled data sources (comma-separated) | All |
| `BROWSE_MCP_DISABLED_SOURCES` | Disabled data sources (comma-separated) | None |

### Data Source Control

#### Enable Only Specific Data Sources

Use `BROWSE_MCP_ENABLED_SOURCES` to create a whitelist:

```bash
export BROWSE_MCP_ENABLED_SOURCES="arxiv,pubmed,github,twitter"
```

Only the listed data sources will be available. All other data sources (including those from plugins) will be disabled.

#### Disable Specific Data Sources

Use `BROWSE_MCP_DISABLED_SOURCES` to create a blacklist:

```bash
export BROWSE_MCP_DISABLED_SOURCES="ieee,scopus,zhihu,xiaohongshu"
```

All data sources except the listed ones will be available.

#### Priority Rules

1. If `BROWSE_MCP_ENABLED_SOURCES` is set, it takes precedence (whitelist mode)
2. If only `BROWSE_MCP_DISABLED_SOURCES` is set, it acts as a blacklist
3. If neither is set, all installed data sources are enabled

### Plugin-Specific API Keys

#### Social Media Plugin

| Variable | Service | How to Obtain |
|----------|---------|---------------|
| `GITHUB_TOKEN` | GitHub | [Personal Access Token](https://github.com/settings/tokens) |
| `TWITTER_BEARER_TOKEN` | Twitter/X | [Twitter Developer Platform](https://developer.twitter.com/) |
| `ZHIHU_API_KEY` | Zhihu | Contact platform |
| `XIAOHONGSHU_API_KEY` | Xiaohongshu | Contact platform |

#### Academic Data Sources

| Variable | Service | How to Obtain |
|----------|---------|---------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [Semantic Scholar API](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [CORE API](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [IEEE Developer](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [Elsevier Developer](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [Springer Developer](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | ScienceDirect | [Elsevier Developer](https://dev.elsevier.com/) |

## Configuration Examples

### MCP Client Configuration

#### Claude Desktop

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "/Users/you/papers",
        "GITHUB_TOKEN": "ghp_your_token_here",
        "TWITTER_BEARER_TOKEN": "your_bearer_token",
        "SEMANTIC_SCHOLAR_API_KEY": "your_api_key"
      }
    }
  }
}
```

#### Claude Code

In `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads",
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

#### Cline (VS Code)

In VS Code settings:

```json
{
  "cline.mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Use Case Configurations

#### Academic Research Only

Disable all social media data sources:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "BROWSE_MCP_DISABLED_SOURCES": "github,twitter,zhihu,xiaohongshu",
        "SEMANTIC_SCHOLAR_API_KEY": "your-key",
        "BROWSE_MCP_DOWNLOAD_PATH": "./papers"
      }
    }
  }
}
```

#### Social Media Focus

Enable only social media data sources:

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "github,twitter,zhihu",
    "GITHUB_TOKEN": "ghp_your_token",
    "TWITTER_BEARER_TOKEN": "your_bearer_token",
    "BROWSE_MCP_DOWNLOAD_PATH": "./social-content"
  }
}
```

#### Full Stack (Academic + Social)

Enable all data sources with appropriate keys:

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "./content",
    "SEMANTIC_SCHOLAR_API_KEY": "your-key",
    "GITHUB_TOKEN": "ghp_your_token",
    "TWITTER_BEARER_TOKEN": "your_bearer_token"
  }
}
```

#### Computer Science Research

Focus on CS-related data sources:

```json
{
  "env": {
    "BROWSE_MCP_ENABLED_SOURCES": "arxiv,semantic,github,ieee,acm",
    "SEMANTIC_SCHOLAR_API_KEY": "your-key",
    "IEEE_API_KEY": "your-key",
    "GITHUB_TOKEN": "ghp_your_token",
    "BROWSE_MCP_DOWNLOAD_PATH": "./cs-research"
  }
}
```

## Hierarchical Data Source Names

Data sources can be referenced by flat or hierarchical names:

| Flat Name | Hierarchical Name | Provider |
|-----------|-------------------|----------|
| `arxiv` | `academic/arxiv` | academic |
| `pubmed` | `academic/pubmed` | academic |
| `github` | `social/github` | social |
| `twitter` | `social/twitter` | social |
| `ieee` | `publisher/ieee` | publisher |

In environment variables, use flat names:

```bash
# Correct
export BROWSE_MCP_ENABLED_SOURCES="arxiv,github,twitter"

# Also works but not recommended
export BROWSE_MCP_ENABLED_SOURCES="academic/arxiv,social/github,social/twitter"
```

## Debugging Configuration

### Check Loaded Data Sources

Run with debug logging to see loaded data sources:

```bash
browse-mcp --debug
```

Output shows:

```
INFO     Loading searcher plugins from namespace: browse_mcp.searchers
DEBUG    Loaded searcher plugin: arxiv (academic/arxiv)
DEBUG    Loaded searcher plugin: github (social/github)
INFO     Successfully loaded 15 searcher plugins: arxiv, github, pubmed...
INFO     Enabled sources: arxiv, github, pubmed...
```

### Check Environment Variables

Verify environment variables are set:

```bash
# Unix/macOS
echo $BROWSE_MCP_ENABLED_SOURCES
echo $GITHUB_TOKEN

# Windows PowerShell
echo $env:BROWSE_MCP_ENABLED_SOURCES
echo $env:GITHUB_TOKEN
```

### Test API Keys

Test individual API keys:

```python
# Test GitHub token
import os
import httpx

token = os.getenv("GITHUB_TOKEN")
response = httpx.get(
    "https://api.github.com/user",
    headers={"Authorization": f"token {token}"}
)
print(response.json())
```

## Troubleshooting

### Data Source Not Available

1. **Check if plugin is installed**:
   ```bash
   pip show browse-mcp-plugin-social-media
   ```

2. **Check if data source is enabled**:
   - Not in `BROWSE_MCP_DISABLED_SOURCES`
   - In `BROWSE_MCP_ENABLED_SOURCES` (if set)

3. **Check for loading errors**:
   ```bash
   browse-mcp --debug
   ```

### API Key Not Working

1. **Verify environment variable is set**:
   ```bash
   echo $GITHUB_TOKEN
   ```

2. **Check key permissions**:
   - GitHub: Ensure token has required scopes
   - Twitter: Verify app has correct access level

3. **Test the key directly** with a simple API call

### Rate Limits

If you encounter rate limits:

1. Add or upgrade API keys
2. Reduce `max_results` in queries
3. Add delays between searches
4. Disable unnecessary data sources

## Next Steps

- [Plugin Overview](./overview) - Learn about the plugin system
- [Installing Plugins](./installing-plugins) - Installation guide
- [Available Plugins](./available-plugins) - Browse available plugins
- [MCP Configuration](../mcp/configuration) - Core configuration options
