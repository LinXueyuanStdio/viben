---
sidebar_position: 19
title: "viben update"
description: "Update Viben workspace components (template files)"
---

# viben update

Update Viben workspace components (template files) or self-update Viben.

## Overview

`viben update` is used to update template files in your workspace, including:
- `docs/idea-types/` - Idea type templates (used by `viben idea generate`)
- `docs/reward-types/` - Reward type templates (used by `viben reward`)

These template files improve with Viben version updates. Use this command to get the latest versions. When run without workspace template flags, `viben update` performs a self-update of the Viben CLI. You can also use `--check` to check for available updates without applying them.

---

## Command

```bash
# Self-update Viben
viben update

# Check whether an update is available
viben update --check
# Update idea-types templates
viben update --idea-types

# Update reward-types templates
viben update --reward-types

# Update both
viben update --idea-types --reward-types

# Specify target directory
viben update --idea-types <target-dir>
viben update --idea-types ./my-project

# Force overwrite existing files
viben update --idea-types --force

# Skip existing files
viben update --idea-types --skip-existing

# JSON output
viben update --idea-types --json
```

---

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--idea-types` | * | - | Update docs/idea-types/ templates |
| `--reward-types` | * | - | Update docs/reward-types/ templates |
| `[target-dir]` | - | `.` (current directory) | Target directory path |
| `--force, -f` | - | `false` | Force overwrite existing files |
| `--skip-existing, -s` | - | `false` | Skip files that already exist |
| `--json` | - | `false` | JSON format output |

*At least one update option (`--idea-types` or `--reward-types`) is required.

---

## Updated Files

### docs/idea-types/

Idea type templates for `viben idea generate` command:

```
docs/idea-types/
├── code_improvements.md        # Code improvement suggestions
├── code_quality.md             # Code quality improvements
├── documentation_gaps.md       # Documentation gap discovery
├── performance_optimizations.md # Performance optimization suggestions
├── security_hardening.md       # Security hardening suggestions
└── ui_ux_improvements.md       # UI/UX improvement suggestions
```

### docs/reward-types/

Reward type templates for `viben filerl reward` command:

```
docs/reward-types/
├── test_coverage.md         # Test coverage evaluation
├── code_quality.md         # Code quality evaluation
├── security_scan.md        # Security scan evaluation
├── diff_penalty.md         # Diff penalty evaluation
├── agent_review.md         # Agent review evaluation
└── benchmark_comparison.md # Benchmark comparison evaluation
```

---

## Output Examples

**`viben update --idea-types` (Human readable)**:
```
Updating Viben workspace...
  Target: /path/to/project

  Updating idea-types templates...

✓ Workspace updated successfully!

Updated 6 files:
  docs/idea-types/code_improvements.md
  docs/idea-types/code_quality.md
  docs/idea-types/documentation_gaps.md
  docs/idea-types/performance_optimizations.md
  docs/idea-types/security_hardening.md
  docs/idea-types/ui_ux_improvements.md
```

**`viben update --idea-types --reward-types` (Update both)**:
```
Updating Viben workspace...
  Target: /path/to/project

  Updating idea-types templates...
  Updating reward-types templates...

✓ Workspace updated successfully!

Updated 12 files:
  docs/idea-types/code_improvements.md
  docs/idea-types/code_quality.md
  ...
  docs/reward-types/code_correctness.md
  docs/reward-types/code_quality.md
  ...
```

**`viben update --idea-types --json`**:
```json
{
  "success": true,
  "data": {
    "path": "/path/to/project",
    "files": [
      "docs/idea-types/code_improvements.md",
      "docs/idea-types/code_quality.md",
      "docs/idea-types/documentation_gaps.md",
      "docs/idea-types/performance_optimizations.md",
      "docs/idea-types/security_hardening.md",
      "docs/idea-types/ui_ux_improvements.md"
    ],
    "count": 6
  }
}
```

**Error: No update option specified**:
```
Error: No update option specified.

Available options:
  --idea-types     Update idea-types templates in docs/idea-types/
  --reward-types   Update reward-types templates in docs/reward-types/

Example:
  viben update --idea-types
  viben update --reward-types
```

**Files already exist (default behavior)**:
```
Updating Viben workspace...
  Target: /path/to/project

  Updating idea-types templates...

✓ Workspace updated successfully!

No files were updated (all files already exist).
```

---

## File Overwrite Policy

| Option | Behavior when file exists |
|--------|--------------------------|
| (default) | Skip, no error |
| `--force` | Overwrite existing files |
| `--skip-existing` | Skip, no error (same as default) |

---

## Relationship with viben init

`viben init` automatically creates `docs/idea-types/` and `docs/reward-types/` directories when initializing a workspace.

`viben update` is used to update these templates to the latest version after a Viben upgrade, without affecting other workspace configurations.

---

## Related

- [init](./init.md) - Workspace initialization
- [idea](./idea.md) - Idea generation and management
