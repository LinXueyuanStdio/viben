# CLI Conventions

> Standards for Viben CLI commands that manage the `.viben/` workflow directory.

---

## Overview

All workflow operations are now available through the `viben` CLI, implemented in TypeScript in `packages/core`. This replaces the previous Python scripts for better integration with the Viben ecosystem.

---

## CLI Command Structure

```
viben
├── user                  # User/developer management
│   ├── init <name>       # Initialize developer identity
│   └── get               # Get current developer name
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
    ├── start             # Start worktree agent
    ├── status            # Monitor agent status
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

## Migration from Python Scripts

The following Python script calls have been replaced:

| Old (Python) | New (CLI) |
|--------------|-----------|
| `python3 ./.viben/scripts/get_context.py` | `viben task context` |
| `python3 ./.viben/scripts/task.py create ...` | `viben task create ...` |
| `python3 ./.viben/scripts/task.py list` | `viben task list` |
| `python3 ./.viben/scripts/add_session.py ...` | `viben task add-session ...` |
| `python3 ./.viben/scripts/init_developer.py <name>` | `viben user init <name>` |
| `python3 ./.viben/scripts/get_developer.py` | `viben user get` |
| `python3 ./.viben/scripts/multi_agent/start.py ...` | `viben swarm start ...` |
| `python3 ./.viben/scripts/multi_agent/status.py` | `viben swarm status` |
| `python3 ./.viben/scripts/multi_agent/cleanup.py ...` | `viben swarm cleanup ...` |
| `python3 ./.viben/scripts/multi_agent/plan.py ...` | `viben task plan ...` |
| `python3 ./.viben/scripts/multi_agent/create_pr.py` | `viben task create-pr` |

---

## DO / DON'T

### DO

- Use `viben` CLI commands for all workflow operations
- Use `--json` flag for scripting and automation
- Use `--verbose` for debugging
- Check exit codes for error handling in scripts

### DON'T

- Don't rely on Python scripts (deprecated)
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

---

## Historical Note

> **Migration History**: Scripts were originally implemented in Bash, then migrated to Python in v0.3.0 for cross-platform compatibility. As of v0.5.0, all workflow operations have been migrated to the TypeScript CLI for better integration with the Viben ecosystem.
