---
sidebar_position: 5
title: Agent Template Development Guide
description: Creating Reusable Agent Templates
---

# Agent Template Development Guide

Agent templates are pre-configured Agent definitions that allow you to quickly create specific types of Agents. This document describes how to create and use Agent templates.

## Overview

### What is an Agent Template?

An Agent template is a set of predefined configurations, including:

- Agent basic configuration (name, description, type)
- Pre-installed Skills
- Pre-configured MCP Servers
- Default system prompts
- Model parameter settings

Using templates allows you to quickly create Agents optimized for specific scenarios.

### Template Types

| Type | Storage Location | Description |
|------|------------------|-------------|
| Built-in Templates | `~/.viben/templates/` | Official templates provided by Viben |
| User Templates | `~/.viben/templates/` | Custom templates created by users |
| Project Templates | `<project>/.viben/templates/` | Project-level templates |

## Quick Start

### Create an Agent from a Template

```bash
# List available templates
viben agent template list

# Create an Agent from a template
viben agent create -n my-agent -f coding-assistant

# View template details
viben agent template show -n coding-assistant
```

### Create a Template from an Existing Agent

```bash
# Save an existing agent as a template
viben agent template create -n my-template --clone my-agent

# Add description
viben agent set-template -n my-agent --description "A general coding assistant template"
```

## Template Structure

### Directory Structure

```
my-template/
├── template.yaml       # Template metadata
├── README.md           # Template documentation
├── agent.yaml          # Agent default configuration
├── mcp_servers.json    # MCP configuration
├── skills/             # Pre-installed Skills
│   └── skill.yaml
├── prompts/            # Prompt files
│   └── system.md
└── memory/             # Initial memory
    └── MEMORY.md
```

### template.yaml

Template metadata configuration:

```yaml
# template.yaml
name: my-template
version: 1.0.0
description: A template for specific use case
author: your-name

# Template parameters (customizable at creation time)
parameters:
  - name: agent_name
    description: Name of the agent
    required: true
  - name: model
    description: Model to use
    default: claude-3-sonnet
  - name: workdir
    description: Default working directory
    required: false

# Pre-installed components
includes:
  skills:
    - code-review
    - commit-helper
  mcp:
    - filesystem
    - git

# Template tags
tags:
  - coding
  - development
  - productivity
```

### agent.yaml

Agent default configuration:

```yaml
# agent.yaml
version: 1

# Agent metadata (can be overridden by parameters)
id: "{{ agent_name }}"
name: "{{ agent_name }}"
description: "Agent created from my-template"

# Agent type
type: claude-code

# Type-specific configuration
type_config:
  plan: true
  dangerously_skip_permissions: false
  append_prompt: |
    You are a helpful coding assistant.
    Follow best practices and write clean code.

# Model configuration
model: "{{ model }}"
temperature: 0.7
max_tokens: 4096

# MCP configuration
mcp:
  enabled:
    - filesystem
    - git

# Skills configuration
skills:
  enabled:
    - code-review
    - commit-helper
```

### prompts/system.md

System prompt:

```markdown
<!-- prompts/system.md -->

# System Prompt

You are a coding assistant created from the my-template template.

## Your Capabilities

- Code review and analysis
- Bug fixing and optimization
- Documentation generation
- Git operations

## Guidelines

1. Always explain your reasoning
2. Follow coding best practices
3. Suggest improvements proactively
4. Ask for clarification when needed
```

## Creating Custom Templates

### Step 1: Initialize Template

```bash
# Create template directory
viben template create my-template

# Or create from an existing agent
viben agent template create -n my-template --clone my-agent
```

### Step 2: Configure Template

Edit `template.yaml`:

```yaml
name: my-template
version: 1.0.0
description: My custom template

parameters:
  - name: agent_name
    required: true
  - name: project_type
    description: Type of project (web/api/cli)
    default: web

includes:
  skills:
    - code-review
```

### Step 3: Configure Default Agent

Edit `agent.yaml`:

```yaml
type: claude-code
type_config:
  plan: true
model: claude-3-sonnet
```

### Step 4: Add Skills and MCP

Configure the `skills/` directory and `mcp_servers.json`.

