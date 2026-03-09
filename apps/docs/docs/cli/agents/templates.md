---
sidebar_position: 6
title: "Agent Templates"
description: "Create and use Viben agent templates for reusable configurations"
---

# Agent Templates

Templates are regular agents marked with `isTemplate: true`. They serve as blueprints for creating new agents with predefined settings, MCP servers, skills, and memory structure.

## Template Concepts

### What is a Template?

A template is an agent configuration marked as reusable. It includes:

- Agent configuration (`config.yaml` with `isTemplate: true`)
- MCP servers configuration
- Skills configuration
- Initial memory structure
- Startup configuration (`.agentrc`)

### Template vs Agent

Templates and agents are stored in the same location (`~/.viben/agents/`). The only difference is the `isTemplate` flag in the configuration.

| Aspect | Template | Agent |
|--------|----------|-------|
| **Purpose** | Reusable blueprint | Active instance |
| **Storage** | `~/.viben/agents/<id>/` | `~/.viben/agents/<id>/` |
| **Config Flag** | `isTemplate: true` | `isTemplate: false` (default) |
| **Sessions** | None | Has sessions |
| **Memory** | Initial structure only | Active memory |
| **Usage** | Create new agents | Direct interaction |

### Template Storage

Templates are stored alongside regular agents in `~/.viben/agents/`:

```
~/.viben/agents/
+-- coding-assistant/           # Template (isTemplate: true)
|   |-- config.yaml
|   |-- mcp_servers.json
|   |-- skills/
|   |-- memory/
|   |   +-- MEMORY.md          # Initial memory template
|   +-- .agentrc
+-- code-reviewer/              # Template (isTemplate: true)
|   |-- config.yaml
|   +-- ...
+-- my-agent/                   # Regular agent (isTemplate: false)
|   |-- config.yaml
|   +-- ...
```

## Template Commands

### List Templates

```bash
viben agent list --templates
```

**Output:**
```
Agent Templates:
  coding-assistant    claude-code   "General coding assistant"
  code-reviewer       claude-code   "Code review specialist"
  researcher          gemini        "Research and analysis"
  doc-writer          claude-code   "Documentation writer"
```

### JSON Output

```bash
viben agent list --templates --json
```

**Output:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "coding-assistant",
        "name": "General Coding Assistant",
        "type": "claude-code",
        "description": "A general-purpose coding assistant",
        "isTemplate": true,
        "path": "~/.viben/agents/coding-assistant/"
      },
      {
        "id": "code-reviewer",
        "name": "Code Review Specialist",
        "type": "claude-code",
        "description": "Specialized in code review and best practices",
        "isTemplate": true,
        "path": "~/.viben/agents/code-reviewer/"
      }
    ]
  }
}
```

### Mark Agent as Template

Convert an existing agent to a template:

```bash
viben agent update <agent-id> --is-template true
```

**Example:**
```bash
viben agent update my-agent --is-template true
```

**Output:**
```
Updated agent: my-agent
  isTemplate: true
  Path: ~/.viben/agents/my-agent/
```

### Convert Template to Regular Agent

```bash
viben agent update <template-id> --is-template false
```

### Show Template Details

```bash
viben agent show <template-id>
```

**Example:**
```bash
viben agent show coding-assistant
```

**Output:**
```
Template: coding-assistant
Name: General Coding Assistant
Type: claude-code
Description: A general-purpose coding assistant
isTemplate: true

Configuration:
  type_config:
    plan: true
    dangerously_skip_permissions: false

MCP Servers:
  - filesystem
  - git

Skills:
  - code-review
  - commit

Memory Structure:
  - MEMORY.md (template with sections)

Path: ~/.viben/agents/coding-assistant/
```

### Remove Template

```bash
viben agent remove <template-id>
```

**Example:**
```bash
viben agent remove old-template
```

**Output:**
```
Are you sure you want to remove agent 'old-template'? [y/N]: y
Removed agent: old-template
```

## Using Templates

### Create Agent from Template

```bash
viben agent create <agent-id> --from-template <template-id>
```

**Example:**
```bash
viben agent create my-coder --from-template coding-assistant
```

**Output:**
```
Created agent: my-coder
  From template: coding-assistant
  Path: ~/.viben/agents/my-coder/

Copied:
  - config.yaml (customized ID, isTemplate: false)
  - mcp_servers.json
  - skills/
  - memory/MEMORY.md
  - .agentrc
