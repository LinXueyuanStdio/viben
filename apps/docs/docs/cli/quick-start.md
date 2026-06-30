---
sidebar_position: 3
title: "Quick Start"
description: "Get started with Viben CLI in 5 minutes"
---

# Quick Start

Get **Agent Swarm x Code Evolution** running in 5 minutes. Viben CLI enables AI agent swarms to continuously evolve and optimize your codebase through FileEvo, intelligent task management, and collaborative agent orchestration.

## Step 1: Install Viben CLI

```bash
npm install -g @viben/cli
```

Verify the installation:

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
  viben mcp install <name>              # Install MCP server
  viben skill install <name>            # Install skill
```

## Step 3: Configure API Provider

Set up your preferred AI provider. Viben supports multiple providers including Anthropic, OpenAI, Google, Azure, and more.

### Option A: Using Environment Variables (Recommended)

Set API keys as environment variables:

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

### Option B: Provide API Key Directly

```bash
viben provider create -t anthropic --api-key "sk-ant-xxx"
```

:::tip
When providing an API key directly, it will be encrypted and securely stored in `~/.viben/models.yaml`.
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

### Configure Agent

Set a model for your agent:

```bash
viben agent config -n my-agent --set model=claude-sonnet-4-20250514
```

### Set as Default

Set this agent as the default:

```bash
viben agent set-default -n my-agent
```

## Step 5: Install MCP Servers

Install commonly used MCP servers:

```bash
# Filesystem access
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user

# Git operations
viben mcp add git --agent my-agent --command npx --args @anthropic-ai/mcp-server-git
```

List installed MCP servers:

```bash
viben mcp list --agent my-agent
```

Output:

```
MCP Servers for Agent: my-agent
  Name         Command                              Enabled
  filesystem   npx @anthropic-ai/mcp-server-fs      yes
  git          npx @anthropic-ai/mcp-server-git     yes
```

## Step 6: Verify Setup

Check overall status:

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
# List all configuration (show global and workspace)
viben config list --show-origin
```

### Edit Configuration

```bash
# Open configuration in editor
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
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias create -n smart -m claude-sonnet-4-20250514
viben model alias create -n best -m claude-opus-4-20250514
```

Now you can use `fast`, `smart`, or `best` instead of full model names:

```bash
viben agent config -n my-agent --set model=smart
```

### Set Up Model Fallback Chain

Configure backup models in case the primary model is unavailable:

```bash
viben model set-default -n your-preferred-model
```

### Workspace-Specific Configuration

Override global settings for a specific project:

```bash
# In your project directory
viben config set --workspace mcp.enabled '["filesystem", "git", "browser"]'
```

## JSON Output for Automation

All commands support the `--json` flag for scripting and AI agent integration:

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
| Configure agent | `viben agent config -n <name> --set <key>=<value>` |
| Add MCP | `viben mcp add <name> --agent <id> --command <cmd>` |
| Install skill | `viben skill install <name>` |
| Check status | `viben agent status` |
| List agents | `viben agent list` |
| List providers | `viben provider list` |
| List models | `viben model list` |
| Start Gateway | `viben gateway start` |
| View executors | `viben executor list` |

## Next Steps

Now that you have Viben CLI set up, you can:

- Explore [Agent Management](/cli/agents/) for the complete agent lifecycle
- Configure additional [API Providers](./configuration/) for more model options
- Install more [MCP Servers](/user/mcp/configuration) to extend functionality
- Learn about [Gateway](./commands/gateway.md) runtime architecture
