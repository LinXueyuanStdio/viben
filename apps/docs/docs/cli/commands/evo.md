---
sidebar_position: 24
title: "viben filerl"
description: "File-based Reinforcement Learning command for code optimization using PPO algorithm"
---

# viben filerl

File-based Reinforcement Learning command for code optimization.

## Overview

The `viben filerl` command manages the FileRL workflow, treating codebases as "model parameters" and using the PPO algorithm to iteratively optimize code quality. It generates improvement ideas, converts them to tasks, evaluates results, and selects the best outcomes.

## Command Structure

```bash
viben filerl <subcommand> [options]
```

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new FileRL target file |
| `start` | Start a FileRL run |
| `status` | View FileRL run status |
| `list` | List all FileRL runs |
| `stop` | Stop an active FileRL run |
| `resume` | Resume a paused FileRL run |
| `add-idea` | Add idea file to target's idea pool |
| `list-ideas` | List ideas in target's idea pool |
| `generate-ideas` | Generate ideas for an iteration |
| `promote-ideas` | Convert ideas to tasks |
| `compute-reward` | Compute reward for tasks |
| `select` | Select best task using PPO metrics |

## Target File Management

### Create Target

Create a new FileRL target file.

```bash
viben filerl create <name> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `-d, --description <text>` | Target description |
| `-o, --output <path>` | Output path, default `<name>.md` |
| `--json` | JSON format output |

**Examples**:

```bash
viben filerl create my-optimization
viben filerl create code-quality -d "Optimize code quality"
```

## Run Management

### Start Run

Start a FileRL run.

```bash
viben filerl start <name-or-target> [options]
```

**Parameters**:
- `<name-or-target>` - FileRL run name or target file path (*.md)

**Options**:

| Option | Description |
|--------|-------------|
| `--force` | Force restart even if run is active |
| `--dry-run` | Validate configuration only, don't actually run |
| `--json` | JSON format output |

**Examples**:

```bash
# Start using target file
viben filerl start target.md

# Start using run name (resume existing run)
viben filerl start my-optimization

# Validate configuration
viben filerl start target.md --dry-run
```

### View Status

View FileRL run status.

```bash
viben filerl status <name> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

**Examples**:

```bash
viben filerl status my-optimization
viben filerl status my-optimization --json
```

### List Runs

List all FileRL runs.

```bash
viben filerl list [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

### Stop Run

Stop an active FileRL run.

```bash
viben filerl stop <name> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

### Resume Run

Resume a paused FileRL run.

```bash
viben filerl resume <name-or-target> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

## Idea Management

### Add Idea

Add idea file to FileRL target's idea pool.

```bash
viben filerl add-idea <name-or-target> <idea-path> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

### List Ideas

List ideas in FileRL target's idea pool.

```bash
viben filerl list-ideas <name-or-target> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--json` | JSON format output |

### Generate Ideas

Generate ideas for a FileRL run's iteration.

```bash
viben filerl generate-ideas <name> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--iter <N>` | Target iteration, default uses current iteration from state.json |
| `--types <types...>` | Idea types to generate (e.g., code_improvements, refactoring) |
| `--json` | JSON format output |

**Examples**:

```bash
# Generate ideas for current iteration
viben filerl generate-ideas my-optimization --types code_improvements

# Generate ideas for specific iteration
viben filerl generate-ideas my-optimization --iter 2 --types refactoring performance
```

**Output Directory**: `.viben/filerl/<name>/iter{N}/<idea-id>/idea.md`

### Promote Ideas

Convert ideas to tasks. Supports all `viben task create` options.

```bash
viben filerl promote-ideas <name> [options]
```

**Options**:

| Option | Description | Default |
|--------|-------------|---------|
| `--iter <N>` | Iteration number | Current iteration from state.json |
| `--ideas <idea...>` | Idea IDs to promote | Required |
| `-s, --slug <name>` | Task identifier | Generated from idea title |
| `-b, --branch <branch>` | Custom branch name | `feature/<slug>` |
| `-a, --assignee <dev>` | Assign to | Current developer |
| `-p, --priority <priority>` | Priority (P0-P3) | Mapped from effort |
| `-d, --description <text>` | Task description | Idea's description |
| `--agent <agent-id>` | Associated agent configuration | - |
| `--executor <type>` | Executor type | Target config |
| `--model <model>` | Model to use | Target config |
| `--start` | Automatically start task after promote | false |
| `--worktree` | Run in git worktree | Target config |
| `--json` | JSON format output | false |

