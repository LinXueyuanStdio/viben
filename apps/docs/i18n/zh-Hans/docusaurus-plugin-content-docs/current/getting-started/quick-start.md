---
sidebar_position: 2
title: "Quick Start"
description: "Get Browse MCP working in 2 minutes"
---

# Quick Start

Get Browse MCP working with Claude Desktop in under 2 minutes.

## Step 1: Install Browse MCP

```bash
pip install browse-mcp
```

## Step 2: Configure Claude Desktop

Open your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration:

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

:::tip Minimal Configuration
This minimal configuration enables all free sources (arXiv, PubMed, etc.) without requiring any API keys. You can add API keys later for premium sources.
:::

## Step 3: Restart Claude Desktop

Completely quit and reopen Claude Desktop for the configuration to take effect.

## Step 4: Search Your First Paper

In Claude Desktop, try asking:

> "Search for recent papers about large language models on arXiv"

Or be more specific:

> "Find papers about transformer architecture published in 2023"

## Example Response

Claude will use the `browse_search` tool and return results like:

```
Source: 'arxiv'
Paper ID: '2303.08774'
Title: GPT-4 Technical Report
Authors: OpenAI
Abstract: We report the development of GPT-4, a large-scale...
Published Date: 2023-03-15
URL: https://arxiv.org/abs/2303.08774
```

## Try More Features

### Download a Paper

> "Download the paper with arXiv ID 2303.08774"

### Read Paper Content

> "Read the content of the paper 2303.08774 from arXiv"

### Search Multiple Sources

> "Search for papers about CRISPR gene editing on PubMed and bioRxiv"

## What is Happening?

When you ask Claude to search for papers:

1. Claude recognizes the intent and calls the `browse_search` tool
2. Browse MCP queries the specified academic databases
3. Results are returned in a standardized format
4. Claude presents the information to you

## Next Steps

- [Client Configuration](./client-configuration) - Configure for other clients (Cline, Zed)
- [browse_search Tool](../mcp-server/tools/paper-search) - Learn advanced search options
- [Configuration](../mcp-server/configuration) - Enable premium sources with API keys
