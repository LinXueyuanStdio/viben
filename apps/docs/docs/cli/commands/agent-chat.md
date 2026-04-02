---
sidebar_position: 9
title: "viben agent chat"
description: "Non-interactive conversation with a specified Agent"
---

# viben agent chat

Non-interactive conversation with a specified Agent.

## Overview

Adds a `chat` subcommand to `viben agent` for non-interactive Agent conversations. The Agent calls the corresponding underlying executor based on its configured type (e.g., claude-code, gemini), while automatically loading the Agent's memory, MCP configuration, and Skills.

## Command Interface

```
viben agent chat [OPTIONS] -n <AGENT_ID>

OPTIONS:
    -n, --name <AGENT_ID>       Agent ID (required)
    -p, --prompt <PROMPT>       Prompt (optional, reads from stdin if not provided)
    -C, --cwd <DIR>             Working directory (default: current directory)

    --input-format <FORMAT>     Input format: text (default), stream-json
    --output-format <FORMAT>    Output format: text (default), stream-json
    --verbose                   Verbose output

    -s, --session <SESSION_ID>  Specify session ID
    --resume <SESSION_ID>       Resume existing session
    --new-session               Force create new session

    --model <MODEL>             Override Agent's configured model
    --no-memory                 Don't load Agent memory
    --dangerously-skip-permissions  Skip permission checks

    --json                      JSON format output
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        viben agent chat                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AgentChatCommand::execute()                 │
│  1. Parse arguments                                              │
│  2. Load Agent config (~/.viben/agents/<id>/config.yaml)         │
│  3. Load Agent memory (MEMORY.md + today/yesterday logs)         │
│  4. Read prompt (from -p or stdin)                               │
│  5. Merge workspace config (<cwd>/.claude/ etc.)                 │
│  6. Select executor based on Agent type                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Executor Selection                           │
│  agent.type == "claude-code"  →  ClaudeCode executor            │
│  agent.type == "gemini"       →  Gemini executor                │
│  agent.type == "codex"        →  Codex executor                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     spawn_agent_chat_process()                   │
│  Build command: claude -p "prompt" --append-system-prompt "mem" │
│  - Inject Agent memory as system prompt                          │
│  - Add corresponding args based on input/output format           │
│  - Handle session, model and other parameters                    │
│  - Load Agent's MCP servers configuration                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Child process (claude/gemini/...)           │
│  stdin  ◄──── Inherits parent stdin                              │
│  stdout ────► Inherits parent stdout                             │
│  stderr ────► Inherits parent stderr                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Post-processing                             │
│  - Update Agent daily log (memory/YYYY-MM-DD.md)                 │
│  - Save session to .agent_sessions/<session_id>/                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Usage Examples

```bash
# ============================================================
# Basic Usage
# ============================================================

# Conversation with default agent
viben agent chat -p "Analyze this code"

# Specify agent
viben agent chat -n my-agent -p "Write a sorting function"

# Read prompt from stdin
echo "Explain this error" | viben agent chat -n my-agent

# Specify working directory
viben agent chat -n my-agent -p "Analyze project structure" -C /path/to/project

# ============================================================
# Session Management
# ============================================================

# Use specific session
viben agent chat -n my-agent -p "Continue previous work" -s main

# Resume existing session
viben agent chat -n my-agent -p "Continue" --resume abc123

# Force create new session
viben agent chat -n my-agent -p "Start new task" --new-session

# ============================================================
# Advanced Options
# ============================================================

# Override model
viben agent chat -n my-agent -p "Complex reasoning task" --model claude-3-opus

# Don't load memory (clean state)
viben agent chat -n my-agent -p "Independent task" --no-memory

# Skip permission checks
viben agent chat -n my-agent -p "Automation script" --dangerously-skip-permissions

# ============================================================
# Programmatic Calls (JSON Stream)
# ============================================================

# JSON stream input/output
echo '{"type":"user","message":{"role":"user","content":"Analyze code"}}' | \
  viben agent chat -n my-agent --input-format stream-json --output-format stream-json

# JSON format output
viben agent chat -n my-agent -p "Quick task" --json
```

---

## Agent Memory Injection

Agent chat automatically loads and injects the Agent's memory:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Loading                               │
├─────────────────────────────────────────────────────────────────┤
│  1. ~/.viben/agents/<id>/memory/MEMORY.md      (Main memory)    │
│  2. ~/.viben/agents/<id>/memory/YYYY-MM-DD.md  (Today's log)    │
│  3. ~/.viben/agents/<id>/memory/YYYY-MM-DD.md  (Yesterday's log)│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Prompt Construction                          │
│                                                                  │
│  [System Prompt]                                                 │
│  # Agent Memory                                                  │
│  <contents of MEMORY.md>                                         │
│                                                                  │
│  # Recent Activity                                               │
│  ## Yesterday (2024-01-15)                                       │
│  <contents of yesterday's log>                                   │
│                                                                  │
│  ## Today (2024-01-16)                                           │
│  <contents of today's log>                                       │
│                                                                  │
│  [User Prompt]                                                   │
│  <actual user prompt>                                            │
└─────────────────────────────────────────────────────────────────┘
```