### Step 5: Test Template

```bash
# Create a test agent from the template
viben agent create -n test-agent -f my-template

# Verify configuration
viben agent show -n test-agent
```

### Step 6: Publish Template

```bash
# Publish to local template library
viben template publish my-template

# Or share template configuration
```

## Template Parameters

Templates support parameterized configuration, which can be customized when creating an Agent:

### Defining Parameters

```yaml
# template.yaml
parameters:
  - name: agent_name
    description: Name of the agent
    required: true

  - name: model
    description: Model to use
    default: claude-3-sonnet
    enum:
      - claude-3-opus
      - claude-3-sonnet
      - gpt-4

  - name: temperature
    description: Model temperature
    default: 0.7
    type: number
    min: 0
    max: 1
```

### Using Parameters

Use the `{{ param_name }}` syntax in configuration files:

```yaml
# agent.yaml
id: "{{ agent_name }}"
model: "{{ model }}"
temperature: {{ temperature }}
```

### Specifying Parameters at Creation Time

```bash
viben agent create -n my-agent -f my-template \
  --param model=gpt-4 \
  --param temperature=0.5
```

## Built-in Templates

### coding-assistant

General coding assistant template:

```bash
viben agent create -n my-coder -f coding-assistant
```

Features:
- Support for multiple programming languages
- Built-in code review skill
- Configured with filesystem and git MCP

### research-assistant

Research assistant template:

```bash
viben agent create -n my-researcher -f research-assistant
```

Features:
- Paper search and summarization
- Built-in academic search MCP
- Citation formatting skill

### devops-assistant

DevOps assistant template:

```bash
viben agent create -n my-devops -f devops-assistant
```

Features:
- CI/CD configuration
- Docker and Kubernetes support
- Monitoring and log analysis

## CLI Commands

### viben agent template list

List all available templates:

```bash
viben agent template list
viben agent template list --json
```

Example output:

```
Agent Templates:
  coding-assistant    claude-code   "General coding assistant"
  researcher          gemini        "Research and analysis"
  code-reviewer       claude-code   "Code review specialist"
```

### viben agent template show

View template details:

```bash
viben agent template show -n coding-assistant
```

### viben agent template create

Create a template from an agent:

```bash
viben agent template create -n <template-id> --clone <agent-id>
viben agent template create -n my-template --clone my-agent
```

### viben agent template remove

Delete a template:

```bash
viben agent template remove -n <template-id>
```

## Best Practices

### 1. Template Naming

Use descriptive names:

```
# Good
coding-assistant
research-helper
devops-automation

# Bad
template1
my-template
test
```

### 2. Version Management

Follow semantic versioning:

```yaml
version: 1.0.0  # major.minor.patch
```

- Major version: Incompatible changes
- Minor version: Backward-compatible feature additions
- Patch version: Backward-compatible bug fixes

### 3. Complete Documentation

Each template should include a comprehensive README.md:

```markdown
# Template Name

## Description
[Template purpose and features]

## Usage
```bash
viben agent create -n my-agent -f template-name
```

## Parameters
| Parameter | Description | Default |
|-----------|-------------|---------|
| model | Model to use | claude-3-sonnet |

## Included Skills
- skill-1: Description
- skill-2: Description

## Included MCP
- mcp-1: Description
- mcp-2: Description

## Notes
[Usage notes and considerations]
```

### 4. Parameter Design

- Provide reasonable default values
- Minimize required parameters
- Use enums to limit options

```yaml
parameters:
  - name: model
    default: claude-3-sonnet  # Has default value
    enum:                     # Limited options
      - claude-3-opus
      - claude-3-sonnet
```

### 5. Test Templates

Test thoroughly before publishing:

```bash
# Create a test agent
viben agent create -n test-agent -f my-template

# Verify configuration
viben agent show -n test-agent

# Test conversation
viben agent chat -n test-agent -p "Hello"

# Clean up
viben agent remove -n test-agent
```

## Related Documentation

- [Agent Development Guide](../index.md)
- [Skill Development Guide](../skill-development.md)
- [MCP Development Guide](../mcp-development.md)
- [CLI Integration Guide](../cli-integration.md)