```

### Initialize Workspace from Template

When initializing a workspace, you can use a template:

```bash
viben init --from-template <template-id>
```

This creates a workspace configuration based on the template.

## Creating Custom Templates

### Method 1: Create and Mark as Template

1. **Create a new agent:**
   ```bash
   viben agent create my-template
   ```

2. **Configure it as desired:**
   ```bash
   viben agent config my-template --set type=claude-code
   viben agent config my-template --set mcp.enabled="[\"filesystem\",\"git\"]"
   ```

3. **Mark as template:**
   ```bash
   viben agent update my-template --is-template true
   ```

### Method 2: Clone and Mark as Template

1. **Clone an existing agent:**
   ```bash
   viben agent create my-template --clone existing-agent
   ```

2. **Mark as template:**
   ```bash
   viben agent update my-template --is-template true
   ```

### Manual Template Creation

1. **Create agent directory:**
   ```bash
   mkdir -p ~/.viben/agents/my-template
   ```

2. **Create config.yaml:**
   ```yaml
   # ~/.viben/agents/my-template/config.yaml
   version: 1

   id: "{{AGENT_ID}}"  # Placeholder, replaced on creation
   name: "My Custom Agent"
   description: "A custom agent template"
   isTemplate: true    # Mark as template

   type: claude-code

   type_config:
     plan: true
     append_prompt: |
       You are a specialized assistant for...

   mcp:
     enabled:
       - filesystem
       - git

   skills:
     enabled:
       - code-review
   ```

3. **Create memory template:**
   ```markdown
   # ~/.viben/agents/my-template/memory/MEMORY.md
   # Agent Memory

   ## User Preferences
   <!-- Add user preferences here -->

   ## Project Context
   <!-- Add project context here -->

   ## Important Notes
   <!-- Add important notes here -->
   ```

4. **Create MCP configuration:**
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@anthropic-ai/mcp-server-filesystem"]
       }
     }
   }
   ```

### Template Variables

Templates support variables that are replaced when creating an agent:

| Variable | Replaced With |
|----------|---------------|
| `{{AGENT_ID}}` | New agent ID |
| `{{AGENT_NAME}}` | Agent name |
| `{{CREATED_DATE}}` | Creation timestamp |
| `{{USER_HOME}}` | User home directory |

## Built-in Templates

Viben includes several built-in templates:

### coding-assistant

General-purpose coding assistant:
- MCP: filesystem, git
- Skills: code-review, commit
- Type: claude-code

### code-reviewer

Specialized code review agent:
- MCP: filesystem, git
- Skills: code-review, security-audit
- Type: claude-code
- Custom prompt for review focus

### researcher

Research and analysis agent:
- MCP: browser, filesystem
- Skills: summarize, cite
- Type: gemini
- Optimized for research tasks

### doc-writer

Documentation specialist:
- MCP: filesystem
- Skills: documentation, markdown
- Type: claude-code
- Focused on documentation quality

## Template Best Practices

### Design Principles

1. **Single purpose**: Each template should have a clear purpose
2. **Minimal configuration**: Include only necessary settings
3. **Good defaults**: Provide sensible default values
4. **Clear documentation**: Include descriptions and comments

### Naming Convention

Use descriptive names for templates:

```bash
# Good: Clear purpose
viben agent update code-reviewer --is-template true
viben agent update research-assistant --is-template true

# Avoid: Generic names
viben agent update template1 --is-template true
```

### Sharing Templates

Export a template for sharing:

```bash
viben agent export coding-assistant -o ~/templates/
```

Import a shared template:

```bash
viben agent import ~/templates/coding-assistant.tar.gz
```

## Command Reference

| Command | Description |
|---------|-------------|
| `viben agent list --templates` | List all templates |
| `viben agent update <id> --is-template true` | Mark agent as template |
| `viben agent update <id> --is-template false` | Convert template to agent |
| `viben agent create <name> --from-template <id>` | Create agent from template |
| `viben agent show <id>` | Show template/agent details |
| `viben agent remove <id>` | Remove template/agent |

## Troubleshooting

### Template Not Found

```
Error: Template 'my-template' not found
```

**Solution:** Check if the agent exists and is marked as template:
```bash
viben agent list --templates
viben agent show my-template
```

### Invalid Template Configuration

```
Error: Agent 'my-template' is not marked as a template
```

**Solution:** Mark the agent as template:
```bash
viben agent update my-template --is-template true
```

### Variable Not Replaced

If `{{AGENT_ID}}` appears in the created agent:

**Solution:** Ensure using proper variable syntax and template version is correct.

## Next Steps

- [Creating Agents](./creating-agents) - Create agents from templates
- [Agent Configuration](./agent-configuration) - Customize agent settings
- [Memory System](./memory-system) - Configure memory templates
