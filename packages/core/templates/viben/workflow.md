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
# Get full context in one command (specify task or use current task)
viben task context <task>

# Or check manually:
viben user get                                   # Your identity
viben task list                                  # Active tasks
git status && git log --oneline -10              # Git state
```

### Step 2: Read Project Guidelines [MANDATORY]

**CRITICAL**: Read guidelines before writing any code:

```bash
# Read frontend guidelines index (if applicable)
cat docs/specs/frontend/index.md

# Read backend guidelines index (if applicable)
cat docs/specs/backend/index.md
```

**Why read both?**
- Understand the full project architecture
- Know coding standards for the entire codebase
- See how frontend and backend interact
- Learn the overall code quality requirements

### Step 3: Before Coding - Read Specific Guidelines (Required)

Based on your task, read the **detailed** guidelines:

**Frontend Task**:
```bash
cat docs/specs/frontend/hook-guidelines.md      # For hooks
cat docs/specs/frontend/component-guidelines.md # For components
cat docs/specs/frontend/type-safety.md          # For types
```

**Backend Task**:
```bash
cat docs/specs/backend/database-guidelines.md   # For DB operations
cat docs/specs/backend/type-safety.md           # For types
cat docs/specs/backend/logging-guidelines.md    # For logging
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

# Task management
viben task list           # List active tasks
viben task create         # Create new task
viben task start          # Set current task
viben task finish <task>  # Finish specified task
viben task archive        # Archive completed task
viben task context <task> # Get session context for specified task
viben task add-session    # Record session

# Multi-agent operations
viben swarm start         # Start worktree agent
viben swarm status        # Monitor agent status
viben swarm cleanup       # Cleanup worktree
viben task create-pr      # Create PR from task
viben task plan           # Start plan agent
```

---

## Session Start Process

### Step 1: Get Session Context

Use the unified context command:

```bash
# Get all context for a specific task
viben task context <task>

# Or get JSON format
viben task context <task> --json
```

### Step 2: Read Development Guidelines [!] REQUIRED

**[!] CRITICAL: MUST read guidelines before writing any code**

Based on what you'll develop, read the corresponding guidelines:

**Frontend Development** (if applicable):
```bash
# Read index first, then specific docs based on task
cat docs/specs/frontend/index.md
```

**Backend Development** (if applicable):
```bash
# Read index first, then specific docs based on task
cat docs/specs/backend/index.md
```

**Cross-Layer Features**:
```bash
# For features spanning multiple layers
cat docs/specs/guides/cross-layer-thinking-guide.md
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

**Project-specific checks**:
- See `docs/specs/frontend/quality-guidelines.md` for frontend
- See `docs/specs/backend/quality-guidelines.md` for backend

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
   - Run `viben task context <task>` for full context of the task you're working on
   - [!] **MUST read** relevant `docs/specs/` docs

2. **During development**:
   - [!] **Follow** `docs/specs/` guidelines
   - For cross-layer features, use `/viben:check-cross-layer`
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
viben task context <task>    # Get full context for specified task
viben task add-session       # Record session

# Task management
viben task list              # List tasks
viben task create "<title>"  # Create task

# Multi-agent operations
viben swarm start <task>     # Start worktree agent
viben swarm status           # Monitor agent status
viben swarm cleanup <task>   # Cleanup worktree
viben task create-pr         # Create PR from task

# Slash commands
/viben:finish-work          # Pre-commit checklist
/viben:break-loop           # Post-debug analysis
/viben:check-cross-layer    # Cross-layer verification
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
