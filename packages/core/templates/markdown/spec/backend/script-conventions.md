# CLI Conventions

> Standards for Viben CLI commands that manage the `.viben/` workflow directory.

---

## Overview

All workflow operations are now available through the `viben` CLI, implemented in TypeScript in `packages/core`. This replaces the previous shell scripts (`.trellis/scripts/`) for better cross-platform support and integration with the Viben ecosystem.

---

## CLI Command Structure

```
viben
├── user                  # User/developer management
│   ├── init <name>       # Initialize developer identity
│   ├── get               # Get current developer name
│   └── status            # Show user status and workspace info
├── task                  # Task management
│   ├── list              # List active tasks
│   ├── create            # Create new task
│   ├── view              # View task details
│   ├── edit              # Edit task
│   ├── delete            # Delete task
│   ├── start             # Set current task
│   ├── finish            # Clear current task
│   ├── archive           # Archive completed task
│   ├── list-archive      # List archived tasks
│   ├── set-branch        # Set Git branch for task
│   ├── set-base          # Set PR target branch
│   ├── set-scope         # Set scope for PR title
│   ├── set-agent         # Set associated agent
│   ├── init-context      # Initialize context files
│   ├── add-context       # Add context files
│   ├── remove-context    # Remove context files
│   ├── list-context      # List context entries
│   ├── validate-context  # Validate context files
│   ├── context           # Get session context
│   ├── add-session       # Record session
│   ├── plan              # Start plan agent
│   ├── status            # Show task status
│   └── create-pr         # Create PR from task
└── swarm                 # Multi-agent operations
    ├── list              # List all worktrees and agents
    ├── start             # Start worktree agent
    ├── stop              # Stop running agent
    ├── status            # Monitor agent status
    ├── registry          # Show agent registry
    └── cleanup           # Cleanup worktree
```

---

## Common Commands

### User Management

```bash
# Initialize developer identity (first time only)
viben user init <your-name>

# Get current developer name
viben user get
```

### Task Management

```bash
# Create new task
viben task create "<title>" [--slug <name>]

# List active tasks
viben task list [--mine] [--status <status>]

# View task details
viben task view <task>

# Start working on a task
viben task start <task>

# Finish current task
viben task finish

# Archive completed task
viben task archive <task>

# List archived tasks
viben task list-archive [month]
```

### Context Management

```bash
# Get session context
viben task context [--json]

# Initialize context files for task
viben task init-context <task> -t <type>

# Add context files
viben task add-context <task> <files...> [-r <reason>]

# List context entries
viben task list-context <task>

# Validate context files
viben task validate-context <task>
```

### Session Recording

```bash
# Record session
viben task add-session \
  --title "Session Title" \
  --commit "abc1234" \
  --summary "Brief summary"
```

### Multi-Agent Operations

```bash
# Start worktree agent
viben swarm start <task> [--platform <platform>]

# Monitor agent status
viben swarm status [<task>] [--detail] [--watch]

# Cleanup worktree
viben swarm cleanup <task>

# Create PR from task
viben task create-pr [<task>] [--dry-run]

# Start plan agent
viben task plan -n <name> -t <type> -r "<requirement>"
```

---

## Output Formats

### JSON Output

Most commands support `--json` flag for machine-readable output:

```bash
viben task list --json
viben task context --json
viben task view <task> --json
```

### Verbose Output

Use `--verbose` for detailed output during debugging:

```bash
viben task create "My Task" --verbose
viben swarm start my-task --verbose
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Usage error (wrong arguments) |

---

## Error Handling

Errors are printed to stderr with context:

```
Error: Not a Viben workspace (.viben not found). Run "viben team init" first.
Error: Task "nonexistent" not found
Error: No developer set. Run "viben user init" first or use --assignee
```

---

## Migration from Shell Scripts

> **Recommendation**: Use `viben` CLI commands instead of shell scripts for better cross-platform support, consistent output formatting, and error handling.

The following shell script calls have been replaced by CLI commands:

### User Management

| Old (Shell Script) | New (CLI) |
|--------------------|-----------|
| `./.trellis/scripts/init-developer.sh <name>` | `viben user init <name>` |
| `./.trellis/scripts/get-developer.sh` | `viben user get` |

### Context & Session

| Old (Shell Script) | New (CLI) |
|--------------------|-----------|
| `./.trellis/scripts/get-context.sh` | `viben task context` |
| `./.trellis/scripts/get-context.sh --json` | `viben task context --json` |
| `./.trellis/scripts/add-session.sh ...` | `viben task add-session ...` |

### Task Management

| Old (Shell Script) | New (CLI) |
|--------------------|-----------|
| `./.trellis/scripts/task.sh create "<title>"` | `viben task create "<title>"` |
| `./.trellis/scripts/task.sh list` | `viben task list` |
| `./.trellis/scripts/task.sh start <task>` | `viben task start <task>` |
| `./.trellis/scripts/task.sh finish` | `viben task finish` |
| `./.trellis/scripts/task.sh archive <task>` | `viben task archive <task>` |
| `./.trellis/scripts/task.sh list-archive [month]` | `viben task list-archive [month]` |
| `./.trellis/scripts/task.sh set-branch <task> <branch>` | `viben task set-branch <task> <branch>` |
| `./.trellis/scripts/task.sh set-scope <task> <scope>` | `viben task set-scope <task> <scope>` |
| `./.trellis/scripts/task.sh create-pr [task]` | `viben task create-pr [task]` |

### Context Files Management

| Old (Shell Script) | New (CLI) |
|--------------------|-----------|
| `./.trellis/scripts/task.sh init-context <task> <type>` | `viben task init-context <task> -t <type>` |
| `./.trellis/scripts/task.sh add-context <task> <file> ...` | `viben task add-context <task> <files...>` |
| `./.trellis/scripts/task.sh list-context <task>` | `viben task list-context <task>` |
| `./.trellis/scripts/task.sh validate <task>` | `viben task validate-context <task>` |

### Multi-Agent / Swarm Operations

| Old (Shell Script) | New (CLI) |
|--------------------|-----------|
| `./.trellis/scripts/multi-agent/start.sh <task>` | `viben swarm start <task>` |
| `./.trellis/scripts/multi-agent/status.sh` | `viben swarm status` |
| `./.trellis/scripts/multi-agent/status.sh <task> --detail` | `viben swarm status <task> --detail` |
| `./.trellis/scripts/multi-agent/cleanup.sh <task>` | `viben swarm cleanup <task>` |
| `./.trellis/scripts/multi-agent/plan.sh ...` | `viben task plan ...` |
| `./.trellis/scripts/multi-agent/create-pr.sh` | `viben task create-pr` |

### Additional Swarm Commands (CLI only)

| Command | Description |
|---------|-------------|
| `viben swarm list` | List all worktrees and registered agents |
| `viben swarm stop <task>` | Stop a running agent |
| `viben swarm stop --all` | Stop all running agents |
| `viben swarm registry` | Show agent registry |

### Additional User Commands (CLI only)

| Command | Description |
|---------|-------------|
| `viben user status` | Show user status and workspace info |

---

## DO / DON'T

### DO

- Use `viben` CLI commands for all workflow operations
- Use `--json` flag for scripting and automation
- Use `--verbose` for debugging
- Check exit codes for error handling in scripts

### DON'T

- Don't rely on shell scripts (deprecated, use CLI instead)
- Don't modify `.viben/` or `.trellis/` files directly (use CLI commands)
- Don't hardcode paths - use CLI to get information

---

## Implementation Reference

The CLI is implemented in TypeScript:

- Main entry: `packages/core/src/cli/index.ts`
- Task commands: `packages/core/src/cli/commands/task.ts`
- Swarm commands: `packages/core/src/cli/commands/swarm.ts`
- User commands: `packages/core/src/cli/commands/user.ts`
- Workspace utilities: `packages/core/src/cli/lib/viben-workspace.ts`

---

## Historical Note

> **Migration History**: Workflow scripts were originally implemented in Bash shell scripts (`.trellis/scripts/`). As of v0.5.0, all workflow operations have been migrated to the TypeScript CLI (`viben` command) for better cross-platform support, consistent JSON output, and integration with the Viben ecosystem. The shell scripts remain available for backward compatibility but are deprecated.
