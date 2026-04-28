---
sidebar_position: 8
title: "viben agent"
description: "Manage agent instances, templates, sessions and memory"
---

# viben agent

Manage agent instances, templates, sessions and memory.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Viben CLI                            │
├─────────────────────────────────────────────────────────┤
│  Agent Instance (Independent agent instance)            │
│      ├── config.yaml (Agent configuration)              │
│      ├── mcp_servers.json (MCP configuration)           │
│      ├── skills/ (Agent-specific skills)                │
│      ├── memory/ (Agent memory)                         │
│      │   ├── MEMORY.md (Main memory)                    │
│      │   └── YYYY-MM-DD.md (Daily logs, append-only)    │
│      ├── .agentrc (Startup configuration)               │
│      ├── .agent_history (Command history)               │
│      └── .agent_sessions/<session_id>/ (Session storage)│
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | Independent agent instance with its own configuration, memory, sessions |
| **Memory** | Agent's long-term memory (MEMORY.md + daily logs) |
| **Session** | Agent's session storage (conversation history, state) |
| **Workspace Config** | Project workspace agent type configuration (e.g., `.claude/`) |

## Usage

```bash
viben agent <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List all agents |
| `create` | Create new agent |
| `show` | Show agent details |
| `remove` | Delete agent |
| `config` | View or set agent configuration |
| `set-default` | Set default agent |
| `set-template` | Set as template |
| `status` | Show agent status |
| `template` | Manage agent templates |
| `session` | Manage agent sessions |
| `memory` | Manage agent memory |
| `chat` | Non-interactive conversation with agent |

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

# Use specific executor
viben agent create -n my-agent --executor /path/to/executor
```

**Output:**

```
Created agent 'my-agent'
  Path: ~/.viben/agents/my-agent/
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

Delete an agent:

```bash
# Delete agent (requires confirmation)
viben agent remove -n my-agent

# Force delete without confirmation
viben agent remove -n my-agent --force
```

### Configure Agent

View or set agent configuration:

```bash
# View configuration
viben agent config -n my-agent

# Set configuration value
viben agent config -n my-agent --set model=gpt-4
viben agent config -n my-agent --set plan=true
viben agent config -n my-agent --set mcp.enabled='["filesystem", "git"]'
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

```bash
viben agent set-default -n my-agent
```

**Output:**

```
Set 'my-agent' as default agent
```

### Set as Template

```bash
viben agent set-template -n my-agent --description "A general coding assistant template"
```

### Agent Status

Show agent status:

```bash
# All agents status
viben agent status

# Specific agent status
viben agent status -n my-agent
```

## Agent Chat

Non-interactive conversation with a specified agent:

```bash
# Basic usage
viben agent chat -n my-agent -p "Analyze this code"

# Read from stdin
echo "Write a sorting function" | viben agent chat -n my-agent

# Specify working directory
viben agent chat -n my-agent -p "Analyze project structure" -C /path/to/project

# Use specific session
viben agent chat -n my-agent -p "Continue previous work" -s main

# Resume existing session
viben agent chat -n my-agent -p "Continue" --resume abc123

# Force create new session
viben agent chat -n my-agent -p "Start new task" --new-session

# Override model
viben agent chat -n my-agent -p "Complex reasoning task" --model claude-3-opus

# Don't load memory
viben agent chat -n my-agent -p "Independent task" --no-memory

# JSON format output
viben agent chat -n my-agent -p "Quick task" --json
```

### Chat Options

| Option | Description |
|--------|-------------|
| `-n, --name <id>` | Agent ID (required) |
| `-p, --prompt <prompt>` | Prompt (optional, reads from stdin if not provided) |
| `-C, --cwd <dir>` | Working directory (default: current directory) |
| `-s, --session <id>` | Specify session ID |
| `--resume <id>` | Resume existing session |
| `--new-session` | Force create new session |
| `--model <model>` | Override agent's configured model |
| `--no-memory` | Don't load agent memory |
| `--dangerously-skip-permissions` | Skip permission checks |
| `--input-format <format>` | Input format: text, stream-json |
| `--output-format <format>` | Output format: text, stream-json |
| `--verbose` | Verbose output |
| `--json` | JSON format output |

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

Create template from existing agent:

```bash
viben agent template create -n coding-assistant --clone my-agent
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
viben agent session create -n my-agent --session-name "feature-auth"
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

# MCP configuration
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

## Agent Directory Structure

Each agent instance is stored under `~/.viben/agents/<agent-id>/` with the following structure:

```
~/.viben/agents/<agent-id>/
├── config.yaml              # Agent configuration
├── mcp_servers.json         # MCP servers configuration
├── skills/                  # Agent-specific skills
├── memory/                  # Agent memory
│   ├── MEMORY.md            # Main memory file (structured knowledge)
│   ├── 2024-01-15.md        # Daily log (append-only)
│   ├── 2024-01-16.md        # Session startup reads today + yesterday
│   └── ...
├── .agentrc                 # Agent startup configuration
├── .agent_history           # Command history
└── .agent_sessions/         # Session storage
    └── <session_id>/
        ├── config.yaml              # Session configuration
        └── messages.rollout.jsonl   # Message history (JSONL)
```

## Agent RC File (.agentrc)

Each agent can have an `.agentrc` file that is sourced when the agent starts up. This file can set environment variables, default session preferences, and memory loading options.

```bash
# ~/.viben/agents/my-agent/.agentrc
# Configuration sourced at agent startup

# Environment variables
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OPENAI_API_KEY="sk-xxx"

# Default session
DEFAULT_SESSION="main"

# Memory files to load at startup
MEMORY_FILES="MEMORY.md"
DAILY_LOG_DAYS=2  # Read today + yesterday
```

You can also place a project-level `.agentrc` file in your project directory to provide workspace-specific overrides. When both files exist, the project-level `.agentrc` is merged on top of the agent-level one:

```
1. ~/.viben/agents/<id>/.agentrc    # Agent-level defaults
2. <project>/.agentrc               # Project-level overrides
```

## MCP Servers Configuration

```json
// ~/.viben/agents/my-agent/mcp_servers.json
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
    }
  }
}
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
| `aider` | Aider agent |

## Runtime Configuration Merging

When an agent runs, configuration is merged in the following order:

```
1. ~/.viben/agents/<id>/config.yaml     # Agent base configuration
2. <project>/.claude/ (or other agent type)  # Workspace agent type configuration
3. Command line arguments                    # Runtime overrides
```

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

- [viben executor](./executor) - Executor management
- [viben provider](./provider) - Provider management
- [viben model](./model) - Model management
- [viben mcp](./mcp) - MCP server management
- [viben skill](./skill) - Skill management
