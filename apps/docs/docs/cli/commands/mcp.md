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
| `enable <name>` | Enable an MCP server |
| `disable <name>` | Disable an MCP server |
| `config <name>` | View or set MCP configuration |

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
```

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
```

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

## Related Commands

- [viben service](./service) - Service management
- [viben config](./config) - Configuration management
- [viben agent](./agent) - Agent management
