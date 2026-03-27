---
sidebar_position: 21
title: "viben context"
description: "Get current development context to understand project status at a glance"
---

# viben context

Get current development context to understand project status at a glance.

## Overview

The `viben context` command retrieves the current development context, including user identity, Git status, current task, running agents, and other information. This is very useful for AI Agents to understand project status at startup.

## Command

```bash
viben context             # Display full context (text format)
viben context --json      # JSON format output
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json`, `-j` | JSON format output |

## Output Content

### Text Format

```
========================================
SESSION CONTEXT
========================================

## DEVELOPER
Name: john

## GIT STATUS
Branch: feature/user-auth
Working directory: 3 uncommitted change(s)

Changes:
 M src/auth.ts
 M src/api.ts
?? src/new-file.ts

## RECENT COMMITS
abc1234 feat(auth): add login endpoint
def5678 fix: resolve typo in config
ghi9012 docs: update README

## CURRENT TASK
Path: .viben/tasks/03-03-add-user-auth
Name: add-user-auth
Status: in_progress
Created: 2024-03-03
Description: Implement user authentication feature

[!] This task has prd.md - read it for task details

## ACTIVE TASKS
- 03-03-add-user-auth/ (in_progress) @john
- 03-02-fix-bug/ (backlog) @alice
- 03-01-docs/ (completed) @john
Total: 3 active task(s)

## MY TASKS (Assigned to me)
- [P1] Add user authentication (in_progress)
- [P3] Update documentation (completed)

## JOURNAL FILE
Active file: .viben/workspace/john/journal-1.md
Line count: 1500 / 2000

## PATHS
Workspace: .viben/workspace/john/
Tasks: .viben/tasks/
Spec: docs/specs/

========================================
```

### JSON Format

```json
{
  "developer": "john",
  "git": {
    "branch": "feature/user-auth",
    "isClean": false,
    "uncommittedChanges": 3,
    "recentCommits": [
      {"hash": "abc1234", "message": "feat(auth): add login endpoint"},
      {"hash": "def5678", "message": "fix: resolve typo in config"},
      {"hash": "ghi9012", "message": "docs: update README"},
      {"hash": "jkl3456", "message": "refactor: clean up code"},
      {"hash": "mno7890", "message": "test: add unit tests"}
    ]
  },
  "tasks": {
    "active": [
      {"dir": "03-03-add-user-auth", "name": "add-user-auth", "status": "in_progress"},
      {"dir": "03-02-fix-bug", "name": "fix-bug", "status": "backlog"},
      {"dir": "03-01-docs", "name": "docs", "status": "completed"}
    ],
    "directory": ".viben/tasks"
  },
  "journal": {
    "file": ".viben/workspace/john/journal-1.md",
    "lines": 1500,
    "nearLimit": false
  }
}
```

## Output Field Descriptions

### developer

Current user identity. If not initialized, displays error message and prompts to run `viben user init`.

### git

Git status information:
- `branch`: Current branch
- `isClean`: Whether working directory is clean
- `uncommittedChanges`: Number of uncommitted changes
- `recentCommits`: Most recent 5 commits

### tasks

Task information:
- `active`: Active task list (excluding archive)
- `directory`: Task directory path

### journal

Session journal information:
- `file`: Currently active journal file
- `lines`: Current line count
- `nearLimit`: Whether approaching 2000 line limit

## Examples

```bash
# View full context
viben context

# JSON format (for script processing)
viben context --json

# Get current branch
viben context --json | jq -r '.git.branch'

# Check for uncommitted changes
viben context --json | jq -r '.git.isClean'
```

## Related Commands

- [viben user](./user) - User identity management
- [viben task](./task) - Task management
- [viben session](./session) - Session recording
