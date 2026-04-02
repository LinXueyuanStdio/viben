---
sidebar_position: 3
title: "Features"
description: "Complete feature list for Viben Desktop Application - Agent Swarm x Code Evolution"
---

# Features

Viben Desktop is an **Agent Swarm x Code Evolution** platform that drives continuous code evolution through agent swarm collaboration and iterative optimization.

:::tip Core Concepts
Before exploring features, we recommend reading [Core Concepts](/user/getting-started/concepts) to understand the difference between agents and executors.
:::

---

## FileEvo Code Evolution

FileEvo is Viben's core engine, driving code iteration optimization through heuristic evaluation and selection.

### How It Works

```
Code Input → Reward Model Evaluation → Generate Optimization Plan → Agent Execution → Re-evaluate → Loop
```

### Reward Model

Evaluates code quality and generates optimization signals:

| Dimension | Evaluation Content |
|-----------|-------------------|
| **Correctness** | Whether code meets functional requirements |
| **Quality** | Code style, readability, maintainability |
| **Performance** | Runtime efficiency, resource usage |
| **Security** | Potential vulnerabilities, security risks |

### Evolution Loop

Iterative optimization until objectives are met:

1. **Initial Evaluation** - Reward Model analyzes current code
2. **Generate Plan** - Generate optimization suggestions based on evaluation results
3. **Agent Execution** - Agent Swarm executes code modifications
4. **Verify Results** - Re-evaluate to check if objectives are met
5. **Continue Iteration** - Continue optimizing if not meeting objectives

### History Tracking

Track code evolution history:
- Code snapshots for each iteration
- Decision process and reasoning records
- Score change trends
- Rollback to any version

---

## Agent Swarm Orchestration

Orchestrate multiple agents to collaboratively complete complex tasks.

### Supported Executors

Viben automatically detects installed executors on your system:

| Executor | Detection Method | MCP Support |
|----------|-----------------|-------------|
| **Claude Code** | `which claude` | ✓ |
| **AMP** | `which amp` | ✓ |
| **Cursor** | `which cursor` | ✓ |
| **Gemini** | `which gemini` | - |
| **Codex** | `which codex` | - |

### Collaboration Modes

Ways agents collaborate with each other:

| Mode | Description |
|------|-------------|
| **Sequential Execution** | Next agent continues after one completes |
| **Parallel Execution** | Multiple agents process different subtasks simultaneously |
| **Review Mode** | One agent generates, another reviews |
| **Competition Mode** | Multiple agents generate independently, best one selected |

### Agent Configuration

Each agent can be configured with:
- **Executor Type** (executor_type) - Which executor to use for running
- **System Prompt** - Define agent behavior
- **Model Parameters** - temperature, max_tokens, etc.
- **MCP Servers** - Extend agent capabilities
- **Skills** - Reusable capability packages

### Global vs Project Agents

| Scope | Storage Location | Description |
|-------|-----------------|-------------|
| **Global** | `~/.viben/agents/` | Available to all projects |
| **Project** | `<project>/.viben/agents/` | Only available to current project |

---

## Task System

XState state machine-based workflow management system.

### State Machine

Tasks flow through these states:

```
backlog → queue → in_progress → review → completed
                      ↓
                   archived
```

| Status | Description |
|--------|-------------|
| `backlog` | Pending planning, not yet in execution queue |
| `queue` | Queued waiting for agent processing |
| `in_progress` | Agent is executing |
| `review` | Awaiting human review |
| `completed` | Task completed |
| `archived` | Archived |

### Core Commands

Manage tasks via CLI:

```bash
viben task create "Implement user login feature"
viben task enqueue <task-id>
viben task start <task-id>
viben task finish <task-id>
viben task archive <task-id>
```

### Kanban View

Desktop application provides visual kanban board:

- **Column Management**: Display tasks in columns by status
- **Card Drag & Drop**: Drag cards to change status
- **Priority**: Set task priority
- **Labels**: Add labels to categorize tasks

### Task Details

Each task supports:
- Title and description
- Assignee
- Due date
- Subtask management
- Dependencies
- Comments and activity log

---

## Idea Generation

Automatically generate optimization suggestions from project context.

### Generation Types

| Type | Description |
|------|-------------|
| **Code Refactoring** | Identify refactorable code patterns |
| **Performance Optimization** | Discover performance bottlenecks and optimization points |
| **Architecture Improvement** | Propose architecture-level improvements |
| **Technical Debt** | Identify and quantify technical debt |
| **Feature Enhancement** | Feature extension suggestions based on existing code |

### Workflow

