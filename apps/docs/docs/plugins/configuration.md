---
sidebar_position: 5
title: "Plugin Configuration"
description: "Configure Browse MCP plugins with environment variables and settings"
---

# Plugin Configuration

This page covers configuration options for Browse MCP plugins, including environment variables, source control, and API keys.

## Environment Variables

### Core Variables

These variables apply to all sources (built-in and plugins):

| Variable | Description | Default |
|----------|-------------|---------|
| `BROWSE_MCP_DOWNLOAD_PATH` | Directory for downloaded content | `./downloads` |
| `BROWSE_MCP_ENABLED_SOURCES` | Comma-separated list of enabled sources | All sources |
| `BROWSE_MCP_DISABLED_SOURCES` | Comma-separated list of disabled sources | None |

### Source Control

#### Enable Specific Sources Only

Use `BROWSE_MCP_ENABLED_SOURCES` to create a whitelist:

```bash
export BROWSE_MCP_ENABLED_SOURCES="arxiv,pubmed,github,twitter"
```

Only the listed sources will be available. All others (including from plugins) will be disabled.

#### Disable Specific Sources

Use `BROWSE_MCP_DISABLED_SOURCES` to create a blacklist:

```bash
export BROWSE_MCP_DISABLED_SOURCES="ieee,scopus,zhihu,xiaohongshu"
```

All sources except the listed ones will be available.

#### Priority Rules

1. If `BROWSE_MCP_ENABLED_SOURCES` is set, it takes precedence (whitelist mode)
2. If only `BROWSE_MCP_DISABLED_SOURCES` is set, it acts as a blacklist
3. If neither is set, all installed sources are enabled

### Plugin-Specific API Keys

#### Social Media Plugin

| Variable | Service | How to Get |
|----------|---------|------------|
| `GITHUB_TOKEN` | GitHub | [Personal Access Tokens](https://github.com/settings/tokens) |
| `TWITTER_BEARER_TOKEN` | Twitter/X | [Twitter Developer Portal](https://developer.twitter.com/) |
| `ZHIHU_API_KEY` | Zhihu | Contact platform |
| `XIAOHONGSHU_API_KEY` | Xiaohongshu | Contact platform |

#### Academic Sources

| Variable | Service | How to Get |
|----------|---------|------------|
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar | [Semantic Scholar API](https://www.semanticscholar.org/product/api) |
| `CORE_API_KEY` | CORE | [CORE API](https://core.ac.uk/services/api) |
| `IEEE_API_KEY` | IEEE Xplore | [IEEE Developer](https://developer.ieee.org/) |
| `SCOPUS_API_KEY` | Scopus | [Elsevier Developer](https://dev.elsevier.com/) |
| `SPRINGER_API_KEY` | Springer Link | [Springer Developer](https://dev.springernature.com/) |
| `SCIENCEDIRECT_API_KEY` | Science Direct | [Elsevier Developer](https://dev.elsevier.com/) |

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

In `~/.claude/mcp_settings.json`:

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

Disable all social media sources:

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

Enable only social media sources:

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

Enable everything with appropriate keys:

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

Focus on CS-relevant sources:

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

## Hierarchical Source Names

Sources can be referenced by flat or hierarchical names:

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

### Check Loaded Sources

Run with debug logging to see loaded sources:

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

### Source Not Available

1. **Check if plugin is installed**:
   ```bash
   pip show browse-mcp-plugin-social-media
   ```

2. **Check if source is enabled**:
   - Not in `BROWSE_MCP_DISABLED_SOURCES`
   - In `BROWSE_MCP_ENABLED_SOURCES` (if set)

3. **Check for load errors**:
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

3. **Test key directly** with a simple API call

### Rate Limiting

If you hit rate limits:

1. Add or upgrade API keys
2. Reduce `max_results` in queries
3. Add delays between searches
4. Disable unnecessary sources

## Next Steps

- [Plugin Overview](./overview) - Understanding the plugin system
- [Installing Plugins](./installing-plugins) - Installation guide
- [Available Plugins](./available-plugins) - Browse available plugins
- [Configuration](../mcp-server/configuration) - Core configuration options
