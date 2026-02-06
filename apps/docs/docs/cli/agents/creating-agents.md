---
sidebar_position: 2
title: "Creating Agents"
description: "Create, clone, and manage Viben agents using the CLI"
---

# Creating Agents

This guide covers how to create, clone, and manage agents using the Viben CLI.

## Creating a New Agent

### Basic Creation

Create a new agent with a unique ID:

```bash
viben agent create -n <agent-id>
```

**Example:**
```bash
viben agent create -n my-coding-assistant
```

**Output:**
```
Created agent: my-coding-assistant
  Path: ~/.viben/agents/my-coding-assistant/
  Type: claude-code (default)

Next steps:
  viben agent config -n my-coding-assistant set model <model>
  viben agent show -n my-coding-assistant
```

### Create from Template

Create an agent from a predefined template:

```bash
viben agent create -n <agent-id> -f <template-id>
```

**Example:**
```bash
viben agent create -n my-reviewer -f code-reviewer
```

This copies all configuration from the template, including:
- Agent configuration (`config.yaml`)
- MCP servers configuration
- Skills configuration
- Initial memory structure

### Create from Configuration File

Create an agent from a YAML configuration file:

```bash
viben agent create -n <agent-id> -f /path/to/config.yaml
```

**Example:**
```bash
viben agent create -n custom-agent -f ~/configs/my-agent-config.yaml
```

### Clone Existing Agent

Clone an existing agent to create a new one:

```bash
viben agent create -n <new-agent-id> --clone <existing-agent-id>
```

**Example:**
```bash
viben agent create -n my-agent-v2 --clone my-agent
```

This creates a complete copy, including:
- All configuration files
- Memory files (MEMORY.md and daily logs)
- Skills
- Session history (optional, use `--with-sessions`)

:::note
By default, sessions are not cloned. Use `--with-sessions` to include them:
```bash
viben agent create -n my-agent-v2 --clone my-agent --with-sessions
```
:::

## Listing Agents

### List All Agents

```bash
viben agent list
```

**Output:**
```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

### JSON Output

```bash
viben agent list --json
```

**Output:**
```json
{
  "success": true,
  "data": {
    "current": "main",
    "agents": [
      {
        "id": "main",
        "name": "Main Agent",
        "type": "claude-code",
        "path": "~/.viben/agents/main/",
        "session_count": 3,
        "memory_size": "5.6 KB"
      },
      {
        "id": "my-agent",
        "name": "My Coding Assistant",
        "type": "claude-code",
        "path": "~/.viben/agents/my-agent/",
        "session_count": 1,
        "memory_size": "3.4 KB"
      }
    ]
  }
}
```

## Viewing Agent Details

### Show Agent Information

```bash
viben agent show -n <agent-id>
```

**Example:**
```bash
viben agent show -n my-agent
```

**Output:**
```
Agent: my-agent
Name: My Coding Assistant
Type: claude-code
Created: 2024-01-15

Paths:
  Config:   ~/.viben/agents/my-agent/config.yaml
  Memory:   ~/.viben/agents/my-agent/memory/
  Sessions: ~/.viben/agents/my-agent/.agent_sessions/

Memory:
  MEMORY.md     2.3 KB    last modified 2h ago
  2024-01-16.md 1.1 KB    today
  2024-01-15.md 3.2 KB    yesterday

Sessions (1):
  main   "Feature development"   2h ago   42 messages

MCP: filesystem, git (2 enabled)
Skills: code-review, commit (2 enabled)
```

### Check Agent Status

```bash
viben agent status
viben agent status -n <agent-id>
```

**Output:**
```
Agent Status:
  main*         active    last used 5m ago
  my-agent      idle      last used 2h ago
  research-bot  inactive  last used 3d ago

* = current agent
```

## Setting Default Agent

Set the default agent that will be used when `-n` is not specified:

```bash
viben agent set-default -n <agent-id>
```

**Example:**
```bash
viben agent set-default -n my-agent
```

**Output:**
```
Default agent set to: my-agent
```

You can also use the `VIBEN_AGENT` environment variable:

```bash
export VIBEN_AGENT=my-agent
```

## Removing Agents

### Standard Removal

```bash
viben agent remove -n <agent-id>
```

**Example:**
```bash
viben agent remove -n old-agent
```

**Output:**
```
Are you sure you want to remove agent 'old-agent'? [y/N]: y
Removed agent: old-agent
```

### Force Removal

Skip confirmation prompt:

```bash
viben agent remove -n <agent-id> --force
```

**Example:**
```bash
viben agent remove -n old-agent --force
```

:::warning
Force removal does not ask for confirmation. Use with caution as this permanently deletes all agent data including memory and sessions.
:::

## Agent Creation Options

| Option | Description | Example |
|--------|-------------|---------|
| `-n, --name <id>` | Agent ID (required) | `-n my-agent` |
| `-f, --from <source>` | Template ID or config file | `-f coding-assistant` |
| `--clone <id>` | Clone from existing agent | `--clone my-agent` |
| `--with-sessions` | Include sessions when cloning | `--with-sessions` |
| `--type <type>` | Agent type | `--type claude-code` |
| `--json` | Output in JSON format | `--json` |

## Best Practices

### Naming Conventions

- Use lowercase letters, numbers, and hyphens
- Keep names descriptive but concise
- Examples: `code-reviewer`, `research-assistant`, `main-v2`

### When to Create vs Clone

| Scenario | Recommendation |
|----------|----------------|
| Fresh start | Create new agent |
| Preserve memory | Clone existing agent |
| Test configuration | Clone with `--with-sessions` |
| Production backup | Clone periodically |

### Organization Tips

1. **Use templates** for common configurations
2. **Name agents by purpose** (e.g., `code-reviewer`, `doc-writer`)
3. **Keep one primary agent** for daily work
4. **Archive old agents** instead of deleting

## Troubleshooting

### Agent Already Exists

```
Error: Agent 'my-agent' already exists
```

**Solution:** Choose a different name or remove the existing agent first.

### Template Not Found

```
Error: Template 'unknown-template' not found
```

**Solution:** List available templates with `viben agent template list`.

### Invalid Agent ID

```
Error: Invalid agent ID 'my agent'
```

**Solution:** Use only lowercase letters, numbers, and hyphens. No spaces allowed.

## Next Steps

- [Agent Configuration](./agent-configuration) - Configure your agent
- [Memory System](./memory-system) - Set up agent memory
- [Templates](./templates) - Create and use templates
