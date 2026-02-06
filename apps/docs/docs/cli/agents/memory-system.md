---
sidebar_position: 4
title: "Memory System"
description: "Understanding and managing Viben agent memory - MEMORY.md and daily logs"
---

# Memory System

The Viben agent memory system provides persistent, structured storage for agent knowledge and daily activities. This guide covers the memory architecture and management commands.

## Memory Architecture

Each agent has a `memory/` directory with two types of files:

| File | Purpose | Read Timing |
|------|---------|-------------|
| `MEMORY.md` | Main memory file with structured knowledge | Every session start |
| `YYYY-MM-DD.md` | Daily logs (append-only) | Today + yesterday at session start |

### Directory Structure

```
~/.viben/agents/<agent-id>/memory/
|-- MEMORY.md            # Main memory file (structured knowledge)
|-- 2024-01-13.md        # Daily log (3 days ago)
|-- 2024-01-14.md        # Daily log (2 days ago)
|-- 2024-01-15.md        # Daily log (yesterday)
+-- 2024-01-16.md        # Daily log (today)
```

## Main Memory (MEMORY.md)

The main memory file contains structured, curated knowledge that the agent should always have access to.

### Purpose

- **Persistent context**: Information that should be available across all sessions
- **Structured knowledge**: Organized facts, preferences, and project context
- **Curated content**: Manually maintained or agent-updated important information

### Example Structure

```markdown
# Agent Memory

## User Preferences
- Prefers TypeScript over JavaScript
- Uses VS Code as primary editor
- Follows conventional commits format

## Project Context
- Current project: Viben CLI
- Main language: TypeScript
- Framework: Commander.js

## Important Decisions
- 2024-01-15: Decided to use YAML for configuration
- 2024-01-10: Chose sqlite for local storage

## Common Tasks
- Code review: Focus on type safety and error handling
- Commits: Use conventional commit format

## Notes
- API keys stored in environment variables
- Tests use vitest framework
```

### When to Update MEMORY.md

- Add new user preferences discovered during sessions
- Record important project decisions
- Update project context when it changes
- Remove outdated information

## Daily Logs (YYYY-MM-DD.md)

Daily logs are append-only files that capture session activities.

### Purpose

- **Session history**: What was worked on during each session
- **Progress tracking**: Tasks completed and pending
- **Context continuity**: Helps agent remember recent work

### Format

```markdown
# 2024-01-16

## 10:30 - Session started
- Working on feature X
- Discovered issue with Y

## 14:15 - Completed task
- Fixed bug in Z
- Updated documentation

## 17:00 - Session ended
- Next steps: review PR, deploy to staging
```

### Automatic Reading

At session start, the agent automatically reads:
- `MEMORY.md` (always)
- Today's daily log (if exists)
- Yesterday's daily log (if exists)

This is controlled by the `DAILY_LOG_DAYS` setting in `.agentrc`:

```bash
# Read today + yesterday (default)
DAILY_LOG_DAYS=2

# Read only today
DAILY_LOG_DAYS=1

# Read today + 2 previous days
DAILY_LOG_DAYS=3
```

## Memory Management Commands

### View Memory

```bash
# View main memory
viben agent memory show -n <agent-id>

# View specific date
viben agent memory show -n <agent-id> --date 2024-01-16

# View all memory files
viben agent memory show -n <agent-id> --all
```

**Example:**
```bash
viben agent memory show -n my-agent
```

**Output:**
```
Memory: my-agent

MEMORY.md (2.3 KB, modified 2h ago)
----------------------------------------
# Agent Memory

## User Preferences
- Prefers TypeScript over JavaScript
...

Daily Logs:
  2024-01-16.md  1.1 KB  today
  2024-01-15.md  3.2 KB  yesterday
  2024-01-14.md  2.8 KB  2 days ago
```

### Append to Daily Log

Add content to today's daily log:

```bash
viben agent memory append -n <agent-id> "content to append"
```

**Example:**
```bash
viben agent memory append -n my-agent "## 14:30 - Code review completed
- Reviewed PR #123
- Found 3 issues, all resolved"
```

This appends to `memory/2024-01-16.md` (today's date).

### Edit Main Memory

Open the main memory file in your default editor:

```bash
viben agent memory edit -n <agent-id>
```

**Example:**
```bash
viben agent memory edit -n my-agent
```

This opens `~/.viben/agents/my-agent/memory/MEMORY.md` in the editor configured via `settings.editor` or the `EDITOR` environment variable.

### Edit Specific Date

```bash
viben agent memory edit -n <agent-id> --date 2024-01-15
```

## Memory Best Practices

### MEMORY.md Organization

1. **Use clear sections**: Divide content into logical sections
2. **Keep it concise**: Focus on essential information
3. **Update regularly**: Remove outdated information
4. **Use markdown**: Leverage headings, lists, and formatting

### Daily Logs

1. **Timestamp entries**: Start each entry with time
2. **Be specific**: Include actionable details
3. **Note blockers**: Record issues and solutions
4. **Plan next steps**: End sessions with next actions

### Memory Hygiene

```bash
# Periodically clean old daily logs (keep last 30 days)
viben agent memory cleanup -n my-agent --keep-days 30

# Archive old logs
viben agent memory archive -n my-agent --before 2024-01-01
```

## Memory Flow Diagram

```
Session Start
     |
     v
+----------------+
| Load MEMORY.md |  <-- Always loaded
+----------------+
     |
     v
+------------------+
| Load Today's Log |  <-- If exists
+------------------+
     |
     v
+----------------------+
| Load Yesterday's Log |  <-- Based on DAILY_LOG_DAYS
+----------------------+
     |
     v
+----------------+
| Agent Context  |
| Ready          |
+----------------+
     |
     | (During session)
     v
+------------------+
| Append to       |  <-- Agent or user adds entries
| Today's Log     |
+------------------+
     |
     | (If needed)
     v
+----------------+
| Update         |  <-- Important discoveries
| MEMORY.md      |
+----------------+
```

## Configuration

### In .agentrc

```bash
# Memory files to load at startup
MEMORY_FILES="MEMORY.md"

# Number of daily logs to read (today + N-1 previous days)
DAILY_LOG_DAYS=2
```

### In config.yaml

```yaml
memory:
  main_file: MEMORY.md
  daily_log_days: 2
  auto_cleanup: true
  cleanup_keep_days: 30
```

## Troubleshooting

### Memory Not Loading

```bash
# Check if memory files exist
ls -la ~/.viben/agents/my-agent/memory/

# Verify file permissions
chmod 644 ~/.viben/agents/my-agent/memory/*
```

### Daily Log Not Created

Daily logs are created automatically on first append. To create manually:

```bash
viben agent memory append -n my-agent "# $(date +%Y-%m-%d)

## Session started"
```

### Memory Too Large

If MEMORY.md becomes too large:

1. Archive old sections to a separate file
2. Summarize detailed content
3. Move project-specific info to workspace config

```bash
# Check memory size
viben agent memory show -n my-agent --stats
```

**Output:**
```
Memory Stats: my-agent
  MEMORY.md: 15.2 KB (recommended: < 10 KB)
  Daily logs: 23 files, 45.6 KB total
  Total: 60.8 KB
```

## Next Steps

- [Sessions](./sessions) - Manage agent sessions
- [Agent Configuration](./agent-configuration) - Configure memory settings
- [Templates](./templates) - Create templates with memory structure