**Executor Types**: `CLAUDE_CODE`, `CURSOR`, `GEMINI`, `OPENCODE`, `IFLOW`, `CODEX`, `KILO`, `KIRO`, `ANTIGRAVITY`

**Effort to Priority Default Mapping**:

| Effort | Priority |
|--------|----------|
| trivial | P3 |
| small | P3 |
| medium | P2 |
| large | P1 |
| complex | P1 |

**Examples**:

```bash
# Convert idea to task (simplest)
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4

# Batch promote multiple ideas
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 po-e5f6g7h8

# Promote for specific iteration
viben filerl promote-ideas my-optimization --iter 2 --ideas po-a1b2c3d4

# Create and automatically start task
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# Develop in isolated worktree
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 --worktree --start

# Full example with executor and model
viben filerl promote-ideas my-optimization \
  --ideas po-a1b2c3d4 \
  --executor CLAUDE_CODE \
  --model opus \
  --start
```

**Execution Flow**:

1. Read specified idea's `idea.md` file
2. Create task for each idea (using target config or command-line options)
3. Update state.json's `task_idea_map`
4. If `--start` is specified, start task execution

## Reward Computation and Selection

### Compute Reward

Compute reward for tasks in a FileRL run.

```bash
viben filerl compute-reward <name> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--iter <N>` | Iteration number, default uses current iteration |
| `--idea <idea>` | Idea ID |
| `--task <task>` | Task name |
| `-p, --platform <platform>` | Platform (claude, cursor, iflow, opencode), default claude |
| `-v, --verbose` | Verbose output |
| `--json` | JSON format output |

**Examples**:

```bash
# Compute reward for specific idea's task
viben filerl compute-reward my-optimization --idea idea-001

# Compute reward for specific task in iteration
viben filerl compute-reward my-optimization --iter 2 --task 03-27-fix-bug
```

**Output Files**:
- Reward result: `.viben/filerl/<name>/iter{N}/<idea>/<task>/reward.json`
- Agent execution log: `.viben/filerl/<name>/iter{N}/<idea>/<task>/reward.log.jsonl`

**Reward Format**:

```json
{
  "total_score": 0.825,
  "diff_lines": 50,
  "scores": {
    "code_quality": { "score": 0.85, "reasoning": "..." },
    "agent_review": { "score": 0.80, "reasoning": "..." }
  },
  "computed_at": "2026-03-27T10:30:00Z"
}
```

### Select Best Task

Select best task from a FileRL run using PPO metrics.

```bash
viben filerl select <name> [options]
```

**Options**:

| Option | Description |
|--------|-------------|
| `--iter <N>` | Iteration number, default uses current iteration |
| `--idea <idea>` | Filter by specific idea ID |
| `--tasks <tasks...>` | Specify tasks to compare, default uses all tasks in iteration |
| `--threshold <number>` | Minimum adjusted reward threshold, default 0.6 |
| `--kl-coef <number>` | KL penalty coefficient, default 0.05 |
| `--max-diff <number>` | Maximum diff lines for KL normalization, default 500 |
| `--json` | JSON format output |

**Examples**:

```bash
# Select best task from current iteration
viben filerl select my-optimization

# Select from specific iteration
viben filerl select my-optimization --iter 2

# Only consider tasks for specific idea
viben filerl select my-optimization --idea idea-001

# Custom thresholds
viben filerl select my-optimization --threshold 0.7 --kl-coef 0.1
```

**PPO Selection Algorithm**:

1. **Calculate adjusted reward**: `adjusted = reward - kl_coef * min(1, diff_lines / max_diff)`
2. **Calculate baseline**: Average of all adjusted rewards
3. **Two-phase selection**:
   - Phase 1: Select highest finalScore rollout for each idea
   - Phase 2: Select global best from idea winners (must exceed threshold)

**Output Example**:

```
PPO Selection Results
=====================

Run: my-optimization | Iteration: 1
Baseline: 0.723 | Threshold: 0.6

TASK      REWARD  DIFF  KL     ADJUSTED  RELATIVE  FINAL   STATUS
task-a    0.858   120   0.012  0.846     +0.123    0.121   SELECTED
task-b    0.721   450   0.045  0.676     -0.047    -0.046  rejected

Selected: task-a
```

