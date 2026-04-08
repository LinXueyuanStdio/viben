---
sidebar_position: 2
title: "viben init"
description: "Initialize a Viben workspace with team collaboration support"
---

# viben init

Initialize a Viben workspace with team collaboration support.

## Usage

```bash
viben init [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--developer, -d` | Developer name (lowercase alphanumeric with hyphens) | - |
| `--project-type, -t` | Project type: frontend, backend, fullstack | `fullstack` |
| `--target` | Target directory path | Current directory |
| `--force, -f` | Force overwrite existing files | `false` |
| `--skip-existing` | Skip existing files | `false` |
| `--no-cursor` | Do not create .cursor directory | `false` |
| `--from <template>` | Initialize from a template | - |
| `--json` | JSON format output | `false` |

## Examples

### Basic Initialization

Create a new workspace with default configuration:

```bash
viben init
```

**Output (Human-readable):**

```
Initialized Viben workspace in /path/to/project
  Created .viben/config.yaml

Next steps:
  viben mcp install <name>    # Install MCP servers
  viben skill install <name>  # Install skills
```

### Team Workspace Initialization

Initialize a full team workspace with developer identity:

```bash
# Initialize team workspace
viben init --developer <name>
viben init --developer john-doe

# Specify project type
viben init --developer <name> --project-type <type>
viben init --developer john-doe --project-type frontend
viben init --developer john-doe --project-type backend
viben init --developer john-doe --project-type fullstack  # Default

# Specify target directory
viben init --developer <name> --target <path>
viben init --developer john-doe --target /path/to/project

# Force overwrite existing files
viben init --developer <name> --force

# Skip existing files
viben init --developer <name> --skip-existing

# Exclude Cursor configuration
viben init --developer <name> --no-cursor

# JSON output
viben init --developer <name> --json
```

**Output (Human-readable):**

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

**Output (JSON):**

```bash
viben init --developer john-doe --json
```

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

### Initialize from Template

Create a workspace from a predefined template:

```bash
viben init --from my-template
```

## Developer Name Validation Rules

Developer names must follow these rules:
- Can only contain lowercase letters (a-z), digits (0-9), and hyphens (-)
- Cannot start or end with a hyphen
- Cannot be empty

**Valid examples:** `john`, `john-doe`, `dev123`, `my-agent-1`

**Invalid examples:** `John` (uppercase), `-invalid` (starts with hyphen), `invalid-` (ends with hyphen)

## What Gets Created

### Basic Initialization (without --developer)

```
<project>/
  .viben/
    config.yaml       # Workspace configuration
```

### Team Workspace (with --developer)

#### .viben/ Directory

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

#### docs/specs/ Directory

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

#### .claude/ Directory

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
|   +-- break-loop.md
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

#### .cursor/ Directory (Optional)

```
.cursor/
+-- commands/
    +-- viben-break-loop.md
    +-- viben-create-command.md
    +-- viben-finish-work.md
    +-- viben-integrate-skill.md
    +-- viben-onboard.md
    +-- viben-record-session.md
    +-- viben-start.md
    +-- viben-update-spec.md
```

## Error Handling

### Workspace Already Exists

```bash
viben init
```

```
Error: Workspace already initialized at /path/to/project/.viben
```

JSON Output:

```json
{
  "success": false,
  "error": {
    "code": "WORKSPACE_EXISTS",
    "message": "Workspace already initialized at /path/to/project/.viben"
  }
}
```

### Directory Already Exists (Team Mode)

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

### Permission Denied

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Cannot create .viben directory: permission denied"
  }
}
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

- [viben workspace](./workspace) - Workspace operations
- [viben config](./config) - Configuration management
- [viben mcp](./mcp) - MCP server management
- [viben agent](./agent) - Agent management
