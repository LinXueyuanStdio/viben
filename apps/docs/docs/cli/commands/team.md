---
sidebar_position: 14
title: "viben team"
description: "Team collaboration workspace initialization and management"
---

# viben team

Team collaboration workspace initialization and management.

## Usage

```bash
viben team <subcommand> [options]
```

## Architecture Overview

```
+-------------------------------------------------------------+
|                    Team Workspace                            |
+-------------------------------------------------------------+
|  .viben/                                                     |
|      +-- workflow.md           # Workflow documentation       |
|      +-- worktree.yaml         # Git worktree configuration   |
|      +-- .gitignore            # Git ignore rules             |
|      +-- .version              # Version number               |
|      +-- .developer            # Developer identity           |
|      +-- .current-task         # Current task pointer         |
|      +-- .template-hashes.json # Template file hashes         |
|      +-- workspace/            # Developer workspace          |
|      |   +-- <developer>/      # Individual space per dev     |
|      +-- tasks/                # Tasks directory              |
|      |   +-- archive/          # Archived tasks               |
+-------------------------------------------------------------+
|  .claude/                      # Claude Code configuration    |
|      +-- settings.json         # Claude Code settings         |
|      +-- agents/               # Sub-agent definitions        |
|      +-- commands/viben/       # Custom commands              |
|      +-- hooks/                # Hook scripts                 |
+-------------------------------------------------------------+
|  .cursor/ (optional)           # Cursor IDE configuration     |
|      +-- commands/             # Cursor commands              |
+-------------------------------------------------------------+
|  AGENTS.md                     # Root-level agent instructions|
+-------------------------------------------------------------+
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Developer** | Developer identifier, used to distinguish workspaces for different developers |
| **Project Type** | Project type (frontend/backend/fullstack), determines which spec files are generated |
| **Workspace** | Developer's independent workspace, contains logs and session records |
| **Task** | Task unit, contains task.json and prd.md |
| **Spec** | Project specification documents, guides AI agent behavior |

## Commands

### Initialize Team Workspace

```bash
# Initialize team workspace
viben team init --developer <name>
viben team init --developer john-doe

# Specify project type
viben team init --developer <name> --project-type <type>
viben team init --developer john-doe --project-type frontend
viben team init --developer john-doe --project-type backend
viben team init --developer john-doe --project-type fullstack  # Default

# Specify target directory
viben team init --developer <name> --target <path>
viben team init --developer john-doe --target /path/to/project

# Force overwrite existing files
viben team init --developer <name> --force

# Skip existing files
viben team init --developer <name> --skip-existing

# Exclude Cursor configuration
viben team init --developer <name> --no-cursor

# JSON output
viben team init --developer <name> --json
```

## Parameter Reference

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--developer, -d` | Yes | - | Developer name, lowercase alphanumeric with hyphens |
| `--project-type, -t` | - | `fullstack` | Project type: frontend, backend, fullstack |
| `--target` | - | `cwd` | Target directory path |
| `--force, -f` | - | `false` | Force overwrite existing files |
| `--skip-existing` | - | `false` | Skip existing files |
| `--no-cursor` | - | `false` | Do not create .cursor directory |
| `--json` | - | `false` | JSON format output |

## Developer Name Validation Rules

Developer names must follow these rules:
- Can only contain lowercase letters (a-z), digits (0-9), and hyphens (-)
- Cannot start or end with a hyphen
- Cannot be empty

**Valid examples:** `john`, `john-doe`, `dev123`, `my-agent-1`

**Invalid examples:** `John` (uppercase), `-invalid` (starts with hyphen), `invalid-` (ends with hyphen)

## Output Examples

**`viben team init --developer john-doe` (human-readable):**

```
Initialized Viben team workspace

Created directories:
  .viben/           Team workflow and workspace
  docs/specs/       Project specifications
  .claude/          Claude Code configuration
  .cursor/          Cursor IDE commands
  AGENTS.md         Root agent instructions

Developer: john-doe
Project type: fullstack

Next steps:
  1. Review .viben/tasks/00-bootstrap-guidelines/prd.md
  2. Fill in project-specific specs in docs/specs/
  3. Run /viben:start to begin your first session
```

**`viben team init --developer john-doe --json`:**