## Iteration Phase State Machine

FileRL tracks progress through phases for each iteration, supporting resumption after interruption:

```
init -> generate_ideas -> promote_ideas -> execute_tasks ->
       wait_tasks -> compute_rewards -> select_best -> merge_cleanup -> completed
```

| Phase | Description |
|-------|-------------|
| `init` | Just started, no work done |
| `generate_ideas` | Phase 1: Generate ideas |
| `promote_ideas` | Phase 2: Convert ideas to tasks |
| `execute_tasks` | Phase 2.5: Start task executors |
| `wait_tasks` | Phase 3: Wait for tasks to complete |
| `compute_rewards` | Phase 4: Compute rewards |
| `select_best` | Phase 5: PPO selection of best candidate |
| `merge_cleanup` | Phase 6: Merge winner, cleanup losers |
| `completed` | Iteration complete |

## Target Configuration

FileRL configuration is defined in the target.md file's YAML frontmatter:

```yaml
---
name: my-optimization
description: Optimize API response time

idea:
  auto_generate: false          # Auto-generate ideas
  types: [performance_optimizations]
  max_ideas: 5
  batch_size: 3                 # Max ideas per iteration
  effort_filter: [trivial, small, medium]  # Optional: filter by effort

rollout:
  n: 1                          # Execute N times per idea
  worktree: true                # Use worktree isolation

ppo:
  kl_coef: 0.05                 # Change penalty coefficient
  change_sensitivity: 2.0       # Change penalty sensitivity
  clip_range: 0.2               # Weight clipping parameter
  quality_threshold: 0.6        # Quality threshold
  max_diff: 500                 # Maximum diff lines

convergence:
  threshold: 0.01               # Convergence threshold
  max_iterations: 50
  no_merge_limit: 5             # Max consecutive no-merge iterations

reward:
  types: [test_coverage, code_quality, agent_review]
  weights: [0.34, 0.33, 0.33]

task:
  executor: CLAUDE_CODE
  model: sonnet

enabled: true
---

# My Optimization Target

Optimization target description...
```

## Directory Structure

```
.viben/filerl/<run-name>/
├── state.json                      # FileRL state
└── iter{N}/                        # Iteration N
    └── <idea-id>/                  # Idea directory
        ├── idea.md                 # Idea definition
        └── <task-name>/            # Rollout task
            ├── reward.json         # Reward result
            └── reward.log.jsonl    # Reward agent execution log
```

### state.json Structure

```json
{
  "name": "my-optimization",
  "target_path": "/path/to/target.md",
  "current_iteration": 3,
  "completed_iterations": 2,
  "iterations": [
    {
      "iteration": 1,
      "phase": "completed",
      "ideas": ["po-a1b2c3d4"],
      "tasks": ["03-20-task-a"],
      "task_idea_map": { "03-20-task-a": "po-a1b2c3d4" },
      "rewards": { "03-20-task-a": 0.846 },
      "selected_task": "03-20-task-a",
      "rejected_tasks": [],
      "completed": true,
      "started_at": "...",
      "completed_at": "..."
    }
  ],
  "best_reward": 0.846,
  "best_task": "03-20-task-a",
  "no_merge_count": 0,
  "converged": false,
  "active": true,
  "started_at": "...",
  "updated_at": "..."
}
```

## Complete Workflow Example

```bash
# 1. Create target file
viben filerl create my-optimization -d "Optimize code quality"

# 2. Start FileRL loop
viben filerl start my-optimization.md

# 3. Generate ideas (in iter1/)
viben filerl generate-ideas my-optimization --types code_improvements

# 4. View generated ideas
viben filerl list-ideas my-optimization

# 5. Convert ideas to tasks and start
viben filerl promote-ideas my-optimization --ideas po-a1b2c3d4 --start

# 6. View status
viben filerl status my-optimization

# 7. Monitor task execution
viben swarm status --watch

# 8. Compute rewards
viben filerl compute-reward my-optimization --iter 1

# 9. Select best candidate
viben filerl select my-optimization

# 10. Merge winner, cleanup loser
viben task approve <winner-task>
viben task cleanup <loser-task>
```

## Related Commands

- [viben task](./task) - Task management command
- [viben idea](./idea) - Idea generation command
- [viben swarm](./swarm) - Agent swarm scheduling
- [viben queue](./queue) - Command queue management
