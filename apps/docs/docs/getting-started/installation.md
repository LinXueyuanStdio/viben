---
sidebar_position: 1
title: "Installation"
description: "Install Browse MCP using pip, uv, Desktop App, or from source"
---

# Installation

Browse MCP can be installed as a **Desktop App** (recommended for most users), via `pip`/`uv` (for MCP server integration), or from source for development.

## Desktop App (Recommended)

The easiest way to use Browse MCP is through our Desktop App, available for macOS, Windows, and Linux.

### Download

[![Latest Release](https://img.shields.io/github/v/release/LinXueyuanStdio/browse-mcp?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop)

Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/browse-mcp/releases?q=desktop):

| Platform | Download | Notes |
|----------|----------|-------|
| **macOS** | `.dmg` (Universal) | Supports both Intel and Apple Silicon |
| **Windows** | `.msi` or `.exe` | 64-bit Windows 10/11 |
| **Linux** | `.AppImage` or `.deb` | 64-bit Linux |

### Platform-Specific Instructions

#### macOS

1. Download the `.dmg` file
2. Open the downloaded file
3. Drag **Browse MCP** to your Applications folder
4. On first launch, right-click and select "Open" (required for unsigned apps)

:::note
If you see "Browse MCP is damaged and can't be opened", run this command in Terminal:
```bash
xattr -cr /Applications/Browse\ MCP.app
```
:::

#### Windows

1. Download the `.msi` or `.exe` installer
2. Run the installer
3. Follow the installation wizard
4. Launch Browse MCP from the Start menu

#### Linux

**AppImage (Portable):**
```bash
chmod +x Browse-MCP_*.AppImage
./Browse-MCP_*.AppImage
```

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i Browse-MCP_*_amd64.deb
```

### Verify Download

Each release includes a `checksums.txt` file with SHA256 checksums. Verify your download:

```bash
# macOS/Linux
sha256sum -c checksums.txt

# Windows (PowerShell)
Get-FileHash Browse-MCP_*.exe | Format-List
```

---

## MCP Server (Python Package)

For integration with MCP clients like Claude Desktop, install the Python package.

### Prerequisites

- **Python 3.10 or higher** - Browse MCP requires Python 3.10+
- **pip or uv** - Package manager for installation

To check your Python version:

```bash
python --version
```

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

---

## From Source (Development)

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

### Verify Installation

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

### Start the Server

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
