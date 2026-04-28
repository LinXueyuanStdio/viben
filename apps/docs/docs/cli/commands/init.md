---
sidebar_position: 2
title: "viben init"
description: "Initialize a Viben workspace with AI-assisted development environment"
---

# viben init

Initialize a Viben workspace with a complete AI-assisted development environment.

## Usage

```bash
viben init [options] [target-dir]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--user, -u` | Developer name (lowercase alphanumeric with hyphens) | Auto-detected from `git config user.name` |
| `--executor, -e` | AI executor type (repeatable for multiple executors) | `CURSOR,CLAUDE_CODE` |
| `--yes, -y` | Non-interactive mode, use default values | `false` |
| `--force, -f` | Force overwrite existing files | `false` |
| `--skip-existing, -s` | Skip existing files | `false` |
| `--from <template>` | Initialize from a template | - |
| `--json` | JSON format output | `false` |

### Supported Executors

| Executor | Description | Config Directory |
|----------|-------------|------------------|
| `CLAUDE_CODE` | Claude Code (Anthropic) | `.claude/` |
| `CURSOR` | Cursor IDE | `.cursor/` |
| `GEMINI` | Gemini CLI (Google) | `.gemini/` |
| `CODEX` | Codex CLI (OpenAI) | `.agents/skills/` |
| `OPENCODE` | OpenCode | `.opencode/` |
| `IFLOW` | iFlow CLI | `.iflow/` |
| `KILO` | Kilo CLI | `.kilocode/` |
| `KIRO` | Kiro Code | `.kiro/skills/` |
| `ANTIGRAVITY` | Antigravity | `.agent/workflows/` |

## Examples

### Basic Initialization

Initialize a workspace with default executors (CURSOR + CLAUDE_CODE):

```bash
viben init --user <name>
viben init --user john-doe
```

**Output (Human-readable):**

```
Initializing Viben workspace...
  Target: /path/to/project
  Developer: john-doe
  Executors: CURSOR, CLAUDE_CODE

Workspace initialized successfully!

Created 97 files:
  .viben/     - Workflow files and workspace
  docs/specs/ - Project specifications
  .claude     - Claude Code configuration
  .cursor     - Cursor configuration
  AGENTS.md   - Root instructions file

Next steps:
  1. Review and customize docs/specs/ guidelines
  2. Run viben task context <task> to verify setup
  3. Start developing with AI assistance!
```

### Specify Executors

```bash
# Single executor
viben init --user john-doe --executor CLAUDE_CODE
viben init --user john-doe --executor CURSOR

# Multiple executors (repeat --executor flag)
viben init --user john-doe --executor CLAUDE_CODE --executor CURSOR
viben init --user john-doe -e CLAUDE_CODE -e GEMINI -e CURSOR
```

### Non-Interactive Mode

```bash
# Use defaults without prompts
viben init --user john-doe --yes
viben init --user john-doe -y
```

### Force Overwrite

```bash
# Force overwrite existing files
viben init --user john-doe --force
```

### Other Options

```bash
# Specify target directory
viben init --user john-doe ./my-project

# Skip existing files
viben init --user john-doe --skip-existing

# JSON output
viben init --user john-doe --json
```

**Output (JSON):**

```bash
viben init --user john-doe --json
```

```json
{
  "success": true,
  "data": {
    "path": "/path/to/project",
    "files": [
      ".viben/config.yaml",
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
    "count": 97,
    "warnings": []
  }
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

### .viben/ Directory

```
.viben/
+-- config.yaml              # Workspace configuration
+-- workflow.md              # Workflow documentation
+-- worktree.yaml            # Git worktree configuration
+-- .gitignore               # Git ignore rules
+-- .version                 # Version number (1.0.0)
+-- .developer               # Developer identity info
+-- .template-hashes.json    # Template SHA256 hashes
|
+-- workspace/
|   +-- index.md             # Workspace index
|   +-- <developer>/
|       +-- index.md         # Developer index
|       +-- journal-1.md     # Session journal
|
+-- ideas/                   # Generated ideas (from viben idea generate)
|
+-- tasks/
    +-- archive/             # Archived tasks
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

### docs/idea-types/ Directory

Idea type templates used by `viben idea generate` and `viben evo generate-ideas`:

```
docs/idea-types/
+-- code_improvements.md
+-- code_quality.md
+-- documentation_gaps.md
+-- performance_optimizations.md
+-- security_hardening.md
+-- ui_ux_improvements.md
```

### docs/reward-types/ Directory

Reward type definitions used by `viben evo compute-reward`:

```
docs/reward-types/
+-- code_correctness.md
+-- code_quality.md
+-- documentation.md
+-- performance.md
+-- security.md
+-- test_coverage.md
```

### .claude/ Directory

Created when `CLAUDE_CODE` executor is selected:

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
    +-- break-loop.md
    +-- create-command.md
    +-- finish-work.md
    +-- integrate-skill.md
    +-- onboard.md
    +-- record-session.md
    +-- start.md
    +-- task.md
    +-- update-spec.md
```

### .cursor/ Directory

Created when `CURSOR` executor is selected:

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

### AGENTS.md

Root-level agent instruction file, read by AI agents for project-level instructions.

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

### Invalid Executor

```
Error: Invalid executor "INVALID".

Valid executors:
  CLAUDE_CODE, CURSOR, GEMINI, CODEX, OPENCODE, IFLOW, KILO, KIRO, ANTIGRAVITY
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
