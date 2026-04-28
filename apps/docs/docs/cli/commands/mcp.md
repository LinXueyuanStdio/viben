---
sidebar_position: 5
title: "viben mcp"
description: "Manage MCP servers - add, configure, enable/disable"
---

# viben mcp

Manage MCP (Model Context Protocol) servers.

## Usage

```bash
viben mcp <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `add <name>` | Add an MCP server to an agent |
| `remove <name>` | Remove an MCP server from an agent |
| `list` | List MCP servers |
| `show <name>` | Show MCP server details |
| `enable <name>` | Enable an MCP server |
| `disable <name>` | Disable an MCP server |
| `config <name>` | View or set MCP configuration |
| `inspector` | Launch MCP Inspector for testing and debugging |
| `serve` | Show MCP server startup information |

## Commands

### Add MCP Server

Add an MCP server to an agent:

```bash
# Basic add
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user

# Add with environment variables
viben mcp add github --agent my-agent --command npx --args @anthropic-ai/mcp-server-github --env GITHUB_TOKEN=xxx

# Add to global configuration
viben mcp add filesystem --global --command npx --args @anthropic-ai/mcp-server-filesystem

# Add in disabled state
viben mcp add filesystem --agent my-agent --command npx --disabled
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | (Required) Agent ID |
| `--command <cmd>` | (Required) MCP server startup command |
| `--args <args...>` | Command arguments |
| `--env <key=value...>` | Environment variables (can be used multiple times) |
| `--disabled` | Add in disabled state |
| `--global` | Add to global configuration |
| `--json` | JSON format output |

**Output (Human-readable):**

```
Added MCP server 'filesystem' to agent 'my-agent'
```

**Output (JSON):**

```bash
viben mcp add filesystem --agent my-agent --json
```

```json
{
  "success": true,
  "data": {
    "name": "filesystem",
    "agent": "my-agent",
    "command": "npx",
    "args": ["@anthropic-ai/mcp-server-filesystem", "/home/user"]
  }
}
```

### Remove MCP Server

Remove an MCP server from an agent:

```bash
viben mcp remove filesystem --agent my-agent
```

**Output:**

```
Removed MCP server 'filesystem' from agent 'my-agent'
```

### List MCP Servers

List MCP servers for an agent:

```bash
# List MCP servers for a specific agent
viben mcp list --agent my-agent

# List global MCP servers
viben mcp list --global

# Include disabled servers
viben mcp list --agent my-agent --disabled
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | List MCP servers for a specific agent |
| `--global` | List global MCP servers |
| `--disabled` | Include disabled servers in the listing |
| `--json` | JSON format output |

**Output (Human-readable):**

```
MCP Servers for Agent: my-agent
  Name         Command                              Enabled
  filesystem   npx @anthropic-ai/mcp-server-fs      yes
  git          npx @anthropic-ai/mcp-server-git     yes
  browser      playwright run                       no
```

**Output (JSON):**

```bash
viben mcp list --agent my-agent --json
```

```json
{
  "success": true,
  "data": {
    "agent": "my-agent",
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["@anthropic-ai/mcp-server-filesystem"],
        "enabled": true
      },
      {
        "name": "git",
        "command": "npx",
        "args": ["@anthropic-ai/mcp-server-git"],
        "enabled": true
      }
    ]
  }
}
```

### Show MCP Server

Show detailed information about an MCP server:

```bash
# Show globally installed MCP server details
viben mcp show <name>

# Show agent-configured MCP server details
viben mcp show <name> --agent <agent-id>

# JSON output
viben mcp show <name> --json
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | View a specific agent's MCP server |
| `--json` | JSON format output |

**Output**:

```
MCP Server: filesystem

  Name:          filesystem
  Command:       npx
  Args:          @anthropic-ai/mcp-server-filesystem /home/user
  Enabled:       yes

Environment Variables:

  API_KEY:       secr****5678
  DEBUG:         true
```

:::note
Environment variable values containing `secret`, `token`, or `key` are automatically masked in the output.
:::

### Enable MCP Server

```bash
viben mcp enable filesystem --agent my-agent
```

**Output:**

```
Enabled MCP server 'filesystem'
```

### Disable MCP Server

```bash
viben mcp disable browser --agent my-agent
```

**Output:**

```
Disabled MCP server 'browser'
```

### Configure MCP Server

View or modify MCP server configuration:

```bash
# View configuration
viben mcp config filesystem --agent my-agent

# Set configuration value
viben mcp config filesystem --agent my-agent set root /path/to/dir

# Set environment variable
viben mcp config filesystem --agent my-agent set env.ROOT /path/to/workspace
```

