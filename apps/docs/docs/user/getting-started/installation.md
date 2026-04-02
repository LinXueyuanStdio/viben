---
sidebar_position: 1
title: "Installation Guide"
description: "Install Viben desktop app, CLI tool, or MCP server"
---

# Installation Guide

## Viben: Agent Swarm x Code Evolution

Viben is an AI-driven code iterative optimization and agent swarm orchestration platform. Core capabilities include:

- **FileEvo (File-based Self-Evolution)** - Feedback-based code iterative optimization system
- **Agent Swarm** - Multi-agent swarm orchestration and collaboration
- **Task System (XState)** - State machine-based task workflow management
- **Idea Generation** - AI-assisted idea generation and knowledge exploration

---

## Product Forms

Viben offers multiple product forms. You can choose to install based on your needs:

| Product | Installation Method | Use Cases |
|---------|---------------------|-----------|
| **Desktop App** | Download installer | Agent Swarm orchestration, FileEvo code optimization, task management |
| **CLI Tool** | npm/npx | Command line automation, task state machine, Queue system |
| **MCP Server** | pip/uv | AI assistant integration for academic search, knowledge acquisition |

---

## Desktop App (Recommended)

The desktop app is the most intuitive way to experience **Agent Swarm x Code Evolution**, providing a complete graphical interface:

- **Agent Swarm** - Visual orchestration and management of agent swarms
- **FileEvo** - Visual feedback interface for code iterative optimization
- **Task System** - XState-based task state machine management
- **Idea Generation** - AI-assisted knowledge exploration and idea generation

### Download

[![Latest Version](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop):

| Platform | Download Format | Notes |
|----------|-----------------|-------|
| **macOS** | `.dmg` (Universal) | Supports Intel and Apple Silicon |
| **Windows** | `.msi` or `.exe` | 64-bit Windows 10/11 |
| **Linux** | `.AppImage` or `.deb` | 64-bit Linux |

### macOS Installation

1. Download the `.dmg` file
2. Double-click to open the disk image
3. Drag **Viben** to the **Applications** folder
4. On first launch, right-click and select "Open" (to bypass Gatekeeper)

:::note macOS Security Note
If you see "Viben is damaged and can't be opened", run in terminal:
```bash
xattr -cr /Applications/Viben.app
```
:::

### Windows Installation

1. Download the `.msi` or `.exe` installer
2. Run the installer
3. Follow the installation wizard to complete installation
4. Launch Viben from the Start menu

### Linux Installation

**AppImage (Portable):**
```bash
chmod +x Viben_*.AppImage
./Viben_*.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i Viben_*_amd64.deb
sudo apt-get install -f  # Fix dependencies
```

---

## CLI Tool

Viben CLI is the command line entry point for **Agent Swarm x Code Evolution**, suitable for automation and script integration:

- **Task System** - `viben task` manages task state machine workflows
- **Queue System** - `viben queue` background command execution queue
- **Agent Management** - Command line management of agent swarms

### Using npx (Recommended)

No installation needed, run directly:

```bash
npx viben
```

### Global Installation

```bash
npm install -g viben
```

After installation, you can use the `viben` command directly:

```bash
viben --help
```

### Verify Installation

```bash
viben version
```

### Main Commands

```
viben <command> [options]

Commands:
  gateway       Start Gateway service
  agent         Manage agents (Agent Swarm)
  task          Task state machine workflows (Task System)
  queue         Background command execution queue (Queue System)
  provider      Manage API Providers
  model         Manage model configurations
  mcp           Manage MCP servers
  skill         Manage Skills
  channel       Manage chat channels
  cron          Manage scheduled tasks
  workspace     Workspace operations
```

---

## MCP Server

The MCP server provides knowledge acquisition capabilities for **Agent Swarm**, supporting academic paper search and multi-source data access. It is an important knowledge source for **Idea Generation** and **FileEvo**.

### Quick Installation

```bash
pip install browse-mcp
```

### Using uv

If you use [uv](https://github.com/astral-sh/uv) as your package manager:

```bash
uv pip install browse-mcp
```

### Shell Script Installation

Quick installation on macOS or Linux:

```bash
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
```

### Verify Installation

```bash
browse-mcp --help
```

Example output:

```
Usage: browse-mcp [OPTIONS] COMMAND [ARGS]...

  Run the Browse MCP server.

Options:
  --host TEXT           Bind host (SSE/HTTP only).  [default: 127.0.0.1]
  --port INTEGER        Bind port (SSE/HTTP only).  [default: 8000]
  --debug / --no-debug  Enable debug logging.  [default: no-debug]
  -t, --transport TEXT  Transport method: stdio, sse, streamable-http, http
  --help                Show this message and exit.
```

### Start Server

```bash
browse-mcp
```

:::tip
The server runs in stdio mode by default, which is what MCP clients like Claude Desktop expect. You don't need to keep the terminal open; the MCP client will automatically start the server.
:::

---

## Install from Source (Developers)

### Clone Repository

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
```

### Install Dependencies

```bash
pnpm install
```

### Build Project

```bash
pnpm build
```

### Start Development Services

**Desktop App:**
```bash
pnpm dev:desktop
```

**Gateway Service:**
```bash
pnpm gateway:build
```

---

## System Requirements

### Desktop App

| Platform | Minimum Requirements |
|----------|---------------------|
| **macOS** | macOS 10.15 (Catalina) or higher |
| **Windows** | Windows 10 (64-bit) or higher |
| **Linux** | Ubuntu 20.04 or equivalent (64-bit) |

**Recommended Configuration:**
- 4 GB RAM
- 100 MB disk space
- Network connection

### CLI Tool

- Node.js 18+ or 20+
- npm or pnpm

### MCP Server

- Python 3.10 or higher
- pip or uv

---

## Next Steps

- [Quick Start](./quick-start) - Search your first paper in 2 minutes
- [Client Configuration](./client-configuration) - Configure Claude Desktop, Cline, etc.
- [Desktop App Features](../desktop/features) - Explore complete desktop app features
