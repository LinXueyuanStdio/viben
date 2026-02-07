---
sidebar_position: 1
title: "Agent Management"
description: "Overview of Viben CLI agent management - concepts, architecture, and commands"
---

# Agent Management

Viben CLI provides comprehensive tools for managing AI agents. An **agent** is an independent AI assistant instance with its own configuration, memory, and sessions.

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | An independent AI assistant instance with its own configuration, memory, and sessions |
| **Template** | A reusable agent configuration template for creating new agents |
| **Memory** | Agent's long-term memory (MEMORY.md + daily logs) |
| **Session** | Agent's conversation history and state |
| **Workspace Config** | Project-specific agent type configuration (e.g., `.claude/`) |

## Architecture Overview

```
                          Viben CLI
+---------------------------------------------------------+
|  Agent Template (Reusable agent configuration template)  |
|    |                                                     |
|    +-- Agent Instance (Independent agent instance)       |
|          |-- config.yaml (Agent configuration)           |
|          |-- mcp_servers.json (MCP configuration)        |
|          |-- skills/ (Agent-specific skills)             |
|          |-- memory/ (Agent memory)                      |
|          |   |-- MEMORY.md (Main memory)                 |
|          |   +-- YYYY-MM-DD.md (Daily logs, append-only) |
|          |-- .agentrc (Startup configuration)            |
|          |-- .agent_history (Command history)            |
|          +-- .agent_sessions/<session_id>/ (Sessions)    |
+---------------------------------------------------------+
```

## Agent Directory Structure

Each agent is stored in `~/.viben/agents/<agent-id>/`:

```
~/.viben/agents/<agent-id>/
|-- config.yaml              # Agent configuration
|-- mcp_servers.json         # MCP servers configuration
|-- skills/                  # Agent-specific skills
|-- memory/                  # Agent memory
|   |-- MEMORY.md            # Main memory file (structured knowledge)
|   |-- 2024-01-15.md        # Daily log (append-only)
|   |-- 2024-01-16.md        # Read today + yesterday at session start
|   +-- ...
|-- .agentrc                 # Agent startup configuration
|-- .agent_history           # Command history
+-- .agent_sessions/         # Session storage
    +-- <session_id>/
        |-- config.yaml              # Session configuration
        +-- messages.rollout.jsonl   # Message history (JSONL)
```

## Runtime Config Merging

When an agent runs, configuration is merged in the following order:

```
1. ~/.viben/agents/<id>/config.yaml     # Agent base configuration
2. <project>/.claude/ (or other type)   # Workspace agent type config
3. Command line arguments               # Runtime overrides
```

For example: Running agent `main` in `/projects/my-app` directory will first load `~/.viben/agents/main/config.yaml`, then overlay `/projects/my-app/.claude/` configuration.

## Agent vs Template

| Aspect | Agent | Template |
|--------|-------|----------|
| **Purpose** | Active AI assistant instance | Reusable configuration blueprint |
| **Storage** | `~/.viben/agents/<id>/` | `~/.viben/agent-templates/<id>/` |
| **Memory** | Has memory and sessions | No runtime state |
| **Usage** | Direct interaction | Create new agents |

## Quick Commands

```bash
# List all agents
viben agent list

# Create a new agent
viben agent create -n my-agent

# Create from template
viben agent create -n my-agent -f coding-assistant

# Clone existing agent
viben agent create -n my-agent --clone existing-agent

# Show agent details
viben agent show -n my-agent

# Configure agent
viben agent config -n my-agent set model gpt-4

# Remove agent
viben agent remove -n my-agent

# Set default agent
viben agent set-default -n my-agent

# Check agent status
viben agent status
```

## Command Output Formats

All agent commands support the `--json` flag for machine-readable output:

**Human-readable output:**
```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

**JSON output (`--json` flag):**
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
      }
    ]
  }
}
```

## Supported Agent Types

| Type | Description |
|------|-------------|
| `claude-code` | Claude Code (Anthropic) |
| `cursor` | Cursor AI |
| `gemini` | Google Gemini |
| `codex` | OpenAI Codex |
| `windsurf` | Windsurf |
| `amp` | Amp |
| `opencode` | OpenCode |
| `qwen-code` | Qwen Code |
| `droid` | Droid |

## Next Steps

- [Creating Agents](creating-agents) - Create and manage agents
- [Agent Configuration](agent-configuration) - Configure agent settings
- [Memory System](memory-system) - Understand agent memory
- [Sessions](sessions) - Manage agent sessions
- [Templates](templates) - Use agent templates
