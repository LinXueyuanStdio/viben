---
sidebar_position: 1
title: "Desktop App"
description: "Browse MCP Desktop App - A native application for academic paper search"
---

# Desktop App

Browse MCP Desktop is a native application that brings the power of academic paper search directly to your desktop. Built with Tauri, it provides a fast, lightweight, and secure experience across macOS, Windows, and Linux.

## Features

- **Native Performance**: Built with Rust and Tauri for fast startup and low memory usage
- **Cross-Platform**: Available for macOS (Universal), Windows (x64), and Linux (x64)
- **Offline Ready**: Core functionality works without constant internet connection
- **MCP Integration**: Built-in MCP server management for AI assistant integration
- **Privacy First**: Your data stays on your machine

## Download

[![Latest Release](https://img.shields.io/github/v/release/LinXueyuanStdio/browse-mcp?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop)

Download from [GitHub Releases](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop).

| Platform | File | Size |
|----------|------|------|
| macOS (Universal) | `.dmg` | ~15 MB |
| Windows (x64) | `.msi` / `.exe` | ~10 MB |
| Linux (x64) | `.AppImage` / `.deb` | ~15 MB |

## System Requirements

### Minimum Requirements

| Platform | Requirement |
|----------|-------------|
| **macOS** | macOS 10.15 (Catalina) or later |
| **Windows** | Windows 10 (64-bit) or later |
| **Linux** | Ubuntu 20.04 or equivalent (64-bit) |

### Recommended

- 4 GB RAM
- 100 MB free disk space
- Internet connection for paper searches

## Quick Start

1. **Download** the installer for your platform
2. **Install** following [platform-specific instructions](/docs/desktop-app/installation)
3. **Launch** Browse MCP from your applications
4. **Search** for papers using the search bar

## Architecture

Browse MCP Desktop is built with modern technologies:

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri v2
- **UI Components**: shadcn/ui (Radix UI)
- **Animation**: Framer Motion

The app communicates with various academic APIs (arXiv, PubMed, Semantic Scholar, etc.) to search and retrieve papers.

## Next Steps

- [Installation Guide](/docs/desktop-app/installation) - Detailed installation instructions
- [Features](/docs/desktop-app/features) - Explore all features
- [Getting Started](/docs/getting-started/quick-start) - Search your first paper
