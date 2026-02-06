---
sidebar_position: 1
title: "Installation"
description: "Install Viben using pip, uv, npx, curl, Desktop App, or from source"
---

# Installation

Viben can be installed as a **Desktop App** (recommended for most users), via **CLI** (for MCP server integration), or from source for development.

## Desktop App (Recommended)

The easiest way to use Viben is through our Desktop App, available for macOS, Windows, and Linux.

### Download

[![Latest Release](https://img.shields.io/github/v/release/LinXueyuanStdio/viben?filter=desktop-v*&label=Desktop%20App)](https://github.com/LinXueyuanStdio/viben/releases?q=desktop)

Download the latest version from [GitHub Releases](https://github.com/LinXueyuanStdio/viben/releases?q=desktop):

| Platform | Download | Notes |
|----------|----------|-------|
| **macOS** | `.dmg` (Universal) | Supports both Intel and Apple Silicon |
| **Windows** | `.msi` or `.exe` | 64-bit Windows 10/11 |
| **Linux** | `.AppImage` or `.deb` | 64-bit Linux |

### Platform-Specific Instructions

#### macOS

1. Download the `.dmg` file
2. Open the downloaded file
3. Drag **Viben** to your Applications folder
4. On first launch, right-click and select "Open" (required for unsigned apps)

:::note
If you see "Viben is damaged and can't be opened", run this command in Terminal:
```bash
xattr -cr /Applications/Viben.app
```
:::

#### Windows

1. Download the `.msi` or `.exe` installer
2. Run the installer
3. Follow the installation wizard
4. Launch Viben from the Start menu

#### Linux

**AppImage (Portable):**
```bash
chmod +x Viben_*.AppImage
./Viben_*.AppImage
```

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i Viben_*_amd64.deb
```

### Verify Download

Each release includes a `checksums.txt` file with SHA256 checksums. Verify your download:

```bash
# macOS/Linux
sha256sum -c checksums.txt

# Windows (PowerShell)
Get-FileHash Viben_*.exe | Format-List
```

---

## MCP Server (CLI)

For integration with MCP clients like Claude Desktop, install the CLI. Choose your preferred method:

### Quick Install (Shell Script)

The fastest way to install on macOS or Linux:

```bash
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash
```

This script will:
- Detect your OS and architecture
- Check for Python 3.10+
- Install `browse-mcp` using uv (preferred) or pip
- Verify the installation

Options:
```bash
# Install with uv package manager (faster)
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash -s -- --with-uv

# Skip confirmation prompts
curl -fsSL https://github.com/LinXueyuanStdio/viben/releases/latest/download/install.sh | bash -s -- --no-confirm
```

### Using npx (Node.js)

If you have Node.js 18+ installed:

```bash
npx viben
```

This will automatically install the Python package if needed and start the MCP server.

You can also install globally:
```bash
npm install -g viben
viben
```

### Using pip

The classic Python installation:

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

### Prerequisites

All CLI installation methods require:

- **Python 3.10 or higher**
- **pip or uv** - Package manager for installation

To check your Python version:

```bash
python --version
```

---

## From Source (Development)

For developers who want to modify the code or contribute:

1. **Clone the repository**:

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
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

After installation, verify that Viben is installed correctly:

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
