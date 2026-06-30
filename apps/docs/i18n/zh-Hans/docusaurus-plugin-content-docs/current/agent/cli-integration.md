---
sidebar_position: 4
title: CLI Integration Guide
description: Complete Viben CLI Command Reference
---

# CLI Integration Guide

This document provides a complete command reference for the Viben CLI, covering Agent management, MCP configuration, Skill management, Executor usage, and more.

## Command Structure

```
viben <command> [subcommand] [options]

Commands:
  # Core Initialization & Configuration
  init          Initialize workspace (full team workspace with executors)
  update        Update workspace components (idea-types, reward-types)
  config        Configuration management (git-style)
  workspace     Workspace operations
  user          Manage user identity (init, get, status)

  # Services & Runtime
  service       Manage background services
  gateway       Start the gateway (message bus + agent loop)

  # Executors & Agents
  executor      Discover and inspect executors (Claude Code, Cursor, etc.)
  agent         Manage agent instances and templates

  # Tasks & Swarm Orchestration
  task          Manage tasks (CRUD, context, planning, monitoring)
  queue         Background command execution queue
  swarm         Agent swarm orchestration (list, start, stop, cleanup)

  # Models & Providers
  provider      Manage API providers (OpenAI, Anthropic, etc.)
  model         Manage models, aliases, and fallbacks

  # Extensions & Integrations
  mcp           Manage MCP servers
  skill         Manage skills
  channel       Manage chat channels (Telegram, Discord, WhatsApp, Feishu)

  # Automation
  cron          Manage scheduled tasks

  # AI Assisted
  idea          AI-powered idea generation (generate, list, promote)
  evo           FileEvo - File-based Self-Evolution for code optimization
  session       Session recording and management
  context       Get current development context

  # General
  version       Show version info
  help          Show help
```

## Global Options

```
--json              JSON format output
--global, -g        Use global configuration
--workspace         Use workspace configuration
-n, --name <id>     Specify agent name/ID
--verbose, -v       Verbose output
--quiet, -q         Quiet mode
--help, -h          Show help
```

## Agent Management Commands

### viben agent list

List all agents.

```bash
# List all agents
viben agent list

# JSON format output
viben agent list --json
```

Example output:

```
Agents:
  main*         claude-code   3 sessions   ~/.viben/agents/main/
  my-agent      claude-code   1 session    ~/.viben/agents/my-agent/
  research-bot  gemini        0 sessions   ~/.viben/agents/research-bot/

* = current agent
```

### viben agent create

Create a new agent.

```bash
# Create a new agent
viben agent create -n <id>
viben agent create -n my-agent

# Create from template
viben agent create -n my-agent -f <template-agent-id>
viben agent create -n my-agent -f /path/to/config.yaml

# Clone an existing agent
viben agent create -n my-agent --clone <existing-agent-id>

# Use a specific executor
viben agent create -n my-agent --executor /path/to/executor
```

### viben agent show

View agent details.

```bash
viben agent show -n <id>
viben agent show -n my-agent
```

Example output:

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

### viben agent remove

Delete an agent.

```bash
viben agent remove -n <id>
viben agent remove -n my-agent
viben agent remove -n my-agent --force  # Force delete
```

### viben agent config

Configure an agent.

```bash
# View configuration
viben agent config -n <id>

# Set configuration
viben agent config -n <id> --set <key>=<value>
viben agent config -n my-agent --set model=gpt-4
viben agent config -n my-agent --set plan=true
viben agent config -n my-agent --set mcp.enabled="[\"filesystem\",\"git\"]"
```

### viben agent set-default

Set the default agent.

```bash
viben agent set-default -n <id>
viben agent set-default -n my-agent
```

### viben agent status

View agent status.

```bash
viben agent status
viben agent status -n <id>
```

### viben agent chat

Use a specified Agent for non-interactive conversation.

```bash
# Basic usage
viben agent chat -n <agent-id> -p <prompt>
viben agent chat -n my-agent -p "Analyze this code"

# Read prompt from stdin
echo "Explain this error" | viben agent chat -n my-agent

# Specify working directory
viben agent chat -n my-agent -p "Analyze project structure" -C /path/to/project

# Session management
viben agent chat -n my-agent -p "Continue previous work" -s main
viben agent chat -n my-agent -p "Continue" --resume abc123
viben agent chat -n my-agent -p "Start new task" --new-session

# Advanced options
viben agent chat -n my-agent -p "Complex reasoning task" --model claude-3-opus
viben agent chat -n my-agent -p "Independent task" --no-memory
viben agent chat -n my-agent -p "Automation script" --dangerously-skip-permissions

# JSON stream input/output
echo '{"type":"user","message":{"role":"user","content":"Analyze code"}}' | \
  viben agent chat -n my-agent --input-format stream-json --output-format stream-json
```

