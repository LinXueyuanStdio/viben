---
sidebar_position: 1
title: "Commands Overview"
description: "Viben CLI commands for Agent Swarm x Code Evolution"
---

# Commands Overview

Viben CLI (`viben`) is the command-line interface for **Agent Swarm x Code Evolution**. It enables orchestration of AI agent swarms for continuous code improvement and intelligent task management.

## Command Structure

```
viben <command> [subcommand] [options]
```

## Core Commands (Agent Swarm x Code Evolution)

These commands represent the primary workflow for code evolution:

| Command | Description |
|---------|-------------|
| [`task`](./task.md) | XState-powered task management with state machine workflows |
| [`swarm`](./swarm.md) | Orchestrate multiple agents working in parallel |
| [`idea`](./idea.md) | AI-driven ideation for features and improvements |
| [`queue`](./queue.md) | Background command execution with concurrency control |

## Agent & Configuration Commands

| Command | Description |
|---------|-------------|
| [`agent`](./agent.md) | Manage agent instances and templates |
| [`provider`](./provider.md) | Manage API providers (OpenAI, Anthropic, etc.) |
| [`model`](./model.md) | Manage models, aliases, and fallback chains |
| [`executor`](./executor.md) | Discover and view executors (Claude Code, Cursor, etc.) |
| [`mcp`](./mcp.md) | Manage MCP servers |
| [`skill`](./skill.md) | Manage skills |

## Workspace & Service Commands

| Command | Description |
|---------|-------------|
| [`init`](./init.md) | Initialize workspace in current directory |
| [`config`](./config.md) | Configuration management (git-style) |
| [`service`](./service.md) | Manage background services |
| [`gateway`](./gateway.md) | Start Gateway (message bus + agent loop) |
| [`channel`](./channel.md) | Manage chat channels (Telegram, Discord, etc.) |
| [`cron`](./cron.md) | Manage scheduled tasks |
| [`team`](./team.md) | Team collaboration workspace management |
| [`workspace`](./workspace.md) | Workspace operations |
| `version` | Show version information |
| `help` | Show help |

## Global Options

These options apply to all commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--json` | | Output JSON (for agent parsing) |
| `--global` | `-g` | Use global configuration |
| `--workspace` | | Use workspace configuration (current directory) |
| `--name <id>` | `-n` | Specify agent name/ID (default: current or 'main') |
| `--verbose` | `-v` | Verbose output |
| `--quiet` | `-q` | Suppress non-essential output |
| `--help` | `-h` | Show help |

## JSON Output Format

All commands support the `--json` flag for structured output, useful for AI agents and scripts.

### Response Structure

```typescript
interface CLIResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "implement-auth",
      "state": "in_progress",
      "swarm": ["architect", "implementer"]
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task 'unknown-task' not found in workspace"
  }
}
```

## Scope Resolution

CLI automatically detects scope (global or workspace) based on current directory:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | Command line flag | `--global` or `--workspace` |
| 2 | Environment variable | `VIBEN_SCOPE` |
| 3 | Auto-detect | If `.viben/` exists in current or parent directory: workspace; otherwise: global |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VIBEN_STATE_DIR` | State directory | `~/.viben` |
| `VIBEN_CONFIG_PATH` | Configuration file path | `~/.viben/config.yaml` |
| `VIBEN_AGENT` | Current agent ID | `main` |
| `VIBEN_SCOPE` | Configuration scope | Auto-detect |

## Configuration Files

### Global Configuration

Located at `~/.viben/config.yaml`:

```yaml
version: 1

settings:
  editor: code
  pager: less
  color: auto

# Swarm configuration
swarm:
  default_roles:
    - architect
    - implementer
    - reviewer
  max_parallel_agents: 4

# FileRL settings
filerl:
  enabled: true
  metrics:
    - code_quality
    - test_coverage
    - complexity

mcp:
  enabled:
    - filesystem
    - git

skills:
  enabled:
    - code-review
    - commit
```

### Workspace Configuration

Located at `<project>/.viben/config.yaml`, overrides global settings for the workspace.

## Agent Integration

AI agents can use CLI through Bash tools:

```bash
# Task workflow (primary use case)
viben task create "implement-auth" --json
viben task enqueue implement-auth --json
viben task start implement-auth --json

# Swarm orchestration
viben swarm start --task implement-auth --json
viben swarm status --json

# Idea generation
viben idea generate --context "improve auth" --json

# Configuration
viben config list --json
viben agent sync claude-code --json
```

## Next Steps

- [viben task](./task.md) - XState-powered task management
- [viben swarm](./swarm.md) - Multi-agent orchestration
- [viben idea](./idea.md) - AI-driven ideation
- [viben queue](./queue.md) - Background command execution
- [viben agent](./agent.md) - Manage agents
- [viben gateway](./gateway.md) - Start Gateway
