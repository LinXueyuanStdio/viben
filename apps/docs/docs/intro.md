---
sidebar_position: 1
---

# Introduction

**Browse MCP** is a Python-based MCP server that enables users to search, download, and read academic papers from various platforms.

## Features

- **Multi-Source Support**: Search and download papers from 19+ academic databases including arXiv, PubMed, PubMed Central, bioRxiv, medRxiv, Google Scholar, Semantic Scholar, IEEE Xplore, and more.

- **Unified Interface**: All platforms accessible through consistent `paper_search`, `paper_download`, and `paper_read` tools.

- **MCP Integration**: Compatible with MCP clients like Claude Desktop, Claude Code, Cline, and Zed for seamless LLM integration.

- **Asynchronous Operations**: Efficiently handles concurrent searches and downloads using `httpx` and async/await.

## Quick Start

### Installation

```bash
pip install browse-mcp
```

### Start the MCP Server

```bash
browse-mcp
```

### Available Tools

| Tool | Description |
|------|-------------|
| `paper_search` | Search papers across multiple academic databases |
| `paper_download` | Download paper PDFs, return paths of downloaded files |
| `paper_read` | Extract and read text content from papers |

## Supported Academic Platforms

### Free & Open Access

- **arXiv** - Pre-print repository for physics, mathematics, CS, and more
- **PubMed** - Biomedical literature database
- **PubMed Central (PMC)** - Free full-text biomedical articles
- **bioRxiv** - Pre-print server for biology
- **medRxiv** - Pre-print server for health sciences
- **Semantic Scholar** - AI-powered research tool
- **CrossRef** - DOI registration and metadata provider
- **Google Scholar** - Academic search engine
- **CORE** - Open access research papers aggregator

### API Key Required

- **IEEE Xplore** - IEEE's digital library
- **Scopus** - Elsevier's citation database
- **Springer Link** - Springer's scientific publications
- **Science Direct** - Elsevier's full-text database

## Next Steps

Documentation is being actively developed. Check back soon for:

- Installation Guide - Detailed installation instructions
- Quick Start - Get up and running in minutes
- MCP Server Overview - Learn about the architecture
- Client Configuration - Configure Claude Desktop, Claude Code, and more
