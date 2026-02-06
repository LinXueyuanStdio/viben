---
sidebar_position: 3
title: "Agent Configuration"
description: "Configure Viben agents - config.yaml, MCP servers, skills, and RC files"
---

# Agent Configuration

This guide covers all aspects of agent configuration, including the main configuration file, MCP servers, skills, and startup configuration.

## Configuration Files Overview

Each agent has several configuration files:

| File | Purpose |
|------|---------|
| `config.yaml` | Main agent configuration |
| `mcp_servers.json` | MCP servers configuration |
| `.agentrc` | Startup configuration (environment, defaults) |
| `skills/` | Agent-specific skills directory |

## Main Configuration (config.yaml)

### File Location

```
~/.viben/agents/<agent-id>/config.yaml
```

### Structure

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

# Agent metadata
id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

# Agent type (determines runtime behavior)
type: claude-code  # claude-code | cursor | gemini | codex | ...

# Type-specific configuration
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: "You are a helpful coding assistant."

# MCP configuration (can also be in mcp_servers.json)
mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

# Skills configuration
skills:
  enabled:
    - code-review
    - commit
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Configuration version (always `1`) |
| `id` | string | Agent ID (must match directory name) |
| `name` | string | Human-readable agent name |
| `description` | string | Agent description |
| `created` | string | Creation timestamp (ISO 8601) |
| `type` | string | Agent type (see supported types) |
| `type_config` | object | Type-specific configuration |
| `mcp` | object | MCP servers configuration |
| `skills` | object | Skills configuration |

### Type-Specific Configuration

Each agent type has its own configuration options:

**Claude Code (`claude-code`):**
```yaml
type_config:
  plan: true                          # Enable planning mode
  dangerously_skip_permissions: false # Skip permission checks
  append_prompt: "Custom instructions" # Additional system prompt
```

**Cursor (`cursor`):**
```yaml
type_config:
  composer: true      # Enable composer mode
  rules_file: ".cursorrules"
```

**Gemini (`gemini`):**
```yaml
type_config:
  safety_settings: default
  generation_config:
    temperature: 0.7
    max_output_tokens: 8192
```

## Configuring via CLI

### View Configuration

```bash
viben agent config -n <agent-id>
```

**Example:**
```bash
viben agent config -n my-agent
```

**Output:**
```yaml
version: 1
id: my-agent
name: "My Coding Assistant"
type: claude-code
type_config:
  plan: true
mcp:
  enabled:
    - filesystem
    - git
skills:
  enabled:
    - code-review
```

### Set Configuration Values

```bash
viben agent config -n <agent-id> set <key> <value>
```

**Examples:**
```bash
# Set model
viben agent config -n my-agent set model gpt-4

# Enable planning
viben agent config -n my-agent set plan true

# Set agent name
viben agent config -n my-agent set name "My Custom Agent"

# Configure MCP servers (JSON array)
viben agent config -n my-agent set mcp.enabled '["filesystem","git"]'

# Set nested values using dot notation
viben agent config -n my-agent set type_config.temperature 0.8
```

### Get Specific Value

```bash
viben agent config -n <agent-id> get <key>
```

**Example:**
```bash
viben agent config -n my-agent get type_config.plan
```

**Output:**
```
true
```

## MCP Servers Configuration

### File Location

```
~/.viben/agents/<agent-id>/mcp_servers.json
```

### Structure

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
    "custom-mcp": {
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### MCP Server Entry Fields

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Command to run (e.g., `npx`, `python`) |
| `args` | array | Command arguments |
| `env` | object | Environment variables for the server |

### Managing MCP via CLI

```bash
# Enable an MCP server
viben mcp enable filesystem -n my-agent

# Disable an MCP server
viben mcp disable browser -n my-agent

# List MCP servers for agent
viben mcp list -n my-agent

# Configure MCP server
viben mcp config filesystem set root /path/to/dir -n my-agent
```

## Skills Configuration

Skills are configured in the agent's `config.yaml` and stored in the `skills/` directory:

### Directory Structure

```
~/.viben/agents/<agent-id>/skills/
|-- code-review/
|   |-- config.yaml
|   +-- prompts/
+-- commit/
    |-- config.yaml
    +-- templates/
```

### Skills in config.yaml

```yaml
skills:
  enabled:
    - code-review
    - commit
    - test-runner
  disabled:
    - documentation
```

### Managing Skills via CLI

```bash
# Install a skill to agent
viben skill install code-review -n my-agent

# List skills for agent
viben skill list -n my-agent

# Enable/disable skills
viben skill enable code-review -n my-agent
viben skill disable documentation -n my-agent
```

## Agent RC File (.agentrc)

The `.agentrc` file contains startup configuration that runs when the agent starts.

### File Location

```
~/.viben/agents/<agent-id>/.agentrc
```

### Structure

```bash
# ~/.viben/agents/my-agent/.agentrc
# Agent startup configuration

# Environment variables
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# Default session
DEFAULT_SESSION="main"

# Memory configuration
MEMORY_FILES="MEMORY.md"
DAILY_LOG_DAYS=2  # Read today + yesterday

# Custom settings
CUSTOM_VAR="custom-value"
```

### RC File Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_SESSION` | Default session to use | `main` |
| `MEMORY_FILES` | Memory files to load | `MEMORY.md` |
| `DAILY_LOG_DAYS` | Number of daily logs to read | `2` |

## Configuration Precedence

Configuration is merged in the following order (later overrides earlier):

1. **Agent base config** (`~/.viben/agents/<id>/config.yaml`)
2. **Workspace config** (`<project>/.viben/config.yaml`)
3. **Agent type workspace config** (`<project>/.claude/`, `.cursor/`, etc.)
4. **Environment variables**
5. **Command line arguments**

### Example

```bash
# Agent config sets model to claude-sonnet-4
# Workspace config sets model to gpt-4
# Command line overrides to gpt-4-turbo

viben agent run -n my-agent --model gpt-4-turbo
# Result: uses gpt-4-turbo
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VIBEN_STATE_DIR` | State directory | `~/.viben` |
| `VIBEN_AGENT` | Current agent ID | `main` |
| `VIBEN_CONFIG_PATH` | Config file path | `~/.viben/config.yaml` |
| `VIBEN_SCOPE` | Configuration scope | Auto-detected |

## Best Practices

### Security

1. **Never commit API keys** to version control
2. Use environment variables for sensitive values
3. Use `encrypted:` prefix for stored credentials

### Organization

1. Keep configuration minimal - use defaults when possible
2. Document custom settings with comments
3. Use templates for common configurations

### Debugging

```bash
# View effective configuration with all merges applied
viben agent config -n my-agent --effective

# Show configuration sources
viben agent config -n my-agent --show-origin
```

## Next Steps

- [Memory System](./memory-system) - Configure agent memory
- [Sessions](./sessions) - Manage agent sessions
- [Templates](./templates) - Create configuration templates