Use `--no-memory` to skip memory loading.

---

## Configuration Merge Order

When agent chat executes, configuration is merged by priority:

```
Priority from low to high:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent Base Configuration                                      │
│    ~/.viben/agents/<id>/config.yaml                             │
│    - type, model, mcp, skills, etc.                              │
├─────────────────────────────────────────────────────────────────┤
│ 2. Workspace Configuration (based on agent type)                 │
│    <cwd>/.claude/settings.json  (if type=claude-code)           │
│    <cwd>/.cursor/settings.json  (if type=cursor)                │
├─────────────────────────────────────────────────────────────────┤
│ 3. Command Line Arguments                                        │
│    --model, --session, --no-memory, etc.                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Storage

Conversation sessions are stored in the Agent directory:

```
~/.viben/agents/<agent-id>/.agent_sessions/
└── <session_id>/
    ├── config.yaml              # Session configuration
    │   session_id: abc123
    │   created_at: 2024-01-16T10:30:00Z
    │   last_active: 2024-01-16T14:15:00Z
    │   cwd: /path/to/project
    │   model: claude-3-sonnet
    │
    └── messages.rollout.jsonl   # Message history (JSONL format)
```

---

## Output Examples

**`viben agent chat -n my-agent -p "Hello"` (Human)**:
```
Hello! I'm your coding assistant. How can I help you today?

I have access to your project context and remember our previous conversations.
What would you like to work on?
```

**`viben agent chat -n my-agent -p "Hello" --json`**:
```json
{
  "success": true,
  "agent_id": "my-agent",
  "session_id": "abc123",
  "response": "Hello! I'm your coding assistant...",
  "tokens": {
    "input": 150,
    "output": 42
  },
  "memory_loaded": true,
  "duration_ms": 1234
}
```

**Error: Agent not found**:
```
Error: Agent not found: unknown-agent

Available agents:
  main         claude-code
  my-agent     claude-code
  researcher   gemini

Use `viben agent list` to see all agents.
```

**Error: Agent type doesn't support chat**:
```
Error: Chat not supported for agent type: custom

Supported types: claude-code, gemini, codex
```

---

## Difference from executor chat

| Feature | `viben executor chat` | `viben agent chat` |
|---------|----------------------|-------------------|
| Target | Directly call underlying executor | Call configured Agent |
| Memory | None | Automatically loads Agent memory |
| Configuration | Command line args only | Agent config + workspace + command line |
| Session | Temporary | Persisted to Agent directory |
| MCP | Manual configuration needed | Uses Agent's MCP configuration |
| Skills | None | Uses Agent's Skills |
| Use Case | One-off calls, script integration | Ongoing conversations, project development |

---

## Acceptance Criteria

### Basic Functionality
- [ ] `viben agent chat -n <id> -p <prompt>` executes conversation
- [ ] Read prompt from stdin (when -p not provided)
- [ ] Select correct executor based on Agent type
- [ ] `-C` specifies working directory

### Memory System
- [ ] Automatically load `MEMORY.md`
- [ ] Automatically load today + yesterday logs
- [ ] `--no-memory` skips memory loading
- [ ] Update daily log after conversation

### Session Management
- [ ] `-s` specifies session ID
- [ ] `--resume` resumes existing session
- [ ] `--new-session` forces new session creation
- [ ] Session persisted to `.agent_sessions/`

### Configuration Merge
- [ ] Load Agent base configuration
- [ ] Merge workspace configuration
- [ ] Command line args override configuration
- [ ] `--model` overrides model setting

### Input/Output Formats
- [ ] `--input-format text` (default)
- [ ] `--input-format stream-json`
- [ ] `--output-format text` (default)
- [ ] `--output-format stream-json`
- [ ] `--json` outputs JSON result

### Error Handling
- [ ] Show available agents when Agent not found
- [ ] Error when Agent type doesn't support chat
- [ ] Error when no prompt and stdin is empty

### Permissions & Security
- [ ] Permission checks required by default
- [ ] `--dangerously-skip-permissions` skips checks
- [ ] `--verbose` verbose output

---

## Related Documents

- [agent.md](./agent.md) - Agent management commands
- [executor-chat.md](./executor-chat.md) - Executor Chat command
- [executor.md](./executor.md) - Executor management commands
