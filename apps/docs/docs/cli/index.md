---
sidebar_position: 1
title: "CLI Overview"
description: "Viben CLI - Command-line interface for Agent Swarm x Code Evolution"
---

# Viben CLI

**Viben CLI** (`viben`) is the command-line interface for **Agent Swarm x Code Evolution** - an intelligent system that orchestrates multiple AI agents to continuously evolve and optimize your codebase.

## What is Viben CLI?

Viben CLI enables a new paradigm of software development where AI agent swarms collaborate to iteratively improve code quality, generate ideas, and manage complex development tasks autonomously.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **FileEvo** | File-based self-evolution for code optimization - agents iteratively improve code through multi-dimensional evaluation |
| **Agent Swarm** | Orchestrate multiple specialized agents working in parallel on different aspects of your codebase |
| **Task System** | XState-powered task management with state machines for complex development workflows |
| **Idea Generation** | AI-driven ideation for features, refactoring opportunities, and architectural improvements |

## Key Features

| Feature | Description |
|--------|-------------|
| **Task Management** | Create, queue, and track development tasks with state machine workflows |
| **Swarm Orchestration** | Coordinate multiple agents with different specializations |
| **Agent Management** | Create, configure, and manage AI agent instances |
| **Provider Configuration** | Set up API providers (OpenAI, Anthropic, Google, Azure, etc.) |
| **Model Management** | Configure model aliases, fallback chains, and model-level settings |
| **Executor Discovery** | Discover locally installed executors (Claude Code, Cursor, etc.) |
| **MCP Server Management** | Install, enable, and configure MCP servers |
| **Skill Management** | Install and manage agent skills |
| **Gateway Runtime** | Start the core runtime connecting channels to agent loops |
| **Channel Management** | Configure chat channels (Telegram, Discord, Feishu, etc.) |
| **Cron Scheduling** | Manage scheduled tasks for agents |
| **Queue System** | Background command execution with concurrency control |
| **Scope Awareness** | Auto-detect workspace, support global/workspace configuration |

## Design Principles

### Agent Swarm x Code Evolution

The CLI is designed around the core philosophy of continuous code improvement through AI collaboration:

- **FileEvo**: Agents learn from code change outcomes to make better decisions
- **Swarm Intelligence**: Multiple specialized agents work in parallel
- **Task-Driven**: XState state machines manage complex development workflows
- **Idea Generation**: AI proactively suggests improvements and features

### Human-Machine Friendly

- **Human Mode**: Colored, formatted terminal output (default)
- **Machine Mode**: Use `--json` flag for structured JSON output, easy for AI agents to parse

### Scope Awareness

CLI automatically detects your workspace context:
- If current directory contains `.viben/`, use workspace configuration
- Otherwise use global configuration (`~/.viben/`)
- Override with `--global` or `--workspace` flags

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Runtime | Node.js | Reuse existing TypeScript code and packages |
| Framework | Commander.js | Mature, stable, rich ecosystem |
| State Machine | XState | Robust task workflow management |
| Configuration | YAML | Human-readable, supports comments |
| Output | Chalk + JSON | Colored terminal + structured output |

## Command Overview

```
viben <command> [subcommand] [options]

Core Commands (Agent Swarm x Code Evolution):
  task          XState-powered task management with state machine workflows
  swarm         Orchestrate multiple agents working in parallel
  idea          AI-driven ideation for features and improvements
  queue         Background command execution with concurrency control

Agent & Configuration:
  agent         Manage agent instances and templates
  provider      Manage API providers (OpenAI, Anthropic, etc.)
  model         Manage models, aliases, and fallback chains
  executor      Discover and view executors (Claude Code, Cursor, etc.)
  mcp           Manage MCP servers
  skill         Manage skills

Workspace & Service:
  init          Initialize workspace in current directory
  config        Configuration management (git-style)
  service       Manage background services
  gateway       Start Gateway (message bus + agent loop)
  channel       Manage chat channels (Telegram, Discord, Feishu, etc.)
  cron          Manage scheduled tasks
  team          Team collaboration workspace management
  workspace     Workspace operations
  version       Show version information
  help          Show help
```

### Global Options

All commands support these global options:

| Option | Description |
|--------|-------------|
| `--json` | Output JSON (for agent parsing) |
| `--global`, `-g` | Use global configuration |
| `--workspace` | Use workspace configuration (current directory) |
| `-n`, `--name <id>` | Specify agent name/ID (default: current or 'main') |
| `--verbose`, `-v` | Verbose output |
| `--quiet`, `-q` | Suppress non-essential output |
| `--help`, `-h` | Show help |

## Architecture Overview

```
~/.viben/                                    # State directory
├── config.yaml                              # Global configuration
├── queue/                                   # Command queue (background execution)
├── agents/                                  # Agent instances
│   └── <agent-id>/                          # Individual agent
│       ├── config.yaml                      # Agent configuration
│       ├── mcp_servers.json                 # MCP server configuration
│       ├── skills/                          # Agent-specific skills
│       ├── memory/                          # Agent memory
│       │   ├── MEMORY.md                    # Main memory file
│       │   └── YYYY-MM-DD.md                # Daily logs
│       ├── .agentrc                         # Startup configuration
│       ├── .agent_history                   # Command history
│       └── .agent_sessions/                 # Session storage
├── providers.yaml                           # API provider configuration
├── models.yaml                              # Model configuration
├── channels.yaml                            # Channel configuration
├── cron.yaml                                # Scheduled task configuration
├── mcp/                                     # Shared MCP servers
└── skills/                                  # Shared skills

<project>/.viben/                            # Workspace configuration (optional)
├── config.yaml                              # Workspace-specific overrides
└── tasks/                                   # Task storage (XState workflows)
    └── <task-id>/
        ├── task.json                        # Task state and metadata
        └── context.md                       # Task context and notes
```

## Configuration File Format

Viben CLI uses YAML for human-readable configuration:

```yaml
# ~/.viben/config.yaml
version: 1

# Global settings
settings:
  editor: code
  pager: less
  color: auto

# Default MCP servers
mcp:
  enabled:
    - filesystem
    - git

# Default skills
skills:
  enabled:
    - code-review
    - commit

# Swarm configuration
swarm:
  default_roles:
    - architect
    - implementer
    - reviewer
  max_parallel_agents: 4
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VIBEN_STATE_DIR` | State directory | `~/.viben` |
| `VIBEN_CONFIG_PATH` | Configuration file path | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | Current agent ID | `main` |
| `VIBEN_SCOPE` | Configuration scope | Auto-detect |

## Agent Integration

AI agents can use Viben CLI through Bash tool calls. The `--json` flag ensures structured output for agent parsing:

```bash
# Task management workflow
viben task create "implement-auth" --json
viben task enqueue implement-auth --json
viben task status implement-auth --json

# Swarm orchestration
viben swarm start --task implement-auth --json

# Idea generation
viben idea generate --context "auth system" --json

# Configuration
viben config list --json
viben agent config my-agent set model gpt-4 --json
```

### JSON Response Format

All commands with `--json` flag return structured responses:

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "implement-auth",
      "state": "in_progress",
      "agents": ["architect", "implementer"]
    }
  }
}
```

Error responses include error codes for programmatic handling:

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'unknown-task' not found in workspace"
  }
}
```

## Next Steps

- [Installation](./installation.md) - Install Viben CLI
- [Quick Start](./quick-start.md) - Begin basic configuration
- [Task System](./commands/task.md) - Learn about XState-powered task management
- [Agent Swarm](/cli/agents/) - Understand multi-agent orchestration
