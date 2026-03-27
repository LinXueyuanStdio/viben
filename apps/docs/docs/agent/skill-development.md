---
sidebar_position: 3
title: Skill Development Guide
description: Develop reusable Skills for Agents
---

# Skill Development Guide

Skills are reusable capability units for Agents that can be shared across multiple Agents. This document explains how to develop and manage Skills for the Viben platform.

## Overview

### What is a Skill?

A Skill is a set of predefined prompts and configurations that enhance an Agent's capabilities for specific tasks. For example:

- `code-review`: Code review skill
- `commit`: Git commit message generation skill
- `test-runner`: Test execution skill
- `paper-search`: Paper search skill

### Skill Types

| Type | Storage Location | Scope |
|------|------------------|-------|
| Global Skill | `~/.viben/skills/` | Available to all Agents |
| Agent Skill | `~/.viben/agents/<id>/skills/` | Available only to specific Agent |
| Claude Skill | `~/.claude/commands/` | Claude Code specific |

## Quick Start

### 1. Install a Skill

```bash
# Global installation
viben skill install code-review

# Install to a specific agent
viben skill install code-review --agent my-agent

# Install a specific version
viben skill install code-review@1.0.0

# Install to Claude skills directory
viben skill install code-review --claude
```

### 2. List Installed Skills

```bash
# List all installed skills
viben skill list

# List skills for a specific agent
viben skill list --agent my-agent

# List only global skills
viben skill list --global

# List only Claude skills
viben skill list --claude
```

### 3. View Skill Details

```bash
viben skill show code-review
```

Example output:

```
Skill: Code Review

  ID:           code-review
  Name:         Code Review
  Version:      1.0.0
  Description:  Code review assistance
  Path:         /path/to/skills/code-review
  Source:       local
```

## Creating Custom Skills

### Directory Structure

```
my-skill/
├── skill.yaml          # Skill configuration file
├── README.md           # Usage documentation
├── prompts/
│   ├── main.md         # Main prompt
│   └── examples.md     # Example prompts
└── examples/
    └── usage.md        # Usage examples
```

### Skill Configuration File

```yaml
# skill.yaml
name: my-skill
version: 1.0.0
description: My custom skill for specific tasks
author: your-name

# Triggers - activate this skill when user says these words
triggers:
  - "my skill"
  - "do something"
  - "/myskill"

# Prompt files
prompts:
  - prompts/main.md
  - prompts/examples.md

# Dependencies on other skills
dependencies:
  - other-skill

# Required MCP servers
requires_mcp:
  - filesystem
  - git

# Tags
tags:
  - productivity
  - coding
```

### Main Prompt File

```markdown
<!-- prompts/main.md -->

# My Skill

You are an assistant specialized in [specific task].

## Instructions

1. Understand the user's request
2. Process the information according to these rules:
   - Rule 1
   - Rule 2
   - Rule 3
3. Return formatted results

## Output Format

Always respond with:
- Summary
- Details
- Next steps

## Examples

### Example 1

Input: [example input]
Output: [example output]
```

### Initialize a Skill Project

```bash
# Create a new skill
viben skill create my-skill

# This will generate the basic directory structure
```

## Skill CLI Commands

### Install Skill

```bash
# Basic installation (global)
viben skill install <name>

# Install a specific version
viben skill install <name>@<version>
viben skill install <name>@latest

# Install to a specific agent
viben skill install <name> --agent <agent-id>

# Global installation (default)
viben skill install <name> --global

# Install to Claude skills directory (.claude/commands/)
viben skill install <name> --claude

# Install to a custom path
viben skill install <name> --path /custom/path

# Install from a local path
viben skill install <name> --source /local/skill/path

# Force reinstall
viben skill install <name> --force
```

### Uninstall Skill

```bash
# Uninstall from global (default)
viben skill uninstall <name>

# Uninstall from agent
viben skill uninstall <name> --agent <agent-id>

# Uninstall from Claude skills directory
viben skill uninstall <name> --claude
```

### Enable/Disable Skill

