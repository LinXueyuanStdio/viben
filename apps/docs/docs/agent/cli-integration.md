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
  init          Initialize workspace
  config        Configuration management (git-style)
  service       Background service management
  gateway       Start Gateway
  executor      Executor discovery and Chat
  agent         Agent management
  provider      API Provider management
  model         Model management
  mcp           MCP Server management
  skill         Skill management
  channel       Chat Channel management
  cron          Scheduled task management
  workspace     Workspace operations
  version       Show version
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
