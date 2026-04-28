---
sidebar_position: 6
title: "viben skill"
description: "Manage skills - install, uninstall, show, enable, disable, and list available skills"
---

# viben skill

Manage skills for Viben agents.

## Usage

```bash
viben skill <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `list` | List installed skills |
| `show <name>` | Show skill details |
| `install <name>` | Install a skill |
| `uninstall <name>` | Uninstall a skill |
| `enable <name>` | Enable a skill for an agent |
| `disable <name>` | Disable a skill for an agent |
| `enabled` | List enabled skills for an agent |
| `path <name>` | Get the path of a skill |

## Commands

### List Skills

List installed skills:

```bash
# List all installed skills
viben skill list

# List available skills from marketplace
viben skill list --available

# List skills for a specific agent
viben skill list --agent <agent-id>

# List only global skills
viben skill list --global

# List only Claude skills
viben skill list --claude

# JSON output
viben skill list --json
```

**Options**:

| Option | Description |
|--------|-------------|
| `--available` | List marketplace available skills |
| `--agent <id>` | List skills for a specific agent |
| `--global` | List only global skills |
| `--claude` | List only Claude skills |
| `--json` | JSON format output |

**Output (Human-readable):**

```
Installed Skills:
  Name           Version    Path                         Installed At
  code-review    1.0.0      /path/to/code-review         2d ago
  commit         1.2.0      /path/to/commit              5d ago
  test-runner    0.9.0      /path/to/test-runner         1w ago
```

**Output (JSON):**

```bash
viben skill list --json
```

```json
{
  "success": true,
  "data": {
    "installed": [
      {
        "name": "code-review",
        "version": "1.0.0",
        "description": "Code review assistance"
      },
      {
        "name": "commit",
        "version": "1.2.0",
        "description": "Smart commit messages"
      },
      {
        "name": "test-runner",
        "version": "0.9.0",
        "description": "Test execution helper"
      }
    ]
  }
}
```

### Show Skill

Show detailed information about a skill:

```bash
# Show skill details
viben skill show <name>

# Show agent's skill details
viben skill show <name> --agent <agent-id>

# JSON output
viben skill show <name> --json
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | View agent's skill |
| `--json` | JSON format output |

**Output**:

```
Skill: Code Review

  ID:           code-review
  Name:         Code Review
  Version:      1.0.0
  Description:  Code review assistance
  Path:         /path/to/skills/code-review
  Source:       local
```

### Install Skill

Install a skill from the marketplace:

```bash
# Install latest version (global by default)
viben skill install code-review

# Install specific version
viben skill install code-review@1.0.0
viben skill install code-review@latest

# Install to a specific agent
viben skill install code-review --agent my-agent

# Install globally (default)
viben skill install code-review --global

# Install to Claude skills directory (.claude/commands/)
viben skill install code-review --claude

# Install to custom path
viben skill install code-review --path /custom/path

# Install from local path
viben skill install code-review --source /local/skill/path

# Install using specific executor
viben skill install code-review --executor claude-code

# Force reinstall
viben skill install code-review --force

# Combined options
viben skill install code-review@2.0.0 --agent my-agent --force
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | Install to a specific agent |
| `--global` | Install globally (default) |
| `--claude` | Install to Claude skills directory |
| `--path <path>` | Install to a custom path |
| `--source <path>` | Install from a local path |
| `--version <version>` | Specify version (equivalent to `@version`) |
| `--executor <name>` | Use a specific executor (e.g., `claude-code`) |
| `-f, --force` | Force reinstall |
| `--disabled` | Install in disabled state |
| `--json` | JSON format output |

**Output (Human-readable):**

```
Installing code-review@1.0.0...
Installed code-review v1.0.0
```

**Output (JSON):**

```bash
viben skill install code-review --json
```

```json
{
  "success": true,
  "data": {
    "name": "code-review",
    "version": "1.0.0",
    "path": "~/.viben/skills/code-review/"
  }
}
```

### Uninstall Skill

Remove an installed skill:

```bash
# Uninstall from global (default)
viben skill uninstall code-review