**Option descriptions**:

| Option | Description |
|--------|-------------|
| `-n, --name` | Agent ID (required) |
| `-p, --prompt` | Prompt (optional, reads from stdin if not provided) |
| `-C, --cwd` | Working directory (defaults to current directory) |
| `-s, --session` | Specify session ID |
| `--resume` | Resume an existing session |
| `--new-session` | Force create a new session |
| `--model` | Override the Agent's configured model |
| `--no-memory` | Don't load Agent memory |
| `--input-format` | Input format: text (default), stream-json |
| `--output-format` | Output format: text (default), stream-json |
| `--verbose` | Verbose output |
| `--dangerously-skip-permissions` | Skip permission checks |

## Agent Template Management

### viben agent template list

List all templates.

```bash
viben agent template list
viben agent template list --json
```

### viben agent template create

Create a template from an existing agent.

```bash
viben agent template create -n <template-id> --clone <agent-id>
viben agent template create -n coding-assistant --clone my-agent
```

### viben agent template show

View template details.

```bash
viben agent template show -n <template-id>
```

### viben agent template remove

Delete a template.

```bash
viben agent template remove -n <template-id>
```

## Agent Session Management

### viben agent session list

List an agent's sessions.

```bash
viben agent session list -n <agent-id>
viben agent session list -n my-agent
```

### viben agent session create

Create a new session.

```bash
viben agent session create -n <agent-id> [--session-name <name>]
viben agent session create -n my-agent --session-name "feature-auth"
```

### viben agent session show

View session details.

```bash
viben agent session show -n <agent-id> -s <session-id>
```

### viben agent session remove

Delete a session.

```bash
viben agent session remove -n <agent-id> -s <session-id>
```

### viben agent session clear

Clear session history.

```bash
viben agent session clear -n <agent-id> -s <session-id>
```

## Agent Memory Management

### viben agent memory show

View agent memory.

```bash
viben agent memory show -n <agent-id>
viben agent memory show -n my-agent --date 2024-01-16
```

### viben agent memory append

Append memory to today's log.

```bash
viben agent memory append -n <agent-id> "content to append"
```

### viben agent memory edit

Edit main memory.

```bash
viben agent memory edit -n <agent-id>
```

## Executor Commands

Executors are underlying coding agent tools (such as Claude Code, Cursor). Viben only discovers them, not installs.

### viben executor types

List supported executor types.

```bash
viben executor types
viben executor types --json
```

### viben executor list

List all discovered executors (with installation status).

```bash
viben executor list
viben executor list --json
```

Example output:

```
Executors:

  Installed:
    CLAUDE_CODE     Claude Code      v1.0.25    Anthropic's official CLI
    CURSOR          Cursor           v0.45.2    AI-first code editor

  Not Installed:
    GEMINI_CLI      Gemini CLI       -          Google Gemini CLI
    CODEX           OpenAI Codex     -          OpenAI Codex CLI
```

### viben executor show

View executor details.

```bash
viben executor show -n <executor-id>
viben executor show -n CLAUDE_CODE
viben executor show -n CURSOR --json
```

### viben executor chat

Non-interactive executor invocation.

```bash
# Basic usage
viben executor chat -n CLAUDE_CODE -p "Analyze this code"

# Read from stdin
echo "Write a sorting function" | viben executor chat -n CLAUDE_CODE

# JSON stream input/output
viben executor chat -n CLAUDE_CODE --input-format stream-json --output-format stream-json

# Resume session
viben executor chat -n CLAUDE_CODE -p "Continue" --resume <session-id>
```

## MCP Commands

### viben mcp list

List installed MCP servers.

```bash
viben mcp list
viben mcp list --agent <agent-id>
viben mcp list --json
```

### viben mcp show

Show MCP server details.

```bash
viben mcp show <name>
viben mcp show <name> --agent <agent-id>
viben mcp show <name> --json
```

### viben mcp add

Add MCP server configuration for an agent.

```bash
viben mcp add <name> --agent <agent-id> --command <cmd>
viben mcp add filesystem --agent my-agent --command npx --args @anthropic-ai/mcp-server-filesystem /home/user
viben mcp add api-mcp --agent my-agent --command node --env API_KEY=secret123 --env DEBUG=true
viben mcp add filesystem --agent my-agent --command npx --disabled
```

### viben mcp remove

Remove MCP server configuration from an agent.

```bash
viben mcp remove <name> --agent <agent-id>
```

