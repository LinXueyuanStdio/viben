---
sidebar_position: 2
title: "Installing Plugins"
description: "How to install, update, and manage Viben plugins"
---

# Installing Plugins

This guide covers how to install, update, and manage Viben plugins.

## Installation Methods

### Using pip

The simplest way to install plugins:

```bash
pip install browse-mcp-plugin-social-media
```

### Using uv

If you use [uv](https://github.com/astral-sh/uv) for package management:

```bash
uv pip install browse-mcp-plugin-social-media
```

Or add to your project:

```bash
uv add browse-mcp-plugin-social-media
```

### Installing from Source

For development or unreleased plugins:

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben/backend/plugins/browse-mcp-plugin-social-media
pip install -e .
```

## Verifying Installation

After installing a plugin, verify it loaded by checking the server logs:

```bash
browse-mcp --debug
```

You should see output like:

```
INFO     Loading searcher plugins from namespace: browse_mcp.searchers
DEBUG    Loaded searcher plugin: arxiv (academic/arxiv)
DEBUG    Loaded searcher plugin: github (social/github)
DEBUG    Loaded searcher plugin: twitter (social/twitter)
INFO     Successfully loaded 15 searcher plugins: arxiv, github, twitter...
```

## Managing Multiple Plugins

### Installing Multiple Plugins

You can install multiple plugins at once:

```bash
pip install browse-mcp-plugin-social-media browse-mcp-plugin-news
```

### Listing Installed Plugins

View all installed browse-mcp packages:

```bash
pip list | grep browse-mcp
```

Output:

```
browse-mcp                    0.3.0
browse-mcp-plugin-social-media 0.1.0
browse-mcp-plugin-news        0.1.0
```

### Updating Plugins

Update a specific plugin:

```bash
pip install --upgrade browse-mcp-plugin-social-media
```

Update all browse-mcp packages:

```bash
pip install --upgrade browse-mcp browse-mcp-plugin-social-media
```

### Uninstalling Plugins

Remove a plugin:

```bash
pip uninstall browse-mcp-plugin-social-media
```

## Plugin Dependencies

### Automatic Dependencies

Plugins declare their dependencies in `pyproject.toml`. When you install a plugin, dependencies are installed automatically.

### Core Dependency

All plugins depend on the `browse-mcp` core:

```toml
[tool.poetry.dependencies]
browse-mcp = "*"
```

If browse-mcp is not installed, it will be installed automatically when you install a plugin.

## Environment-Specific Installation

### Claude Desktop Configuration

When using Claude Desktop, you can install plugins in the same Python environment:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "python",
      "args": ["-m", "browse_mcp"],
      "env": {}
    }
  }
}
```

Ensure plugins are installed in the Python environment that Claude Desktop uses.

### Virtual Environments

If you use virtual environments:

```bash
# Create and activate virtual environment
python -m venv browse-mcp-env
source browse-mcp-env/bin/activate  # Windows: browse-mcp-env\Scripts\activate

# Install core and plugins
pip install browse-mcp browse-mcp-plugin-social-media

# Use the virtual environment's Python in MCP client configuration
```

### uv Inline Dependencies

With uv, you can specify dependencies inline:

```json
{
  "mcpServers": {
    "browse-mcp": {
      "command": "uvx",
      "args": [
        "--with", "browse-mcp-plugin-social-media",
        "browse-mcp"
      ]
    }
  }
}
```

## Troubleshooting

### Plugin Not Loading

If a plugin is not loading:

1. **Check installation**:
   ```bash
   pip show browse-mcp-plugin-social-media
   ```

2. **Check entry points**:
   ```bash
   python -c "from stevedore import ExtensionManager; print([e.name for e in ExtensionManager('browse_mcp.searchers')])"
   ```

3. **Check import errors**:
   ```bash
   python -c "from social_media_searchers import GithubSearcher"
   ```

4. **Enable debug logging**:
   ```bash
   browse-mcp --debug
   ```

### Version Conflicts

If you see version conflicts:

1. **Check compatibility**:
   ```bash
   pip check
   ```

2. **Upgrade all packages**:
   ```bash
   pip install --upgrade browse-mcp browse-mcp-plugin-social-media
   ```

3. **Create a fresh environment**:
   ```bash
   python -m venv fresh-env
   source fresh-env/bin/activate
   pip install browse-mcp browse-mcp-plugin-social-media
   ```

### Missing Dependencies

If a plugin has missing dependencies:

```bash
# Force reinstall with dependencies
pip install --force-reinstall browse-mcp-plugin-social-media
```

## Next Steps

- [Available Plugins](./available-plugins) - Browse official and community plugins
- [Social Media Plugin](./social-media-plugin) - Detailed social media plugin guide
- [Plugin Configuration](./configuration) - Configure plugin-specific settings
