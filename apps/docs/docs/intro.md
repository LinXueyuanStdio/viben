---
sidebar_position: 1
title: "Introduction"
description: "Browse MCP - Search, download, and read academic papers from 19+ sources via MCP"
---

# Browse MCP

**Browse MCP** is a Python-based MCP (Model Context Protocol) server that enables AI assistants to search, download, and read academic papers from 19+ academic databases. It provides a unified interface for accessing research literature through three simple tools.

## Key Features

- **Multi-Source Support** - Search and download papers from 19+ academic databases including arXiv, PubMed, PubMed Central, bioRxiv, medRxiv, Google Scholar, Semantic Scholar, IEEE Xplore, and more.

- **Unified Interface** - All platforms accessible through three consistent tools: `paper_search`, `paper_download`, and `paper_read`.

- **Standardized Output** - Papers are returned in a consistent format regardless of source, making it easy for AI assistants to process results.

- **MCP Integration** - Compatible with MCP clients like Claude Desktop, Claude Code, Cline (VS Code), and Zed Editor.

- **Asynchronous Operations** - Efficiently handles concurrent searches and downloads for fast results.

- **Extensible Plugin System** - Add new academic platforms by creating plugins with stevedore.

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
| `paper_search` | Search papers across multiple academic databases |
| `paper_download` | Download paper PDFs and return file paths |
| `paper_read` | Extract and read text content from papers |

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
- [paper_search Tool](./mcp-server/tools/paper-search) - Learn how to search papers
