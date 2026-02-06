---
sidebar_position: 6
title: "Agent Templates"
description: "Create and use Viben agent templates for reusable configurations"
---

# Agent Templates

Templates are reusable agent configurations that allow you to quickly create new agents with predefined settings, MCP servers, skills, and memory structure.

## Template Concepts

### What is a Template?

A template is a blueprint for creating agents. It includes:

- Agent configuration (`config.yaml`)
- MCP servers configuration
- Skills configuration
- Initial memory structure
- Startup configuration (`.agentrc`)

### Template vs Agent

| Aspect | Template | Agent |
|--------|----------|-------|
| **Purpose** | Reusable blueprint | Active instance |
| **Storage** | `~/.viben/agent-templates/` | `~/.viben/agents/` |
| **Sessions** | None | Has sessions |
| **Memory** | Initial structure only | Active memory |
| **Usage** | Create new agents | Direct interaction |

### Template Storage

Templates are stored in `~/.viben/agent-templates/`:

```
~/.viben/agent-templates/
+-- coding-assistant/
|   |-- config.yaml
|   |-- mcp_servers.json
|   |-- skills/
|   |-- memory/
|   |   +-- MEMORY.md          # Initial memory template
|   +-- .agentrc
+-- code-reviewer/
|   |-- config.yaml
|   +-- ...
+-- researcher/
    |-- config.yaml
    +-- ...
```

## Template Commands

### List Templates

```bash
viben agent template list
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
viben agent template list --json
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
        "path": "~/.viben/agent-templates/coding-assistant/"
      },
      {
        "id": "code-reviewer",
        "name": "Code Review Specialist",
        "type": "claude-code",
        "description": "Specialized in code review and best practices",
        "path": "~/.viben/agent-templates/code-reviewer/"
      }
    ]
  }
}
```

### Create Template from Agent

Create a new template from an existing agent:

```bash
viben agent template create -n <template-id> --clone <agent-id>
```

**Example:**
```bash
viben agent template create -n my-template --clone my-agent
```

**Output:**
```
Created template: my-template
  From agent: my-agent
  Path: ~/.viben/agent-templates/my-template/

Included:
  - config.yaml
  - mcp_servers.json
  - skills/ (2 skills)
  - memory/MEMORY.md (initial structure)
  - .agentrc
```

### Create Template Options

| Option | Description |
|--------|-------------|
| `-n, --name <id>` | Template ID (required) |
| `--clone <agent>` | Clone from existing agent |
| `--include-memory` | Include full memory content (default: structure only) |
| `--include-history` | Include command history |
| `--description <text>` | Template description |

### Show Template Details

```bash
viben agent template show -n <template-id>
```

**Example:**
```bash
viben agent template show -n coding-assistant
```

**Output:**
```
Template: coding-assistant
Name: General Coding Assistant
Type: claude-code
Description: A general-purpose coding assistant

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

Path: ~/.viben/agent-templates/coding-assistant/
```

### Remove Template

```bash
viben agent template remove -n <template-id>
```

**Example:**
```bash
viben agent template remove -n old-template
```

**Output:**
```
Are you sure you want to remove template 'old-template'? [y/N]: y
Removed template: old-template
```

## Using Templates

### Create Agent from Template

```bash
viben agent create -n <agent-id> -f <template-id>
```

**Example:**
```bash
viben agent create -n my-coder -f coding-assistant
```

**Output:**
```
Created agent: my-coder
  From template: coding-assistant
  Path: ~/.viben/agents/my-coder/

Copied:
  - config.yaml (customized ID)
  - mcp_servers.json
  - skills/
  - memory/MEMORY.md
  - .agentrc
```

### Initialize Workspace from Template

When initializing a workspace, you can use a template:

```bash
viben init --from <template-id>
```

This creates a workspace configuration based on the template.

## Creating Custom Templates

### Manual Template Creation

1. **Create template directory:**
   ```bash
   mkdir -p ~/.viben/agent-templates/my-template
   ```

2. **Create config.yaml:**
   ```yaml
   # ~/.viben/agent-templates/my-template/config.yaml
   version: 1

   id: "{{AGENT_ID}}"  # Placeholder, replaced on creation
   name: "My Custom Agent"
   description: "A custom agent template"

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
   # ~/.viben/agent-templates/my-template/memory/MEMORY.md
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

### Template Organization

```
~/.viben/agent-templates/
|-- personal/          # Personal templates
|   |-- my-coder/
|   +-- my-writer/
|-- team/              # Team-shared templates
|   |-- code-reviewer/
|   +-- qa-tester/
+-- experimental/      # Experimental templates
    +-- new-approach/
```

### Sharing Templates

Export a template for sharing:

```bash
viben agent template export -n coding-assistant -o ~/templates/
```

Import a shared template:

```bash
viben agent template import ~/templates/coding-assistant.tar.gz
```

## Troubleshooting

### Template Not Found

```
Error: Template 'my-template' not found
```

**Solution:** Check template directory exists:
```bash
ls ~/.viben/agent-templates/
```

### Invalid Template Configuration

```
Error: Template 'my-template' has invalid configuration
```

**Solution:** Validate template:
```bash
viben agent template validate -n my-template
```

### Variable Not Replaced

If `{{AGENT_ID}}` appears in the created agent:

**Solution:** Ensure using proper variable syntax and template version is correct.

## Next Steps

- [Creating Agents](./creating-agents) - Create agents from templates
- [Agent Configuration](./agent-configuration) - Customize agent settings
- [Memory System](./memory-system) - Configure memory templates
