---
sidebar_position: 20
title: "viben session"
description: "Session record management for tracking development progress and knowledge accumulation"
---

# viben session

Session record management for tracking development progress and knowledge accumulation.

## Overview

The `viben session` command is used to record and manage development sessions. After completing work, you can add session records to journal files for convenient progress tracking and knowledge accumulation.

## Command Structure

```bash
viben session <subcommand> [options]
```

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `add` | Record a development session |
| `list` | List session history |

## Add Session

Record a development session.

```bash
viben session add --title "Implement user authentication" --commit "abc1234" --summary "Completed login and registration features"
viben session add -t "Fix login bug" -c "def5678"
viben session add --title "Refactor code" --content-file ./notes.md
```

**Options**:

| Option | Description |
|--------|-------------|
| `--title`, `-t` | Session title (required) |
| `--commit`, `-c` | Associated commit hash (multiple separated by commas) |
| `--summary`, `-s` | Session summary |
| `--content-file` | Detailed content file path |

**Also supports reading content from stdin**:

```bash
echo "Detailed content..." | viben session add --title "Title" --commit "hash"
```

**Output**:

```
========================================
ADD SESSION
========================================

Session: 16
Title: Implement user authentication
Commit: abc1234

Current journal file: journal-1.md
Current lines: 1450
New content lines: 50
Total after append: 1500

[OK] Appended session to journal-1.md

Updating index.md for session 16...
  Title: Implement user authentication
  Commit: `abc1234`
  Active File: journal-1.md

[OK] Updated index.md successfully!

========================================
[OK] Session 16 added successfully!
========================================

Files updated:
  - journal-1.md
  - index.md
```

## Automatic Behaviors

1. **Detect Journal Line Count**: If current journal file exceeds 2000 lines, automatically creates a new file
2. **Create New Journal**: Naming format is `journal-N.md`, N increments
3. **Update index.md**: Updates session count, history table, active file information

**Journal Exceeds Limit Example**:

```
Current journal file: journal-1.md
Current lines: 1980
New content lines: 50
Total after append: 2030

[!] Exceeds 2000 lines, creating journal-2.md
Created: .viben/workspace/john/journal-2.md
[OK] Appended session to journal-2.md
```

## List Sessions

```bash
viben session list              # Current user's sessions
viben session list --all        # All users' sessions
viben session list --limit 10   # Most recent 10
viben session list --json       # JSON output
```

**Options**:

| Option | Description |
|--------|-------------|
| `--all` | Show all users' sessions |
| `--limit`, `-n` | Limit number of entries displayed |
| `--json` | JSON format output |

**Output**:

```
=== Session History (john) ===

# | Date       | Task                | Commits
--|------------|---------------------|----------
16 | 2024-03-03 | Implement user auth | `abc1234`
15 | 2024-03-03 | Fix login bug       | `def5678`
14 | 2024-03-02 | Add unit tests      | `ghi9012`
13 | 2024-03-02 | Refactor code       | -
12 | 2024-03-01 | Initialize project  | `jkl3456`

Total: 16 sessions
```

## Storage Structure

```
.viben/workspace/
├── index.md                    # Main index (active developers table)
└── {user}/
    ├── index.md                # Personal index (with @@@auto markers)
    ├── journal-1.md            # Session journal (2000 line limit)
    ├── journal-2.md            # Second journal file
    └── ...
```

## Journal File Format

### File Header

```markdown
# Journal - john (Part 1)

> Started: 2024-03-01

---
```

### Session Entry

```markdown

## Session 16: Implement user authentication

**Date**: 2024-03-03
**Task**: Implement user authentication

### Summary

Completed login and registration features

### Main Changes

- Added JWT token validation
- Implemented encrypted password storage
- Created login/registration API

### Git Commits

| Hash | Message |
|------|---------|
| `abc1234` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
```

### Continuation File Header

```markdown
# Journal - john (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2024-03-03

---
```

## index.md Auto Markers

index.md uses `@@@auto` markers to identify auto-update regions:

```markdown
## Status

<!-- @@@auto:current-status -->
- **Active File**: `journal-2.md`
- **Total Sessions**: 16
- **Last Active**: 2024-03-03
<!-- @@@/auto:current-status -->

## Documents

<!-- @@@auto:active-documents -->
| File | Lines | Status |
|------|-------|--------|
| `journal-2.md` | ~50 | Active |
| `journal-1.md` | ~2000 | Archived |
<!-- @@@/auto:active-documents -->

## Session History

<!-- @@@auto:session-history -->
| # | Date | Task | Commits |
|---|------|------|---------|
| 16 | 2024-03-03 | Implement user auth | `abc1234` |
| 15 | 2024-03-03 | Fix login bug | `def5678` |
...
<!-- @@@/auto:session-history -->
```

## Related Commands

- [viben user](./user) - User identity management
- [viben context](./context) - Context retrieval
- [viben task](./task) - Task management