### viben mcp inspector

Launch MCP Inspector for testing and debugging.

```bash
viben mcp inspector
viben mcp inspector node build/index.js
viben mcp inspector -e API_KEY=value node build/index.js
viben mcp inspector --config mcp.json --server myserver
viben mcp inspector --cli node build/index.js
```

## Skill Commands

### viben skill list

List installed skills.

```bash
viben skill list
viben skill list --available
viben skill list --agent <agent-id>
viben skill list --global
viben skill list --claude
viben skill list --json
```

### viben skill show

Show skill details.

```bash
viben skill show <name>
viben skill show <name> --agent <agent-id>
viben skill show <name> --json
```

### viben skill install

Install a skill.

```bash
viben skill install <name>
viben skill install <name>@<version>
viben skill install <name> --agent <agent-id>
viben skill install <name> --global
viben skill install <name> --claude
viben skill install <name> --path /custom/path
viben skill install <name> --source /local/skill/path
viben skill install <name> --force
```

### viben skill uninstall

Uninstall a skill.

```bash
viben skill uninstall <name>
viben skill uninstall <name> --agent <agent-id>
viben skill uninstall <name> --claude
```

### viben skill enable/disable

Enable/disable a skill.

```bash
viben skill enable <name> --agent <agent-id>
viben skill disable <name> --agent <agent-id>
viben skill enabled --agent <agent-id>
```

### viben skill path

Get skill path.

```bash
viben skill path <name>
viben skill path <name> --agent <agent-id>
viben skill path <name> --claude
```

## Workspace Initialization

### viben init

Initialize a Viben workspace with a full AI-assisted development environment, including executor configurations, project specs, and developer workspace.

```bash
# Initialize with default executors (CURSOR + CLAUDE_CODE)
viben init --user john-doe

# Specify executors
viben init --user john-doe --executor CLAUDE_CODE --executor CURSOR

# Non-interactive mode
viben init --user john-doe -y

# Force overwrite existing files
viben init --user john-doe --force
```

**Key options**:

| Option | Description |
|--------|-------------|
| `--user, -u` | Developer name (auto-detected from git config if omitted) |
| `--executor, -e` | AI executor type (can be repeated for multiple executors) |
| `--yes, -y` | Non-interactive mode |
| `--force, -f` | Overwrite existing files |
| `--skip-existing, -s` | Skip files that already exist |

### viben update

Update workspace template files (idea-types, reward-types) to the latest version.

```bash
# Update idea-types templates
viben update --idea-types

# Update reward-types templates
viben update --reward-types

# Update both
viben update --idea-types --reward-types

# Force overwrite
viben update --idea-types --force
```

## Configuration Management

### viben config

Git-style configuration management using dot-notation keys.

```bash
# Read configuration
viben config get <key>
viben config get settings.editor

# Set configuration
viben config set <key> <value>
viben config set settings.editor vim

# List all configuration
viben config list
viben config list --global
viben config list --show-origin

# Edit configuration in editor
viben config edit
viben config edit --global

# Remove a key
viben config unset <key>
```

## Gateway Management

### viben gateway

Start, stop, and manage the Viben Gateway -- the core runtime that connects channels to the agent loop. The Gateway runs on port **18790** by default.

```bash
# Start gateway
viben gateway start
viben gateway start --host 127.0.0.1 --port 18790 --log-level info

# Start in daemon mode
viben gateway start --daemon

# Stop gateway
viben gateway stop

# Restart gateway
viben gateway restart

# Check gateway status
viben gateway status
```

**Key options**:

| Option | Description | Default |
|--------|-------------|---------|
| `--host` | Listen address | `127.0.0.1` |
| `--port` | Listen port | `18790` |
| `--log-level` | Log level (debug, info, warn, error) | `info` |
| `--agent` | Agent ID to run | `main` |
| `--daemon` | Run in background | `false` |

## Service Management

### viben service

Manage background services such as MCP servers and sync services.

```bash
# View all service status
viben service status

# View specific service status
viben service status <name>

# Start/stop/restart a service
viben service start <name>
viben service stop <name>
viben service restart <name>

# View service logs
viben service logs <name>
viben service logs <name> -f    # Follow logs in real-time
```

**Managed services**: `mcp:<name>` (MCP Server processes), `viben:sync` (config sync), `viben:index` (local indexing).

## Channel Management

### viben channel

Manage chat channels for the Gateway. Supports 6 channel types: Telegram, Discord, WhatsApp, Feishu/Lark, Slack, and Webhook.

