---
sidebar_position: 8
title: "viben agent"
description: "Manage agent instances, templates, sessions, and memory"
---

# viben agent

Manage agent instances, templates, sessions, and memory.

## Usage

```bash
viben agent <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List all agents |
| `create` | Create a new agent |
| `show` | Show agent details |
| `remove` | Remove an agent |
| `config` | View or set agent configuration |
| `set-default` | Set the default agent |
| `status` | Show agent status |
| `template` | Manage agent templates |
| `session` | Manage agent sessions |
| `memory` | Manage agent memory |

## Agent Management

### List Agents

List all configured agents:

```bash
viben agent list
viben agent list --json
```

**Output (Human-readable):**

```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

**Output (JSON):**

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

### Create Agent

Create a new agent:

```bash
# Create new agent
viben agent create -n my-agent

# Create from template
viben agent create -n my-agent -f coding-assistant

# Create from config file
viben agent create -n my-agent -f /path/to/config.yaml

# Clone existing agent
viben agent create -n my-agent --clone main
```

**Output:**

```
Created agent 'my-agent'
  Path: ~/.viben/agents/my-agent/
```

**JSON output:**

```json
{
  "success": true,
  "data": {
    "id": "my-agent",
    "path": "~/.viben/agents/my-agent/"
  }
}
```

### Show Agent

Show agent details:

```bash
viben agent show -n my-agent
```

**Output (Human-readable):**

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

### Remove Agent

Remove an agent:

```bash
# Remove agent (with confirmation)
viben agent remove -n my-agent

# Force remove without confirmation
viben agent remove -n my-agent --force
```

**Output:**

```
Removed agent 'my-agent'
```

### Configure Agent

View or set agent configuration:

```bash
# View configuration
viben agent config -n my-agent

# Set configuration value
viben agent config -n my-agent set model gpt-4
viben agent config -n my-agent set plan true
viben agent config -n my-agent set mcp.enabled '["filesystem", "git"]'
```

**Output (View):**

```yaml
id: my-agent
name: "My Coding Assistant"
type: claude-code
type_config:
  plan: true
  dangerously_skip_permissions: false
mcp:
  enabled:
    - filesystem
    - git
skills:
  enabled:
    - code-review
    - commit
```

### Set Default Agent

Set the default agent:

```bash
viben agent set-default -n my-agent
```

**Output:**

```
Set 'my-agent' as default agent
```

### Agent Status

Show agent status:

```bash
# All agents status
viben agent status

# Specific agent status
viben agent status -n my-agent
```

## Template Management

### List Templates

```bash
viben agent template list
viben agent template list --json
```

**Output (Human-readable):**

```
Agent Templates:
  coding-assistant    claude-code   "General coding assistant"
  researcher          gemini        "Research and analysis"
  code-reviewer       claude-code   "Code review specialist"
```

### Create Template

Create a template from an existing agent:

```bash
viben agent template create -n coding-assistant --clone my-agent
```

**Output:**

```
Created template 'coding-assistant' from agent 'my-agent'
```

### Show Template

```bash
viben agent template show -n coding-assistant
```

### Remove Template

```bash
viben agent template remove -n coding-assistant
```

## Session Management

### List Sessions

```bash
viben agent session list -n my-agent
```

**Output:**

```
Sessions for my-agent:
  main     "Feature development"   2h ago    42 messages
  feature  "Auth implementation"   1d ago    128 messages
  bugfix   "Fix login issue"       3d ago    23 messages
```

### Create Session

```bash
viben agent session create -n my-agent "feature-auth"
```

**Output:**

```
Created session 'feature-auth' for agent 'my-agent'
```

### Show Session

```bash
viben agent session show -n my-agent -s main
```

### Remove Session

```bash
viben agent session remove -n my-agent -s feature-auth
```

### Clear Session History

```bash
viben agent session clear -n my-agent -s main
```

## Memory Management

### Show Memory

```bash
# Show all memory
viben agent memory show -n my-agent

# Show specific date
viben agent memory show -n my-agent --date 2024-01-16
```

**Output:**

```
Memory for my-agent:

=== MEMORY.md (2.3 KB) ===
# Agent Memory

## Key Learnings
- Project uses TypeScript with strict mode
- Prefer functional components...

=== 2024-01-16.md (today) ===
# 2024-01-16

## 10:30 - Session started
- Working on feature X
- Discovered issue with Y
```

### Append Memory

Append content to today's log:

```bash
viben agent memory append -n my-agent "Completed feature X implementation"
```

**Output:**

```
Appended to 2024-01-16.md
```

### Edit Memory

Open memory file in editor:

```bash
# Edit main memory file
viben agent memory edit -n my-agent

# Edit specific date
viben agent memory edit -n my-agent --date 2024-01-16
```

## Agent Configuration File

```yaml
# ~/.viben/agents/my-agent/config.yaml
version: 1

id: my-agent
name: "My Coding Assistant"
description: "A helpful coding assistant"
created: 2024-01-15T10:30:00Z

type: claude-code

type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: "You are a helpful coding assistant."

mcp:
  enabled:
    - filesystem
    - git
  disabled:
    - browser

skills:
  enabled:
    - code-review
    - commit
```

## Agent Types

| Type | Description |
|------|-------------|
| `claude-code` | Claude Code agent |
| `cursor` | Cursor agent |
| `gemini` | Gemini agent |
| `codex` | OpenAI Codex agent |
| `windsurf` | Windsurf agent |
| `amp` | AMP agent |
| `opencode` | OpenCode agent |
| `qwen-code` | Qwen Code agent |
| `droid` | Droid agent |

## Error Handling

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

### Agent Already Exists

```json
{
  "success": false,
  "error": {
    "code": "AGENT_EXISTS",
    "message": "Agent 'my-agent' already exists"
  }
}
```

## Related Commands

- [viben provider](./provider) - Provider management
- [viben model](./model) - Model management
- [viben mcp](./mcp) - MCP server management
- [viben skill](./skill) - Skill management
