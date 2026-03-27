---
sidebar_position: 3
title: "Client Configuration"
description: "Configure Viben MCP server for Claude Desktop, Claude Code, Cline, and Zed"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Client Configuration

The Viben MCP server is compatible with any client that supports the MCP protocol. This guide covers configuration methods for popular clients.

## Configuration Overview

All MCP clients require the same basic information:
- **Command**: `python` (or the full path to Python)
- **Arguments**: `["-m", "browse_mcp"]`
- **Environment Variables**: API keys and settings (optional)

<Tabs>
  <TabItem value="claude-desktop" label="Claude Desktop" default>

## Claude Desktop

**Configuration file location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**Minimal configuration** (free data sources only):

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

After editing, **completely restart Claude Desktop** for changes to take effect.

  </TabItem>
  <TabItem value="claude-code" label="Claude Code (CLI)">

## Claude Code (CLI)

**Configuration file location:** `~/.claude/mcp.json`

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

**Method 1: Via VS Code Settings UI**

1. Open VS Code Settings (`Cmd/Ctrl + ,`)
2. Search for "Cline MCP"
3. Click "Edit in settings.json"
4. Add the following configuration

**Method 2: Edit settings.json directly**

Edit the VS Code settings file:
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
  <TabItem value="cursor" label="Cursor">

## Cursor

**Configuration file location:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {
        "SEMANTIC_SCHOLAR_API_KEY": "",
        "BROWSE_MCP_DOWNLOAD_PATH": "./downloads"
      }
    }
  }
}
```

  </TabItem>
  <TabItem value="custom" label="Custom Client">

## Custom MCP Client

For other MCP clients, use the following connection information:

**Server command:**
```bash
python -m browse_mcp
```

**Transport method:** stdio (default)

**Protocol:** MCP 1.0

**Available tools:**
- `browse_search` - Search academic papers
- `browse_download` - Download paper PDFs
- `browse_read` - Extract paper text

**Environment variables** (all optional):

| Variable | Description |
|----------|-------------|
| `BROWSE_MCP_DOWNLOAD_PATH` | PDF download directory (default: `./downloads`) |
| `BROWSE_MCP_ENABLED_SOURCES` | Enabled data sources (comma-separated) |
| `BROWSE_MCP_DISABLED_SOURCES` | Disabled data sources (comma-separated) |
| `SEMANTIC_SCHOLAR_API_KEY` | Semantic Scholar API key |
| `SCIENCEDIRECT_API_KEY` | ScienceDirect API key |
| `SPRINGER_API_KEY` | Springer Link API key |
| `IEEE_API_KEY` | IEEE Xplore API key |
| `SCOPUS_API_KEY` | Scopus API key |
| `CORE_API_KEY` | CORE API key |

  </TabItem>
</Tabs>

## Managing MCP Configuration with Viben Desktop App

If you have the Viben desktop app installed, you can manage MCP server configurations through a graphical interface:

1. Open the Viben desktop app
2. Select a workspace
3. Click on the agent you want to configure (e.g., Claude Code)
4. Add, edit, or delete servers in the MCP server list
5. Changes are automatically saved to the corresponding configuration file

This is more convenient and safer than manually editing JSON files.

## Troubleshooting

### Python Not Found

If you encounter a "python not found" error, use the full path to Python:

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

Find your Python path:
```bash
which python3
```

### Module Not Found

If you encounter "No module named browse_mcp", ensure the package is installed in the same Python environment:

```bash
pip install browse-mcp
```

### Server Won't Start

Check the MCP client logs. For Claude Desktop on macOS:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

### Check Loaded Data Sources

Run debug mode to see loaded data sources:

```bash
browse-mcp --debug
```

## Next Steps

- [MCP Configuration](../mcp/configuration) - Configure data sources and API keys
- [browse_search Tool](../mcp/tools/browse-search) - Learn search parameters
- [Plugin Configuration](../plugins/configuration) - Advanced plugin settings
