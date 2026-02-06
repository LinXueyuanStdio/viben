---
sidebar_position: 3
title: "Quick Start"
description: "Get started with Viben CLI in 5 minutes"
---

# Quick Start

Get Viben CLI up and running in 5 minutes.

## Step 1: Install Viben CLI

```bash
npm install -g @viben/cli
```

Verify installation:

```bash
viben --help
```

## Step 2: Initialize Your First Workspace

Navigate to your project directory and initialize Viben:

```bash
cd /path/to/your/project
viben init
```

Output:

```
Initialized Viben workspace in /path/to/your/project
  Created .viben/config.yaml

Next steps:
  viben provider create -t anthropic    # Set up API provider
  viben mcp install <name>              # Install MCP servers
  viben skill install <name>            # Install skills
```

## Step 3: Configure an API Provider

Set up your preferred AI provider. Viben supports multiple providers including Anthropic, OpenAI, Google, Azure, and more.

### Option A: Using Environment Variables (Recommended)

Set your API key as an environment variable:

```bash
# Anthropic
export ANTHROPIC_API_KEY="sk-ant-xxx"

# OpenAI
export OPENAI_API_KEY="sk-xxx"
```

Then create the provider:

```bash
viben provider create -t anthropic
```

### Option B: Providing API Key Directly

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

:::tip
When providing the API key directly, it will be encrypted and stored securely in `~/.viben/providers.yaml`.
:::

### Verify Provider

Check provider connectivity:

```bash
viben provider status
```

Output:

```
Provider Status:
  anthropic-main   anthropic   ✓ connected   latency: 120ms
```

## Step 4: Create Your First Agent

Create an AI agent instance:

```bash
viben agent create -n my-agent
```

Output:

```
Agent: my-agent
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/
```

### Configure the Agent

Set the model for your agent:

```bash
viben agent config -n my-agent set model claude-sonnet-4-20250514
```

### Set as Default

Make this agent the default:

```bash
viben agent set-default -n my-agent
```

## Step 5: Install MCP Servers

Install commonly used MCP servers:

```bash
# File system access
viben mcp install filesystem

# Git operations
viben mcp install git
```

List installed MCP servers:

```bash
viben mcp list
```

Output:

```
Installed MCP Servers:
  filesystem    v1.2.0    enabled    Local filesystem access
  git           v2.0.1    enabled    Git operations
```

## Step 6: Verify Setup

Check the overall status:

```bash
viben agent status
```

Output:

```
Agent: my-agent (default)
Type: claude-code
Model: claude-sonnet-4-20250514 (anthropic-main)

MCP: filesystem, git (2 enabled)
Skills: none

Memory:
  MEMORY.md     0 KB    empty

Sessions: 0
```

## Common Workflows

### View All Configuration

```bash
# List all config (shows both global and workspace)
viben config list --show-origin
```

### Edit Configuration

```bash
# Open config in your editor
viben config edit

# Or set specific values
viben config set settings.editor vim
```

### Manage Multiple Agents

```bash
# List all agents
viben agent list

# Create agent from template
viben agent create -n research-bot -f coding-assistant

# Switch default agent
viben agent set-default -n research-bot
```

### Configure Model Aliases

Set up convenient model aliases:

```bash
# Create aliases for quick reference
viben model aliases create -n fast -f claude-3-5-haiku-latest
viben model aliases create -n smart -f claude-sonnet-4-20250514
viben model aliases create -n best -f claude-opus-4-20250514
```

Now you can use `fast`, `smart`, or `best` instead of full model names:

```bash
viben agent config -n my-agent set model smart
```

### Set Up Model Fallbacks

Configure fallback models in case the primary is unavailable:

```bash
viben model fallbacks create -n claude-sonnet-4-20250514
viben model fallbacks create -n gpt-4-turbo
viben model fallbacks create -n claude-3-5-haiku-latest
```

### Workspace-Specific Configuration

Override global settings for a specific project:

```bash
# In your project directory
viben config set --workspace mcp.enabled '["filesystem", "git", "browser"]'
```

## JSON Output for Automation

All commands support `--json` flag for scripting and AI agent integration:

```bash
# Get agent list as JSON
viben agent list --json

# Get provider status as JSON
viben provider status --json
```

Example JSON output:

```json
{
  "success": true,
  "data": {
    "current": "my-agent",
    "agents": [
      {
        "id": "my-agent",
        "name": "My Agent",
        "type": "claude-code",
        "path": "~/.viben/agents/my-agent/"
      }
    ]
  }
}
```

## Quick Reference

| Task | Command |
|------|---------|
| Initialize workspace | `viben init` |
| Create provider | `viben provider create -t <type>` |
| Create agent | `viben agent create -n <name>` |
| Configure agent | `viben agent config -n <name> set <key> <value>` |
| Install MCP | `viben mcp install <name>` |
| Install skill | `viben skill install <name>` |
| Check status | `viben agent status` |
| List agents | `viben agent list` |
| List providers | `viben provider list` |
| List models | `viben model list` |

## Next Steps

Now that you have Viben CLI set up, you can:

- Explore [Agent Management](/docs/cli#architecture-overview) to understand the full agent lifecycle
- Configure additional [API Providers](/docs/cli#configuration-file-format) for model variety
- Install more [MCP Servers](/docs/mcp-server/configuration) for extended capabilities
