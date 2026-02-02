---
sidebar_position: 1
title: "Installation"
description: "Install Browse MCP and plugins using pip, uv, or from source"
---

# Installation

Browse MCP can be installed using `pip`, `uv`, or from source for development. This guide covers all installation methods, including plugin installation.

## Prerequisites

- **Python 3.10 or higher** - Browse MCP requires Python 3.10+
- **pip or uv** - Package manager for installation

To check your Python version:

```bash
python --version
```

## Installation Methods

### Using pip (Recommended)

The simplest way to install Browse MCP:

```bash
pip install browse-mcp
```

### Using uv

If you use [uv](https://github.com/astral-sh/uv) for faster package management:

```bash
uv pip install browse-mcp
```

Or add it to your project:

```bash
uv add browse-mcp
```

### From Source (Development)

For developers who want to modify the code or contribute:

1. **Clone the repository**:

```bash
git clone https://github.com/LinXueyuanStdio/browse-mcp.git
cd browse-mcp
```

2. **Create and activate a virtual environment**:

```bash
# Using uv (recommended)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Or using standard venv
python -m venv .venv
source .venv/bin/activate
```

3. **Install in development mode**:

```bash
# Using uv
uv pip install -e .

# Or using pip
pip install -e .
```

4. **Install development dependencies** (optional):

```bash
pip install pytest flake8
```

## Installing Plugins

Plugins extend Browse MCP with additional content sources. Install them alongside the core package.

### Social Media Plugin

Add support for GitHub, Twitter, Zhihu, and Xiaohongshu:

```bash
pip install browse-mcp-plugin-social-media
```

### Multiple Plugins

Install multiple plugins at once:

```bash
pip install browse-mcp browse-mcp-plugin-social-media
```

### Plugin Auto-Discovery

Plugins are automatically discovered when the server starts. No configuration changes are needed - just install and restart.

```bash
# After installing a plugin, verify it loads
browse-mcp --debug
```

You should see the plugin sources in the startup logs:

```
INFO     Successfully loaded 15 searcher plugins: arxiv, github, twitter...
```

See [Installing Plugins](../plugins/installing-plugins) for detailed plugin management.

## Verify Installation

After installation, verify that Browse MCP is installed correctly:

```bash
browse-mcp --help
```

You should see output like:

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

## Start the Server

Start the MCP server in stdio mode (for MCP clients):

```bash
browse-mcp
```

:::tip
The server runs in stdio mode by default, which is what MCP clients like Claude Desktop expect. You do not need to keep a terminal open - the MCP client will start the server automatically.
:::

## Next Steps

- [Quick Start](./quick-start) - Search your first paper in 2 minutes
- [Client Configuration](./client-configuration) - Configure your MCP client
- [Plugins Overview](../plugins/overview) - Learn about the plugin system
- [Available Plugins](../plugins/available-plugins) - Browse available plugins