**Output (View):**

```
MCP Configuration: filesystem
Agent: my-agent

command: npx
args:
  - @anthropic-ai/mcp-server-filesystem
  - /home/user
env:
  ROOT: /home/user
enabled: true
```

### MCP Inspector

Launch MCP Inspector for testing and debugging MCP servers. Based on the `@modelcontextprotocol/inspector` package.

```bash
# Launch Inspector (starts proxy only, does not auto-open browser)
viben mcp inspector

# Specify MCP server command
viben mcp inspector node build/index.js
viben mcp inspector npx @anthropic-ai/mcp-server-filesystem

# Pass arguments to MCP server
viben mcp inspector node build/index.js arg1 arg2

# Pass environment variables
viben mcp inspector -e API_KEY=value node build/index.js
viben mcp inspector -e KEY1=val1 -e KEY2=val2 node build/index.js

# Use configuration file
viben mcp inspector --config mcp.json
viben mcp inspector --config mcp.json --server myserver

# CLI mode (non-interactive)
viben mcp inspector --cli node build/index.js

# SSE/HTTP transport
viben mcp inspector --transport sse --server-url https://example.com/sse
viben mcp inspector --transport http --server-url https://example.com/mcp
```

**Options**:

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Configuration file path (JSON format, containing mcpServers) |
| `-s, --server <name>` | Server name in the configuration file |
| `--cli` | CLI mode (non-interactive) |
| `-t, --transport <type>` | Transport type (stdio, sse, http) |
| `-u, --server-url <url>` | Server URL for SSE/HTTP transport |
| `-e, --env <key=value>` | Environment variables to pass to MCP server (can be used multiple times) |

**Output**:

```
Starting MCP Inspector Proxy...
Proxy server listening on localhost:6277
Session token: xxx

MCP Inspector is up and running at:
   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=xxx
```

:::note
The Inspector only starts a proxy server and does not automatically open a browser. Manually visit the output URL to use the Web UI.
:::

### MCP Serve

Show MCP server startup information (based on the browse-mcp Python package).

```bash
viben mcp serve
```

**Output**:

```
Note: MCP server functionality is handled by browse-mcp.

To start the MCP server, run:
  uvx browse-mcp

Or install and run:
  pip install browse-mcp
  browse-mcp
```

:::note
This command only displays usage instructions for browse-mcp. It does not directly start an MCP server.
:::

## MCP Server Configuration File

MCP server configurations are stored in the agent directory:

### JSON Format (mcp_servers.json)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-filesystem"],
      "env": {
        "ROOT": "/path/to/workspace"
      }
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-git"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Scopes

MCP servers can be configured at different scopes:

| Location | Description |
|----------|-------------|
| `~/.viben/agents/<id>/mcp_servers.json` | Agent-specific configuration |
| `~/.viben/mcp/` | Global shared MCP servers |
| `<project>/.viben/mcp/` | Workspace-specific MCP servers |

```bash
# Add to agent
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem

# Add to global
viben mcp add filesystem --global --command npx --args @anthropic-ai/mcp-server-filesystem
```

## Common MCP Servers

| Name | Package | Description |
|------|---------|-------------|
| filesystem | `@anthropic-ai/mcp-server-filesystem` | Local filesystem access |
| git | `@anthropic-ai/mcp-server-git` | Git operations |
| github | `@modelcontextprotocol/server-github` | GitHub API |
| postgres | `@modelcontextprotocol/server-postgres` | PostgreSQL database |
| sqlite | `@modelcontextprotocol/server-sqlite` | SQLite database |
| puppeteer | `@modelcontextprotocol/server-puppeteer` | Browser automation |

## Error Handling

### MCP Not Found

```json
{
  "success": false,
  "error": {
    "code": "MCP_NOT_FOUND",
    "message": "MCP server 'unknown-mcp' not found"
  }
}
```

### Already Exists

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "MCP server 'filesystem' already exists for agent 'my-agent'"
  }
}
```

### Agent Not Found

```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent 'unknown-agent' not found"
  }
}
```

## Coming Soon

The following subcommands are planned for a future release:

| Subcommand | Description |
|------------|-------------|
| `install <name>` | Install an MCP server from the marketplace |
| `uninstall <name>` | Uninstall an MCP server |

```bash
# Install from marketplace (planned)
viben mcp install <name>
viben mcp install <name>@<version>

# Uninstall (planned)
viben mcp uninstall <name>
```

## Related Commands

- [viben service](./service) - Service management
- [viben config](./config) - Configuration management
- [viben agent](./agent) - Agent management
