---
sidebar_position: 3
title: "Client Configuration"
description: "Configure Browse MCP for Claude Desktop, Claude Code, Cline, and Zed"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Client Configuration

Browse MCP works with any MCP-compatible client. This guide covers configuration for popular clients.

## Configuration Overview

All MCP clients need the same basic information:
- **Command**: `python` (or full path to Python)
- **Arguments**: `["-m", "browse_mcp"]`
- **Environment variables**: API keys and settings (optional)

<Tabs>
  <TabItem value="claude-desktop" label="Claude Desktop" default>

## Claude Desktop

**Configuration file location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Minimal configuration** (free sources only):

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

**Full configuration** (with optional API keys):

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "SCIENCEDIRECT_API_KEY": "",
        "SPRINGER_API_KEY": "",
        "IEEE_API_KEY": "",
        "SCOPUS_API_KEY": "",
        "CORE_API_KEY": "",
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
        "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

After editing, **restart Claude Desktop** completely for changes to take effect.

  </TabItem>
  <TabItem value="claude-code" label="Claude Code (CLI)">

## Claude Code (CLI)

**Configuration file location:** `~/.config/claude/config.json`

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "SCIENCEDIRECT_API_KEY": "",
        "SPRINGER_API_KEY": "",
        "IEEE_API_KEY": "",
        "SCOPUS_API_KEY": "",
        "CORE_API_KEY": "",
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
        "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

**Verify installation:**

```bash
# Check if browse-mcp is loaded
claude mcp list

# Test the server
claude mcp test browse-mcp
```

  </TabItem>
  <TabItem value="cline" label="Cline (VS Code)">

## Cline (VS Code Extension)

**Method 1: Through VS Code Settings UI**

1. Open VS Code Settings (`Cmd/Ctrl + ,`)
2. Search for "Cline MCP"
3. Click "Edit in settings.json"
4. Add the configuration below

**Method 2: Direct settings.json Edit**

Edit your VS Code settings file:
- **macOS/Linux**: `~/.config/Code/User/settings.json`
- **Windows**: `%APPDATA%\Code\User\settings.json`

```json
{
  "cline.mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "SCIENCEDIRECT_API_KEY": "",
        "SPRINGER_API_KEY": "",
        "IEEE_API_KEY": "",
        "SCOPUS_API_KEY": "",
        "CORE_API_KEY": "",
        "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
        "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

After adding the configuration, reload VS Code.

  </TabItem>
  <TabItem value="zed" label="Zed Editor">

## Zed Editor

**Configuration file location:** `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "browse-mcp": {
      "command": {
        "path": "python",
        "args": ["-m", "browse_mcp"]
      },
      "settings": {
        "env": {
          "SEMANTIC_SCHOLAR_API_KEY": "",
          "SCIENCEDIRECT_API_KEY": "",
          "SPRINGER_API_KEY": "",
          "IEEE_API_KEY": "",
          "SCOPUS_API_KEY": "",
          "CORE_API_KEY": "",
          "BROWSE_MCP_ENABLED_SOURCES": "arxiv,pubmed,pmc,biorxiv,medrxiv,semantic,core,crossref,google_scholar,iacr",
          "BROWSE_MCP_DISABLED_SOURCES": "ieee,scopus,springer,sciencedirect,wos,acm,jstor",
          "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
        }
      }
    }
  }
}
```

  </TabItem>
  <TabItem value="custom" label="Custom Client">

## Custom MCP Client

For other MCP clients, use these connection details:

**Server command:**
```bash
python -m browse_mcp
```

**Transport:** stdio (default)

**Protocol:** MCP 1.0

**Available tools:**
- `browse_search` - Search academic papers
- `browse_download` - Download paper PDFs
- `browse_read` - Extract text from papers

**Environment variables** (all optional):

| Variable | Description |
|----------|-------------|
| `BROWSE_MCP_DOWNLOAD_PATH` | Directory for downloaded PDFs (default: `./downloads`) |
| `BROWSE_MCP_ENABLED_SOURCES` | Comma-separated list of sources to enable |
| `BROWSE_MCP_DISABLED_SOURCES` | Comma-separated list of sources to disable |
| `SEMANTIC_SCHOLAR_API_KEY` | API key for Semantic Scholar |
| `SCIENCEDIRECT_API_KEY` | API key for Science Direct |
| `SPRINGER_API_KEY` | API key for Springer Link |
| `IEEE_API_KEY` | API key for IEEE Xplore |
| `SCOPUS_API_KEY` | API key for Scopus |
| `CORE_API_KEY` | API key for CORE |

  </TabItem>
</Tabs>

## Troubleshooting

### Python Not Found

If you get a "python not found" error, use the full path to Python:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "/usr/local/bin/python3",
      "args": ["-m", "browse_mcp"]
    }
  }
}
```

Find your Python path with:
```bash
which python3
```

### Module Not Found

If you get "No module named browse_mcp", ensure the package is installed in the same Python environment:

```bash
pip install browse-mcp
```

### Server Not Starting

Check the logs in your MCP client. For Claude Desktop on macOS:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

## Next Steps

- [Configuration](../mcp-server/configuration) - Configure sources and API keys
- [browse_search Tool](../mcp-server/tools/paper-search) - Learn search parameters
