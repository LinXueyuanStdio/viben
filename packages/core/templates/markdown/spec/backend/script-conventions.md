# CLI Conventions

> Standards for Viben CLI commands that manage the `.viben/` workflow directory.

---

## Overview

All workflow operations are available through the `viben` CLI, implemented in TypeScript in `packages/core`. The CLI provides cross-platform support, consistent output formatting, and integration with the Viben ecosystem.

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
│   ├── finish <task>     # Finish specified task
│   ├── archive           # Archive completed task
│   ├── list-archive      # List archived tasks
│   ├── set-branch        # Set Git branch for task
│   ├── set-base          # Set PR target branch
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

# Show user status and workspace info
viben user status
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

# Finish specified task
viben task finish <task>

# Archive completed task
viben task archive <task>

# List archived tasks
viben task list-archive [month]
```

### Context Management

```bash
# Get session context for specified task
viben task context <task> [--json]

# Initialize empty context files for task
viben task init-context <task>

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
# Start task (complete workflow: plan → work → report)
viben task start <task>

# Run work phase only (requires prd.md exists)
viben task work-phase <task>

# Run plan phase only
viben task plan-phase <task>

# Monitor agent status
viben swarm status [<task>] [--detail] [--watch]

# List all worktrees and agents
viben swarm list

# Stop a running agent
viben swarm stop <task>

# Cleanup worktree
viben swarm cleanup <task>

# Show agent registry
viben swarm registry

# Create PR from task
viben task create-pr [<task>] [--dry-run]
```

> ⚠️ **Note**: `viben swarm start` is deprecated. Use `viben task start` for complete workflow or `viben task work-phase` for work phase only.

---

## Output Formats

### JSON Output

Most commands support `--json` flag for machine-readable output:

```bash
viben task list --json
viben task context <task> --json
viben task view <task> --json
```

### Verbose Output

Use `--verbose` for detailed output during debugging:

```bash
viben task create "My Task" --verbose
viben task start my-task --verbose
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

## DO / DON'T

### DO

- Use `viben` CLI commands for all workflow operations
- Use `--json` flag for scripting and automation
- Use `--verbose` for debugging
- Check exit codes for error handling in scripts

### DON'T

- Don't modify `.viben/` files directly (use CLI commands)
- Don't hardcode paths - use CLI to get information

---

## Implementation Reference

The CLI is implemented in TypeScript:

- Main entry: `packages/core/src/cli/index.ts`
- Task commands: `packages/core/src/cli/commands/task.ts`
- Swarm commands: `packages/core/src/cli/commands/swarm.ts`
- User commands: `packages/core/src/cli/commands/user.ts`
- Workspace utilities: `packages/core/src/cli/lib/viben-workspace.ts`