```bash
# List supported channel types
viben channel types

# List configured channels
viben channel list

# Create a channel
viben channel create -n my-telegram --type telegram --token "BOT_TOKEN"
viben channel create -n my-discord --type discord --token "BOT_TOKEN"
viben channel create -n my-feishu --type feishu --app-id "cli_xxx" --app-secret "xxx"

# Enable/disable a channel
viben channel enable -n <id>
viben channel disable -n <id>

# Set default channel
viben channel set-default -n <id>

# View channel connection status
viben channel status
```

## Cron Management

### viben cron

Manage scheduled tasks for agents. Supports standard cron expressions and interval-based scheduling.

```bash
# List all cron jobs
viben cron list

# Add a cron job with cron expression
viben cron add --name "daily-greeting" --message "Good morning!" --cron "0 9 * * *"

# Add a cron job with interval (seconds)
viben cron add --name "hourly-check" --message "Check for updates" --every 3600

# Show cron job details
viben cron show <job_id>

# Enable/disable a cron job
viben cron enable <job_id>
viben cron disable <job_id>

# Remove a cron job
viben cron remove <job_id>

# Run a cron job immediately (for testing)
viben cron run <job_id>
```

## Task Management

### viben task

Full lifecycle task management with state machine transitions. Tasks are stored in `.viben/tasks/` and follow the state flow: `backlog -> queue -> in_progress -> review -> completed`.

**Key subcommands**:

```bash
# CRUD
viben task list [--mine] [--status <status>]
viben task create "Add user authentication" [--priority P1]
viben task view <task>
viben task edit <task>
viben task delete <task>

# State transitions
viben task enqueue <task>          # backlog -> queue
viben task dequeue <task>          # queue -> backlog
viben task start <task>            # Start full execution (plan -> work -> report)
viben task pause <task>            # in_progress -> paused
viben task resume <task>           # paused -> resume
viben task finish <task>           # Mark task as finished
viben task approve <task>          # review -> completed
viben task reject <task>           # review -> backlog
viben task retry <task>            # failed -> queue
viben task cancel <task>           # * -> cancelled

# Phase commands (can be used independently)
viben task plan-phase <task>       # Run Plan Agent
viben task work-phase <task>       # Run Work Agent
viben task implement-phase <task>  # Run Implement Agent
viben task check-phase <task>      # Run Check Agent

# Context management
viben task add-context <task> <file>...
viben task list-context <task>

# Monitoring
viben task status [<task>] [--running] [--watch]
viben task create-pr <task>

# Cleanup
viben task cleanup <branch> [--keep-branch]
viben task archive <task>
```

**Example workflow**:

```bash
viben task create "Feature XYZ"
viben task enqueue 03-11-feature-xyz
viben task start 03-11-feature-xyz
viben task status 03-11-feature-xyz --watch
```

## Queue Management

### viben queue

Background command execution queue with concurrency control and persistence. Stored in `~/.viben/queue/`.

```bash
# View queue status
viben queue status

# List queued tasks
viben queue list [--status <status>]

# Submit a command
viben queue enqueue --command "npm test" --cwd /path/to/project

# View task details
viben queue inspect <id>

# View task logs
viben queue logs <id>
viben queue logs <id> --follow

# Cancel a task
viben queue cancel <id>
viben queue cancel <id> --force    # Force-terminate running task

# Retry a failed task
viben queue retry <id>

# Watch queue events in real-time
viben queue watch

# Manage queue configuration
viben queue config
viben queue config --set max_concurrency=5

# Clean completed tasks
viben queue clean [--before 1d] [--dry-run]
```

## Swarm Orchestration

### viben swarm

Multi-agent orchestration for parallel development in isolated Git worktrees.

> **Note**: `viben swarm start` is deprecated. Use `viben task start` or `viben task work-phase` instead.

```bash
# List all worktrees and registered agents
viben swarm list

# View agent status
viben swarm status
viben swarm status <task> --detail
viben swarm status <task> --watch

# Stop agents
viben swarm stop <task>
viben swarm stop --all [--force]

# View agent registry
viben swarm registry
```

## Workspace Operations

### viben workspace

Manage workspace information and configuration.

```bash
# List all known workspaces
viben workspace list

# Show current workspace info
viben workspace current
```

## User Identity Management

### viben user

Manage developer identity for task management and session recording.

```bash
# Initialize user identity
viben user init <name>
viben user init john

# Get current user
viben user get
viben user get --json
```

## Session Management

### viben session

Record and manage development sessions. Sessions are stored in journal files under `.viben/workspace/<user>/`.

```bash
# Add a session record
viben session add --title "Implement auth" --commit "abc1234" --summary "Completed login"

# List session history
viben session list
viben session list --all     # All users
viben session list --limit 10
```