1. **Context Analysis** - Scan project code and configuration
2. **Pattern Recognition** - Identify common issues and improvement opportunities
3. **Plan Generation** - Generate specific optimization suggestions
4. **Priority Ranking** - Rank by impact and difficulty
5. **One-Click Task Creation** - Convert suggestions to Tasks for execution

---

## Workspace Management

### Multi-Workspace Support

Manage multiple project workspaces:

- **Global Workspace**: Exists by default, represents global configuration under `~` directory, cannot be deleted
- **Custom Workspace**: Project directories added by users, can be added and removed

### Adding Workspaces

Add workspaces through a wizard:

1. **Choose Method**
   - Open Existing Folder - Select an existing project directory
   - Create New Folder - Create a new directory at specified location

2. **Configuration Options**
   - Workspace name
   - Storage location
   - Initialize Git repository (if not exists)
   - Initialize .viben configuration

3. **Advanced Options**
   - Developer name
   - Project type (Full-stack/Frontend/Backend)
   - Include Cursor configuration

### Configuration Priority

Configuration is merged in this priority order (later overrides earlier):

```
Global Config (~/.viben/) → Project Config (<project>/.viben/) → Runtime Settings
```

---

## MCP Server Management

### Adding MCP Servers

Add MCP servers for agents:
- Server name
- Execution command
- Command arguments
- Environment variables

### Configuration Example

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## MCP Marketplace

### Browse and Search

- Browse official and community MCP servers
- Filter by category
- Search for specific functionality

### One-Click Install

- View MCP server details
- One-click add to workspace
- Automatic configuration

---

## Skills Management

### Skills Concept

Skills are reusable capability packages that add specific functionality to agents.

### Sources

- **Marketplace Skills**: Install from Skills marketplace
- **Local Skills**: Custom local capability packages

### Management Operations

- Add Skills
- View installed Skills
- Remove Skills

---

## AI Chat

### Agent Conversations

Converse with agents in your workspace:
- Select agent or executor
- Send messages
- Receive streaming responses

### Provider Support

Support for multiple AI Providers:

| Provider | Description |
|----------|-------------|
| **OpenAI** | GPT-4, GPT-3.5, etc. |
| **Anthropic** | Claude 3, Claude 2, etc. |
| **Ollama** | Local models |
| **Custom** | OpenAI-compatible API |

### Model Configuration

- Select model
- Adjust temperature, max tokens, and other parameters
- View token usage
- Configure model aliases and fallback strategies

### Memory System

Each agent maintains an independent Memory system:

| File | Description |
|------|-------------|
| `MEMORY.md` | Long-term memory, stores project context and user preferences |
| `logs/<date>.md` | Daily logs, records interaction summaries for the day |

---

## User Interface

### Dark Mode

Full support for light and dark themes:
- Automatically follow system theme
- Manual theme switching
- Consistent styling across all components

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| New Search | Cmd + K | Ctrl + K |
| Settings | Cmd + , | Ctrl + , |
| Quit | Cmd + Q | Alt + F4 |

### Multi-Language Support

- English
- Chinese (Simplified)

---

## Privacy & Security

### Local First

- All data stored locally
- No account required
- No telemetry or tracking

### Secure Communication

- API requests use HTTPS
- Credentials not stored in plain text

### Sensitive Data

- Support environment variable references (e.g., `${GITHUB_TOKEN}`)
- API keys not displayed in logs

---

## Data Storage

### Storage Locations

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/com.viben.app` |
| Windows | `%APPDATA%\com.viben.app` |
| Linux | `~/.config/viben` |

### Viben Configuration

Global configuration stored in `~/.viben/`:

```
~/.viben/
├── agents/              # Global agent configurations
├── providers/           # Provider configurations
├── models.yaml          # Model configuration
├── channels.yaml        # Channel configuration
├── tasks/               # Task storage
├── queue/               # Command queue
└── sessions/            # Session storage
```

### Workspace Configuration

Each workspace configuration stored in `<project>/.viben/`:

```
<project>/.viben/
├── agents/              # Workspace agents
├── tasks/               # Project tasks
├── group-chats/         # Group chats
└── config.yaml          # Workspace configuration
```

---

## Coming Soon

The following features are planned:

- **Auto Updates** - Automatic application updates
- **Plugin System** - Extend functionality through plugins
- **Cloud Sync** - Optional cloud sync for settings and favorites
- **Advanced FileEvo** - More powerful code evolution strategies
- **Swarm Templates** - Pre-defined agent collaboration templates

---

## Feature Requests

Have a feature suggestion? Submit an issue on [GitHub](https://github.com/LinXueyuanStdio/viben/issues/new?template=feature_request.md).
