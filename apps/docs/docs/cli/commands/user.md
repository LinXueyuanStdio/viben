---
sidebar_position: 22
title: "viben user"
description: "User identity management supporting multi-developer/multi-agent collaboration"
---

# viben user

User identity management supporting multi-developer/multi-agent collaboration.

## Overview

The `viben user` command is used to manage user identity and is the foundation of the Viben workflow. Each developer (human or agent) needs to initialize their identity to use task management and session recording features.

## Command Structure

```bash
viben user <subcommand> [options]
```

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `init` | Initialize user identity |
| `get` | Get current user identity |

## Initialize Identity

```bash
viben user init <name>
```

**Naming Suggestions**:

| Type | Examples |
|------|----------|
| Human developer | `john`, `alice`, `zhang-san` |
| Claude Code agent | `claude-agent`, `claude-task-001` |
| Cursor agent | `cursor-agent` |
| Gemini agent | `gemini-agent` |

**Creates File**: `.viben/.developer` (gitignored)

**Creates Directory**: `.viben/workspace/<name>/`

**Examples**:

```bash
viben user init john
viben user init claude-agent
```

**Output**:

```
[INFO] Creating developer workspace...
[SUCCESS] Developer initialized: john
[INFO] Created: .viben/.developer
[INFO] Created: .viben/workspace/john/index.md
[INFO] Created: .viben/workspace/john/journal-1.md
```

**Note**: If already initialized, shows current user and exits:

```
Developer already initialized: john

To reinitialize, remove .viben/.developer first
```

## Get Identity

```bash
viben user get           # Output username
viben user get --json    # JSON format output
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

**Examples**:

```bash
viben user get
# Output: john

viben user get --json
# Output: {"user": "john"}
```

**When Not Initialized**:

```
Developer not initialized
```

## Storage Structure

```
.viben/
├── .developer                    # User identity file (gitignored)
│                                 # Content: name=john
└── workspace/
    ├── index.md                  # Main index (active developers table)
    └── john/                     # User workspace
        ├── index.md              # Personal index
        └── journal-1.md          # Session journal
```

### .developer File Format

```
name=john
```

### workspace/index.md Format

```markdown
# Viben Workspace Index

## Active Developers

| Name | Last Active | Sessions |
|------|-------------|----------|
| john | 2024-03-03  | 15       |
```

### workspace/\{user\}/index.md Format

```markdown
# Workspace - john

## Status

<!-- @@@auto:current-status -->
- **Active File**: `journal-1.md`
- **Total Sessions**: 15
- **Last Active**: 2024-03-03
<!-- @@@/auto:current-status -->

## Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| `journal-1.md` | ~1500 | Active |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
| 15 | 2024-03-03 | Add user auth | `abc1234` |
| 14 | 2024-03-02 | Fix bug | `def5678` |
<!-- @@@/auto:session-history -->
```

## Related Commands

- [viben session](./session) - Session record management
- [viben context](./context) - Context retrieval
- [viben task](./task) - Task management