```json
{
  "success": true,
  "path": "/path/to/project",
  "files": [
    ".viben/workflow.md",
    ".viben/worktree.yaml",
    ".viben/.gitignore",
    ".viben/.version",
    ".viben/.developer",
    "docs/specs/guides/index.md",
    ".claude/settings.json",
    ".claude/agents/check.md",
    "AGENTS.md"
  ],
  "warnings": []
}
```

## Error Handling

### Directory Already Exists

```
Error: Directory already exists: /path/to/project/.viben

Use --force to overwrite or --skip-existing to skip
```

### Invalid Developer Name

```
Error: Invalid developer name "John-Doe"

Developer name must be lowercase alphanumeric with hyphens,
not starting or ending with hyphen.

Valid examples: john, john-doe, dev123
```

## Generated Directory Structure

### .viben/ Directory

```
.viben/
+-- workflow.md              # Workflow documentation
+-- worktree.yaml            # Git worktree configuration
+-- .gitignore               # Git ignore rules
+-- .version                 # Version number (1.0.0)
+-- .developer               # Developer identity info
+-- .current-task            # Current task path
+-- .template-hashes.json    # Template SHA256 hashes
|
+-- workspace/
|   +-- index.md             # Workspace index
|   +-- <developer>/
|       +-- index.md         # Developer index
|       +-- journal-1.md     # Session journal
|
+-- tasks/
|   +-- archive/             # Archived tasks
|   +-- 00-bootstrap-guidelines/
|       +-- task.json        # Task metadata
|       +-- prd.md           # Task requirements document
```

### docs/specs/ Directory

```
docs/specs/
+-- guides/              # General guides (always created)
|   +-- index.md
|   +-- cross-layer-thinking-guide.md
|   +-- code-reuse-thinking-guide.md
|
+-- backend/             # Backend specs (backend/fullstack)
|   +-- index.md
|   +-- directory-structure.md
|   +-- database-guidelines.md
|   +-- logging-guidelines.md
|   +-- quality-guidelines.md
|   +-- error-handling.md
|
+-- frontend/            # Frontend specs (frontend/fullstack)
    +-- index.md
    +-- directory-structure.md
    +-- type-safety.md
    +-- hook-guidelines.md
    +-- component-guidelines.md
    +-- quality-guidelines.md
    +-- state-management.md
```

### .claude/ Directory

```
.claude/
+-- settings.json            # Claude Code settings
|
+-- agents/                  # Sub-agents
|   +-- check.md
|   +-- fix.md
|   +-- work.md
|   +-- implement.md
|   +-- plan.md
|   +-- research.md
|
+-- commands/viben/          # Custom commands
|   +-- before-backend-dev.md
|   +-- before-frontend-dev.md
|   +-- break-loop.md
|   +-- check-backend.md
|   +-- check-cross-layer.md
|   +-- check-frontend.md
|   +-- create-command.md
|   +-- finish-work.md
|   +-- integrate-skill.md
|   +-- onboard.md
|   +-- record-session.md
|   +-- start.md
|   +-- task.md
|   +-- update-spec.md
|
+-- hooks/                   # Hook scripts (executable)
    +-- ralph-loop.py
    +-- session-start.py
```

### .cursor/ Directory (Optional)

```
.cursor/
+-- commands/
    +-- viben-before-backend-dev.md
    +-- viben-before-frontend-dev.md
    +-- viben-break-loop.md
    +-- viben-check-backend.md
    +-- viben-check-cross-layer.md
    +-- viben-check-frontend.md
    +-- viben-create-command.md
    +-- viben-finish-work.md
    +-- viben-integrate-skill.md
    +-- viben-onboard.md
    +-- viben-record-session.md
    +-- viben-start.md
    +-- viben-update-spec.md
```

## File Permissions

Hook script files (`.py`) are created with executable permissions (mode 0755).

## Template Hashes

`.viben/.template-hashes.json` stores SHA256 hashes of all template files, used for:
- Detecting if local files have been modified
- Determining if updates are needed during upgrades
- Conflict resolution

```json
{
  ".viben/workflow.md": "a1b2c3d4...",
  ".claude/settings.json": "e5f6g7h8...",
  ".claude/agents/check.md": "i9j0k1l2..."
}
```

## Related Commands

- [viben init](./init) - Basic workspace initialization
- [viben workspace](./workspace) - Workspace operations
- [viben agent](./agent) - Agent management
