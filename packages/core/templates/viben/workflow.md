# Development Workflow

> Based on [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

---

## Table of Contents

1. [Quick Start (Do This First)](#quick-start-do-this-first)
2. [Workflow Overview](#workflow-overview)
3. [Session Start Process](#session-start-process)
4. [Development Process](#development-process)
5. [Session End](#session-end)
6. [File Descriptions](#file-descriptions)
7. [Best Practices](#best-practices)

---

## Quick Start (Do This First)

### Step 0: Initialize Developer Identity (First Time Only)

> **Multi-developer support**: Each developer/Agent needs to initialize their identity first

```bash
# Check if already initialized
viben user get

# If not initialized, run:
viben user init <your-name>
# Example: viben user init cursor-agent
```

This creates:
- `.viben/.developer` - Your identity file (gitignored, not committed)
- `.viben/workspace/<your-name>/` - Your personal workspace directory

**Naming suggestions**:
- Human developers: Use your name, e.g., `john-doe`
- Cursor AI: `cursor-agent` or `cursor-<task>`
- Claude Code: `claude-agent` or `claude-<task>`
- iFlow cli: `iflow-agent` or `iflow-<task>`

### Step 1: Understand Current Context

```bash
# Get full context for a specific task
viben task context <task>

# Or check manually:
viben user get                                   # Your identity
viben task list                                  # Active tasks
git status && git log --oneline -10              # Git state
```

---

## Workflow Overview

### Core Principles

1. **Read Before Write** - Understand context before starting
2. **Follow Standards** - [!] **MUST read `docs/specs/` guidelines before coding**
3. **Incremental Development** - Complete one task at a time
4. **Record Promptly** - Update tracking files immediately after completion
5. **Document Limits** - [!] **Max 2000 lines per journal document**

### File System

```
.viben/
|-- .developer           # Developer identity (gitignored)
|-- workspace/           # Developer workspaces
|   |-- index.md         # Workspace index + Session template
|   +-- {developer}/     # Per-developer directories
|       |-- index.md     # Personal index (with @@@auto markers)
|       +-- journal-N.md # Journal files (sequential numbering)
|-- tasks/               # Task tracking
|   +-- {MM}-{DD}-{name}/
|       +-- task.json
+-- workflow.md          # This document

docs/specs/              # [!] MUST READ before coding (at project root)
|-- frontend/            # Frontend guidelines (if applicable)
|   |-- index.md         # Start here - guidelines index
|   +-- *.md             # Topic-specific docs
|-- backend/             # Backend guidelines (if applicable)
|   |-- index.md         # Start here - guidelines index
|   +-- *.md             # Topic-specific docs
+-- guides/              # Thinking guides
    |-- index.md                      # Guides index
    |-- cross-layer-thinking-guide.md # Pre-implementation checklist
    +-- *.md                          # Other guides
```

### CLI Commands

All workflow operations are available through the `viben` CLI:

```bash
# User management
viben user init <name>    # Initialize developer identity
viben user get            # Get current developer name

# Task lifecycle
viben task list           # List active tasks
viben task create "title" --slug <task-name> --description "<description>" # Create new task
viben task view <task>    # View task details
viben task start <task>   # Start task execution
viben task pause <task>   # Pause execution
viben task resume <task>  # Resume paused task
viben task finish <task>  # Finish task
viben task cancel <task>  # Cancel task
viben task archive <task> # Archive completed task

# Task queue
viben task enqueue <task> # Move task to queue
viben task dequeue <task> # Remove from queue

# Task context
viben task context <task> # Get session context for AI
viben task add-context <task> <file> # Add context files
viben task list-context <task>   # List context entries

# Review workflow
viben task review <task>  # View for review
viben task approve <task> # Approve and complete
viben task reject <task>  # Reject to backlog
viben task retry <task>   # Retry failed task

# AI-assisted phases
viben task plan-phase <task>     # Run plan agent
viben task work-phase <task>     # Run work agent (orchestrates all phases)

# Git worktree & PR
viben task create-worktree <task> # Create isolated worktree
viben task create-pr <task>      # Create PR from task
viben task cleanup <task>        # Cleanup worktrees

# Multi-agent monitoring (swarm)
viben swarm list          # List worktrees and agents
viben swarm status        # Show agent status (--watch for live)
viben swarm stop          # Stop running agent
viben swarm registry      # Show agent registry

# Session recording
viben task add-session    # Record session to journal
```

---

## Session Start Process

### Step 1: Get Session Context

Use the unified context command:

```bash
# Get context for a specific task
viben task context <task>

# Or get JSON format
viben task context <task> --json
```

### Step 3: Select Task to Develop

Use the task management commands:

```bash
# List active tasks
viben task list

# Create new task (creates directory with task.json)
viben task create "<title>" --slug <task-name>
```

---

## Development Process

### Task Development Flow

```
1. Create or select task
   --> viben task create "<title>" --slug <name> or list

2. Write code according to guidelines
   --> Read docs/specs/ docs relevant to your task
   --> For cross-layer: read docs/specs/guides/

3. Self-test
   --> Run project's lint/test commands (see spec docs)
   --> Manual feature testing

4. Commit code
   --> git add <files>
   --> git commit -m "type(scope): description"
       Format: feat/fix/docs/refactor/test/chore

5. Record session (one command)
   --> viben task add-session --title "Title" --commit "hash"
```

### Code Quality Checklist

**Must pass before commit**:
- [OK] Lint checks pass (project-specific command)
- [OK] Type checks pass (if applicable)
- [OK] Manual feature testing passes

---

## Session End

### One-Click Session Recording

After code is committed, use:

```bash
viben task add-session \
  --title "Session Title" \
  --commit "abc1234" \
  --summary "Brief summary"
```

This automatically:
1. Detects current journal file
2. Creates new file if 2000-line limit exceeded
3. Appends session content
4. Updates index.md (sessions count, history table)

### Pre-end Checklist

Use `/viben:finish-work` command to run through:
1. [OK] All code committed, commit message follows convention
2. [OK] Session recorded via `viben task add-session`
3. [OK] No lint/test errors
4. [OK] Working directory clean (or WIP noted)
5. [OK] Spec docs updated if needed

---

## File Descriptions

### 1. workspace/ - Developer Workspaces

**Purpose**: Record each AI Agent session's work content

**Structure** (Multi-developer support):
```
workspace/
|-- index.md              # Main index (Active Developers table)
+-- {developer}/          # Per-developer directory
    |-- index.md          # Personal index (with @@@auto markers)
    +-- journal-N.md      # Journal files (sequential: 1, 2, 3...)
```

**When to update**:
- [OK] End of each session
- [OK] Complete important task
- [OK] Fix important bug

### 2. docs/specs/ - Development Guidelines

**Purpose**: Documented standards for consistent development

**Location**: `docs/specs/` at project root (not inside `.viben/`)

**Structure** (Multi-doc format):
```
docs/specs/
|-- frontend/           # Frontend docs (if applicable)
|   |-- index.md        # Start here
|   +-- *.md            # Topic-specific docs
|-- backend/            # Backend docs (if applicable)
|   |-- index.md        # Start here
|   +-- *.md            # Topic-specific docs
+-- guides/             # Thinking guides
    |-- index.md        # Start here
    +-- *.md            # Guide-specific docs
```

**When to update**:
- [OK] New pattern discovered
- [OK] Bug fixed that reveals missing guidance
- [OK] New convention established

### 3. Tasks - Task Tracking

Each task is a directory containing `task.json`:

```
tasks/
|-- 01-21-my-task/
|   +-- task.json
+-- archive/
    +-- 2026-01/
        +-- 01-15-old-task/
            +-- task.json
```

**Commands**:
```bash
viben task create "<title>" [--slug <name>]   # Create task directory
viben task archive <name>                     # Archive to archive/{year-month}/
viben task list                               # List active tasks
viben task list-archive                       # List archived tasks
```

---

## Best Practices

### [OK] DO - Should Do

1. **Before session start**:
   - Run `viben task context <task>` for full task context
   - [!] **MUST read** relevant `docs/specs/` docs

2. **During development**:
   - [!] **Follow** `docs/specs/` guidelines
   - For cross-layer features, read `docs/specs/guides/cross-layer-thinking-guide.md`
   - Develop only one task at a time
   - Run lint and tests frequently

3. **After development complete**:
   - Use `/viben:finish-work` for completion checklist
   - After fix bug, use `/viben:break-loop` for deep analysis
   - Human commits after testing passes
   - Use `viben task add-session` to record progress

### [X] DON'T - Should Not Do

1. [!] **Don't** skip reading `docs/specs/` guidelines
2. [!] **Don't** let journal single file exceed 2000 lines
3. **Don't** develop multiple unrelated tasks simultaneously
4. **Don't** commit code with lint/test errors
5. **Don't** forget to update spec docs after learning something
6. [!] **Don't** execute `git commit` - AI should not commit code

---

## Quick Reference

### Must-read Before Development

| Task Type | Must-read Document |
|-----------|-------------------|
| Frontend work | `frontend/index.md` → relevant docs |
| Backend work | `backend/index.md` → relevant docs |
| Cross-Layer Feature | `guides/cross-layer-thinking-guide.md` |

### Commit Convention

```bash
git commit -m "type(scope): description"
```

**Type**: feat, fix, docs, refactor, test, chore
**Scope**: Module name (e.g., auth, api, ui)

### Common Commands

```bash
# Session management
viben task context <task>    # Get task context
viben task add-session       # Record session

# Task management
viben task list              # List tasks
viben task create "<title>"  # Create task
viben task start <task>      # Start task
viben task finish <task>     # Finish task

# Review workflow
viben task review <task>     # View for review
viben task approve <task>    # Approve task
viben task reject <task>     # Reject task

# Multi-agent operations
viben task work-phase <task> # Run work agent (orchestrates all phases)
viben swarm status --watch   # Monitor agent status (live)
viben swarm stop <task>      # Stop running agent
viben task cleanup <task>    # Cleanup worktree
viben task create-pr <task>  # Create PR from task

# Slash commands
/viben:finish-work           # Pre-commit checklist
/viben:break-loop            # Post-debug analysis
```

---

## Summary

Following this workflow ensures:
- [OK] Continuity across multiple sessions
- [OK] Consistent code quality
- [OK] Trackable progress
- [OK] Knowledge accumulation in spec docs
- [OK] Transparent team collaboration

**Core Philosophy**: Read before write, follow standards, record promptly, capture learnings
