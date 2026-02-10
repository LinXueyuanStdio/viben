# Parallel Development

Coordinate parallel development using multiple AI agents or git worktrees.

## Overview

Parallel development allows multiple tasks to be worked on simultaneously using:
- **Git Worktrees**: Separate working directories for different branches
- **Multi-Agent Pipeline**: Multiple AI agents working on related tasks

## Git Worktree Mode

### Setup Worktree

```bash
# Create a new worktree for a feature branch
git worktree add ../project-feature-name feature/feature-name

# List all worktrees
git worktree list
```

### Manage Worktrees

```bash
# Remove a worktree after merging
git worktree remove ../project-feature-name

# Prune stale worktree information
git worktree prune
```

## Multi-Agent Mode

### Start Multi-Agent Session

```bash
# Start the multi-agent orchestrator
./.viben/scripts/multi-agent/start.sh
```

### Check Status

```bash
# View agent status
./.viben/scripts/multi-agent/status.sh
```

### Cleanup

```bash
# Clean up multi-agent session
./.viben/scripts/multi-agent/cleanup.sh
```

## Best Practices

1. **Clear Task Boundaries**: Each parallel task should be independent
2. **Regular Sync**: Sync worktrees regularly to avoid conflicts
3. **Communication**: Use task.json and journal files to communicate progress
4. **Merge Strategy**: Use feature branches and PRs for clean integration

---

## Configuration

See `.viben/worktree.yaml` for worktree configuration options.