# Uninstall from specific agent
viben skill uninstall code-review --agent my-agent

# Uninstall from Claude skills directory
viben skill uninstall code-review --claude

# Uninstall from custom path
viben skill uninstall code-review --path /custom/path
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | Uninstall from specific agent |
| `--global` | Uninstall from global (default) |
| `--claude` | Uninstall from Claude skills directory |
| `--path <path>` | Uninstall from custom path |
| `--json` | JSON format output |

**Output:**

```
Uninstalled code-review
```

**JSON Output:**

```json
{
  "success": true,
  "data": {
    "name": "code-review",
    "removed": true
  }
}
```

### Enable Skill

Enable a skill for an agent:

```bash
viben skill enable <name> --agent <agent-id>
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | (Required) Agent ID |
| `--json` | JSON format output |

**Example**:

```bash
viben skill enable code-review --agent my-agent
```

### Disable Skill

Disable a skill for an agent:

```bash
viben skill disable <name> --agent <agent-id>
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | (Required) Agent ID |
| `--json` | JSON format output |

**Example**:

```bash
viben skill disable code-review --agent my-agent
```

### List Enabled Skills

List skills that are enabled for an agent:

```bash
viben skill enabled --agent <agent-id>
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | (Required) Agent ID |
| `--json` | JSON format output |

**Output**:

```
Enabled Skills for Agent: my-agent
  Skill           Enabled At
  code-review     2d ago
  commit-helper   5d ago
```

### Get Skill Path

Get the filesystem path of a skill:

```bash
# Get global skill path (default)
viben skill path <name>

# Get agent skill path
viben skill path <name> --agent <agent-id>

# Get Claude skill path
viben skill path <name> --claude

# Get global skill path
viben skill path <name> --global
```

**Options**:

| Option | Description |
|--------|-------------|
| `--agent <id>` | Agent skill path |
| `--global` | Global skill path |
| `--claude` | Claude skill path |
| `--json` | JSON format output |

**Example**:

```bash
viben skill path code-review
# /home/user/.viben/skills/code-review

viben skill path code-review --agent my-agent
# /home/user/.viben/agents/my-agent/skills/code-review
```

## Skill Scopes

Skills can be installed at different scopes:

| Location | Description |
|----------|-------------|
| `~/.viben/skills/` | Shared skills (available to all agents) |
| `~/.viben/agents/<id>/skills/` | Agent-specific skills |
| `.claude/commands/` | Claude skills directory |

### Examples

```bash
# Install to shared skills (default)
viben skill install code-review

# Install to a specific agent
viben skill install code-review --agent my-agent

# Install to Claude
viben skill install code-review --claude

# List skills for a specific agent
viben skill list --agent my-agent
```

## Skill Configuration

Skills are managed in `~/.viben/skills/installed.yaml`:

```yaml
version: 1

installed:
  code-review:
    version: "1.0.0"
    installed_at: "2024-01-15T10:30:00Z"
  commit:
    version: "1.2.0"
    installed_at: "2024-01-14T09:00:00Z"
  test-runner:
    version: "0.9.0"
    installed_at: "2024-01-10T14:00:00Z"
```

## Error Handling

### Skill Not Found

```bash
viben skill install unknown-skill
```

```json
{
  "success": false,
  "error": {
    "code": "SKILL_NOT_FOUND",
    "message": "Skill 'unknown-skill' not found in marketplace"
  }
}
```

### Already Installed

```bash
viben skill install code-review
```

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_INSTALLED",
    "message": "Skill 'code-review' is already installed (v1.0.0)"
  }
}
```

### Not Installed

```bash
viben skill uninstall unknown-skill
```

```json
{
  "success": false,
  "error": {
    "code": "NOT_INSTALLED",
    "message": "Skill 'unknown-skill' is not installed"
  }
}
```

## Related Commands

- [viben mcp](./mcp) - MCP server management
- [viben agent](./agent) - Agent management
- [viben config](./config) - Configuration management