```bash
# Enable skill for agent
viben skill enable <name> --agent <agent-id>

# Disable skill for agent
viben skill disable <name> --agent <agent-id>

# List enabled skills for agent
viben skill enabled --agent <agent-id>
```

### Get Skill Path

```bash
# Get global skill path
viben skill path <name>

# Get agent skill path
viben skill path <name> --agent <agent-id>

# Get Claude skill path
viben skill path <name> --claude
```

## Skill Development Best Practices

### 1. Prompt Design

**Keep it concise and clear**

```markdown
<!-- Good -->
You are a code reviewer. Review the provided code for:
- Bugs and errors
- Performance issues
- Code style

<!-- Bad -->
You are an expert code reviewer with years of experience...
[overly long description]
```

**Use structured format**

```markdown
## Task
[Clear task description]

## Input
[Input format specification]

## Output
[Output format requirements]

## Examples
[Specific examples]
```

**Include examples**

```markdown
## Example

Input:
```python
def add(a, b):
    return a + b
```

Output:
- No bugs found
- Consider adding type hints
- Function is well-named
```

### 2. Version Management

Follow semantic versioning:

```yaml
# Major version: incompatible API changes
# Minor version: backward-compatible feature additions
# Patch version: backward-compatible bug fixes
version: 1.2.3
```

### 3. Documentation Standards

Each Skill should include a README.md:

```markdown
# Skill Name

## Description
[Describe the skill's functionality]

## Installation
```bash
viben skill install my-skill
```

## Usage
[Usage instructions and examples]

## Configuration Options
[Configurable options description]

## Limitations
[Known limitations and caveats]
```

### 4. Dependency Management

Explicitly declare dependencies:

```yaml
# skill.yaml
dependencies:
  - base-skill@^1.0.0

requires_mcp:
  - filesystem
  - git
```

## Claude Code Skills

### Install to Claude Code

```bash
# Install to Claude Code's commands directory
viben skill install my-skill --claude
```

This will install the skill to the `~/.claude/commands/` directory, making it available as a custom command in Claude Code.

### Claude Code Command Format

```markdown
<!-- ~/.claude/commands/my-skill.md -->

# My Skill

This is a custom command for Claude Code.

## Usage

Use this command by typing `/my-skill` in the chat.

## Instructions

[Instructions for Claude Code]
```

## Example Skills

### Code Review Skill

```yaml
# skill.yaml
name: code-review
version: 1.0.0
description: Automated code review assistance

triggers:
  - "review code"
  - "code review"
  - "/review"

prompts:
  - prompts/review.md
```

```markdown
<!-- prompts/review.md -->

# Code Review

You are a code reviewer. When reviewing code:

1. **Check for bugs**: Look for logic errors, edge cases, null checks
2. **Performance**: Identify inefficient algorithms or unnecessary operations
3. **Security**: Check for vulnerabilities (SQL injection, XSS, etc.)
4. **Style**: Ensure consistent naming, formatting, and documentation
5. **Best practices**: Suggest improvements based on language idioms

## Output Format

```
## Summary
[Overall assessment]

## Issues Found
- [Critical] Issue description
- [Warning] Issue description
- [Suggestion] Improvement suggestion

## Recommendations
1. Recommendation 1
2. Recommendation 2
```
```

### Commit Message Skill

```yaml
# skill.yaml
name: commit-helper
version: 1.0.0
description: Generate meaningful commit messages

triggers:
  - "commit"
  - "generate commit"
  - "/commit"

prompts:
  - prompts/commit.md
```

```markdown
<!-- prompts/commit.md -->

# Commit Message Generator

Generate a commit message following conventional commits:

## Format

```
type(scope): subject

body

footer
```

## Types
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code refactoring
- test: Tests
- chore: Maintenance

## Guidelines
- Subject line max 50 characters
- Body max 72 characters per line
- Reference issues in footer
```

## Related Documentation

- [Agent Development Guide](./index.md)
- [MCP Development Guide](./mcp-development.md)
- [CLI Integration Guide](./cli-integration.md)
- [Best Practices](./best-practices.md)