## Context Management

### viben context

Get current development context including user identity, Git status, active tasks, and journal state. Useful for AI agents to understand project state at startup.

```bash
# Show full context (text format)
viben context

# JSON format (for scripting)
viben context --json
```

## Idea Generation

### viben idea

AI-powered idea generation that analyzes the project codebase and produces improvement suggestions. Supports 6 built-in types (code_improvements, ui_ux_improvements, documentation_gaps, security_hardening, performance_optimizations, code_quality) plus custom types.

```bash
# Generate ideas
viben idea generate --types code_improvements code_quality

# List generated ideas
viben idea list
viben idea list --type security_hardening

# List available idea types
viben idea list-types

# View idea details
viben idea view <idea-id>

# Promote idea to task
viben idea promote <idea-id>
viben idea promote <idea-id> --start    # Promote and auto-start

# Remove ideas
viben idea remove <idea-id>
viben idea clear --force
```

## FileEvo Code Evolution

### viben evo

FileEvo -- file-based self-evolution workflow that treats the codebase as "model parameters" and uses PPO-style algorithms to iteratively optimize code quality.

```bash
# Create a target file
viben evo create my-optimization -d "Optimize code quality"

# Start a FileEvo run
viben evo start my-optimization.md

# Check status
viben evo status my-optimization

# List all runs
viben evo list

# Generate ideas for current iteration
viben evo generate-ideas my-optimization --types code_improvements

# Promote ideas to tasks
viben evo promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# Compute rewards
viben evo compute-reward my-optimization

# Select best candidate (PPO)
viben evo select my-optimization

# Stop a run
viben evo stop my-optimization
```

## Provider Management

### viben provider

Manage API providers (OpenAI, Anthropic, Google, Azure, OpenRouter, Ollama, custom). Configuration stored in `~/.viben/providers.yaml`.

```bash
# List all providers
viben provider list

# Create a provider
viben provider create -n my-anthropic -t anthropic --api-key "sk-ant-xxx"
viben provider create -t openai --api-key "sk-xxx"

# Remove a provider
viben provider remove -n <name>

# Set default provider
viben provider set-default -n <name>

# Check provider connectivity
viben provider status
```

## Model Management

### viben model

Manage models, aliases, and fallback chains. Configuration stored in `~/.viben/models.yaml`.

```bash
# List available models
viben model list
viben model list --provider <provider-name>

# Set default model
viben model set-default -n claude-sonnet-4-20250514

# Model aliases
viben model alias list
viben model alias create -n fast -m claude-3-5-haiku-latest
viben model alias resolve -n fast

# Fallback chain
viben model fallback list
viben model fallback set claude-sonnet-4-20250514 gpt-4-turbo claude-3-5-haiku-latest
viben model fallback add -n <model>

# Model-specific configuration
viben model config show -n <model>
viben model config set -n <model> --temperature 0.7 --max-tokens 8192

# Check model availability
viben model status
```

## Programmatic Integration

### Node.js

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runVibenCommand(command: string): Promise<string> {
  const { stdout } = await execAsync(`viben ${command}`);
  return stdout;
}

// Usage example
async function main() {
  // List agents
  const agentsJson = await runVibenCommand('agent list --json');
  const agents = JSON.parse(agentsJson);

  // Create agent
  await runVibenCommand('agent create -n test-agent');

  // Execute conversation
  const response = await runVibenCommand(
    'agent chat -n test-agent -p "Hello" --json'
  );
}
```

### Python

```python
import subprocess
import json

def run_viben_command(command: str) -> str:
    result = subprocess.run(
        ["viben"] + command.split(),
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout

def run_viben_json(command: str) -> dict:
    output = run_viben_command(f"{command} --json")
    return json.loads(output)

# Usage example
if __name__ == "__main__":
    # List agents
    agents = run_viben_json("agent list")
    print(agents)

    # Create agent
    run_viben_command("agent create -n test-agent")

    # Execute conversation
    response = run_viben_json('agent chat -n test-agent -p "Hello"')
    print(response)
```

### Shell Script

```bash
#!/bin/bash

# List all agents
agents=$(viben agent list --json | jq -r '.agents[].id')

# Iterate and show details
for agent in $agents; do
    echo "Agent: $agent"
    viben agent show -n "$agent"
    echo "---"
done

# Batch execute tasks
viben agent chat -n main -p "Generate a report" --json > report.json
```

## Related Documentation

- [Agent Development Guide](./index.md)
- [MCP Development Guide](./mcp-development.md)
- [Skill Development Guide](./skill-development.md)
- [Best Practices](./best-practices.md)
