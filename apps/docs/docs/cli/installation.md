---
sidebar_position: 2
title: "Installation"
description: "Install Viben CLI using npm, pnpm, or from source"
---

# Installation

Viben CLI can be installed globally via npm/pnpm or built from source for development.

## Quick Install

### Using npm

```bash
npm install -g @viben/cli
```

### Using pnpm

```bash
pnpm add -g @viben/cli
```

### Using npx (No Installation)

Run without installing:

```bash
npx @viben/cli --help
```

## System Requirements

| Requirement | Version |
|-------------|---------|
| **Node.js** | 18.0 or higher |
| **npm** | 9.0 or higher (or pnpm 8.0+) |

### Check Your Environment

```bash
# Check Node.js version
node --version

# Check npm version
npm --version
```

## Verify Installation

After installation, verify that Viben CLI is installed correctly:

```bash
viben --help
```

You should see output like:

```
Usage: viben <command> [options]

Bootstrap CLI for Viben - configure applications, manage services, and query status.

Commands:
  init          Initialize workspace in current directory
  config        Configuration management (git-style)
  service       Manage background services
  agent         Manage agent instances and templates
  provider      Manage API providers
  model         Manage models, aliases, and fallbacks
  mcp           Manage MCP servers
  skill         Manage skills
  workspace     Workspace operations
  version       Show version info
  help          Show help

Options:
  --json              Output as JSON
  --global, -g        Use global config
  --workspace         Use workspace config
  -n, --name <id>     Specify agent name/ID
  --verbose, -v       Verbose output
  --quiet, -q         Suppress non-essential output
  --help, -h          Show help
```

Check the version:

```bash
viben version
```

## From Source (Development)

For developers who want to modify the CLI or contribute:

### 1. Clone the Repository

```bash
git clone https://github.com/LinXueyuanStdio/viben.git
cd viben
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build the CLI

```bash
pnpm build --filter=@viben/cli
```

### 4. Link for Local Development

```bash
cd apps/cli
pnpm link --global
```

Now you can use `viben` command globally, and changes will be reflected after rebuilding.

### 5. Development Mode

For active development with auto-rebuild:

```bash
cd apps/cli
pnpm dev
```

## Configuration Locations

After installation, Viben CLI stores its configuration in:

| Platform | Location |
|----------|----------|
| **macOS/Linux** | `~/.viben/` |
| **Windows** | `%USERPROFILE%\.viben\` |

The configuration directory is created automatically on first use.

### Directory Structure

```
~/.viben/
├── config.yaml           # Global configuration
├── providers.yaml        # API provider configurations
├── models.yaml           # Model configurations
├── agents/               # Agent instances
├── mcp/                  # Shared MCP servers
└── skills/               # Shared skills
```

## Updating

### npm

```bash
npm update -g @viben/cli
```

### pnpm

```bash
pnpm update -g @viben/cli
```

### From Source

```bash
cd viben
git pull
pnpm install
pnpm build --filter=@viben/cli
```

## Uninstalling

### npm

```bash
npm uninstall -g @viben/cli
```

### pnpm

```bash
pnpm remove -g @viben/cli
```

### Clean Configuration (Optional)

To remove all configuration and data:

```bash
# macOS/Linux
rm -rf ~/.viben

# Windows (PowerShell)
Remove-Item -Recurse -Force $env:USERPROFILE\.viben
```

:::warning
Removing the `.viben` directory will delete all agent configurations, memories, and sessions. Make sure to back up important data first.
:::

## Troubleshooting

### Command Not Found

If `viben` command is not found after installation:

1. **Check PATH**: Ensure npm global bin directory is in your PATH

   ```bash
   # Find npm global bin directory
   npm bin -g

   # Add to PATH (bash/zsh)
   export PATH="$(npm bin -g):$PATH"
   ```

2. **Restart Terminal**: Close and reopen your terminal after installation

3. **Reinstall**: Try reinstalling with verbose output

   ```bash
   npm install -g @viben/cli --verbose
   ```

### Permission Errors

On macOS/Linux, if you encounter permission errors:

```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g @viben/cli

# Option 2: Fix npm permissions (recommended)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g @viben/cli
```

### Version Conflicts

If you have multiple Node.js versions, use a version manager:

```bash
# Using nvm
nvm use 18
npm install -g @viben/cli
```

## Next Steps

- [Quick Start](./quick-start) - Initialize and configure your first workspace
