---
sidebar_position: 5
title: "Session Management"
description: "Managing Viben agent sessions - create, list, and manage conversation history"
---

# Session Management

Sessions store conversation history and state for each agent. This guide covers session concepts and management commands.

## Session Concepts

### What is a Session?

A session represents a conversation thread with an agent. Each session has:

- **Session ID**: Unique identifier for the session
- **Configuration**: Session-specific settings
- **Message History**: Conversation messages stored in JSONL format
- **State**: Any session-specific state or context

### Session Storage

Sessions are stored in the agent's `.agent_sessions/` directory:

```
~/.viben/agents/<agent-id>/.agent_sessions/
+-- <session-id>/
    |-- config.yaml              # Session configuration
    +-- messages.rollout.jsonl   # Message history (JSONL)
```

### Message History Format

Messages are stored in JSONL (JSON Lines) format:

```jsonl
{"role": "user", "content": "Hello", "timestamp": "2024-01-16T10:30:00Z"}
{"role": "assistant", "content": "Hi there!", "timestamp": "2024-01-16T10:30:01Z"}
{"role": "user", "content": "Help me write a function", "timestamp": "2024-01-16T10:31:00Z"}
{"role": "assistant", "content": "Sure! What should...", "timestamp": "2024-01-16T10:31:02Z"}
```

## Session Commands

### List Sessions

List all sessions for an agent:

```bash
viben agent session list -n <agent-id>
```

**Example:**
```bash
viben agent session list -n my-agent
```

**Output:**
```
Sessions for my-agent:

  ID              Name                    Messages  Last Used
  ----------------------------------------------------------------
  main*           Feature development     42        2h ago
  feature-auth    Auth implementation     28        1d ago
  bugfix-123      Bug investigation       15        3d ago

* = current session
```

### JSON Output

```bash
viben agent session list -n my-agent --json
```

**Output:**
```json
{
  "success": true,
  "data": {
    "agent_id": "my-agent",
    "current": "main",
    "sessions": [
      {
        "id": "main",
        "name": "Feature development",
        "message_count": 42,
        "last_used": "2024-01-16T08:30:00Z",
        "created": "2024-01-10T09:00:00Z"
      },
      {
        "id": "feature-auth",
        "name": "Auth implementation",
        "message_count": 28,
        "last_used": "2024-01-15T14:00:00Z",
        "created": "2024-01-12T10:00:00Z"
      }
    ]
  }
}
```

### Create Session

Create a new session:

```bash
viben agent session create -n <agent-id> [session-name]
```

**Examples:**
```bash
# Create with auto-generated ID
viben agent session create -n my-agent

# Create with custom name
viben agent session create -n my-agent "feature-auth"

# Create with specific ID
viben agent session create -n my-agent --id auth-implementation "Auth Implementation"
```

**Output:**
```
Created session: feature-auth
  Agent: my-agent
  Path: ~/.viben/agents/my-agent/.agent_sessions/feature-auth/
```

### Show Session Details

View session information and recent messages:

```bash
viben agent session show -n <agent-id> -s <session-id>
```

**Example:**
```bash
viben agent session show -n my-agent -s main
```

**Output:**
```
Session: main
Agent: my-agent
Name: Feature development
Created: 2024-01-10 09:00
Last Used: 2024-01-16 08:30

Messages: 42 total
Storage: 15.3 KB

Recent Messages (last 5):
  [User 08:25] Can you help me refactor this function?
  [Assistant 08:26] Sure! Looking at the function...
  [User 08:28] That looks good, but what about error handling?
  [Assistant 08:29] Good point! Let me add proper error handling...
  [User 08:30] Perfect, thanks!

Path: ~/.viben/agents/my-agent/.agent_sessions/main/
```

### Remove Session

Delete a session and its history:

```bash
viben agent session remove -n <agent-id> -s <session-id>
```

**Example:**
```bash
viben agent session remove -n my-agent -s old-session
```

**Output:**
```
Are you sure you want to remove session 'old-session'? [y/N]: y
Removed session: old-session
```

### Force Remove

Skip confirmation:

```bash
viben agent session remove -n my-agent -s old-session --force
```

### Clear Session History

Clear all messages from a session while keeping the session:

```bash
viben agent session clear -n <agent-id> -s <session-id>
```

**Example:**
```bash
viben agent session clear -n my-agent -s main
```

**Output:**
```
Are you sure you want to clear session 'main' history? [y/N]: y
Cleared 42 messages from session: main
```

## Session Configuration

Each session can have its own configuration in `config.yaml`:

```yaml
# ~/.viben/agents/my-agent/.agent_sessions/main/config.yaml
id: main
name: "Feature development"
created: 2024-01-10T09:00:00Z
last_used: 2024-01-16T08:30:00Z

# Session-specific settings
settings:
  model: claude-sonnet-4-20250514
  temperature: 0.7
  max_tokens: 8192

# Context files loaded at session start
context_files:
  - /path/to/project/README.md
  - /path/to/project/ARCHITECTURE.md

# Session notes
notes: |
  Working on authentication feature.
  Using JWT tokens with refresh mechanism.
```

## Session Workflows

### Starting a Session

When a session starts:

1. Load agent configuration
2. Load session configuration (if exists)
3. Load memory (MEMORY.md + daily logs)
4. Load session context files (if specified)
5. Resume conversation from message history

### Switching Sessions

```bash
# Set current session for agent
viben agent session use -n my-agent -s feature-auth
```

Or use environment variable:

```bash
export VIBEN_SESSION=feature-auth
```

### Session Branches

Create a new session branching from existing history:

```bash
viben agent session create -n my-agent "exploration" --from main --at 25
```

This creates a new session with the first 25 messages from the `main` session.

## Session Best Practices

### Naming Conventions

- Use descriptive names: `feature-auth`, `bugfix-login`, `refactor-api`
- Keep names short but meaningful
- Use lowercase with hyphens

### When to Create New Sessions

| Scenario | Recommendation |
|----------|----------------|
| New feature | Create new session |
| Bug investigation | Create new session |
| Continuation of work | Use existing session |
| Experimental exploration | Create new session |
| Different project | Use different agent |

### Session Hygiene

1. **Regular cleanup**: Remove old, unused sessions
2. **Clear long sessions**: Clear history if context becomes too large
3. **Archive important sessions**: Export before clearing

```bash
# Export session for archival
viben agent session export -n my-agent -s important-session -o ~/archives/

# List sessions by last used
viben agent session list -n my-agent --sort last-used

# Remove sessions older than 30 days
viben agent session cleanup -n my-agent --older-than 30d
```

## Troubleshooting

### Session Not Found

```
Error: Session 'my-session' not found for agent 'my-agent'
```

**Solution:** List available sessions and check the ID:
```bash
viben agent session list -n my-agent
```

### Message History Corrupted

If the JSONL file is corrupted:

```bash
# Validate session
viben agent session validate -n my-agent -s main

# Repair if possible
viben agent session repair -n my-agent -s main
```

### Session Too Large

Large sessions can slow down context loading:

```bash
# Check session size
viben agent session show -n my-agent -s main --stats

# Truncate old messages (keep last N)
viben agent session truncate -n my-agent -s main --keep 100
```

## Next Steps

- [Memory System](./memory-system) - Configure agent memory
- [Agent Configuration](./agent-configuration) - Session-related settings
- [Templates](./templates) - Templates with session presets
