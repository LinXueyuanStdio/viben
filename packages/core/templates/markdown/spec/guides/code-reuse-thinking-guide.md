# Code Reuse Thinking Guide

> **Purpose**: Stop and think before creating new code - does it already exist?

---

## The Problem

**Duplicated code is the #1 source of inconsistency bugs.**

When you copy-paste or rewrite existing logic:
- Bug fixes don't propagate
- Behavior diverges over time
- Codebase becomes harder to understand

---

## Before Writing New Code

### Step 1: Search First

```bash
# Search for similar function names
grep -r "functionName" .

# Search for similar logic
grep -r "keyword" .
```

### Step 2: Ask These Questions

| Question | If Yes... |
|----------|-----------|
| Does a similar function exist? | Use or extend it |
| Is this pattern used elsewhere? | Follow the existing pattern |
| Could this be a shared utility? | Create it in the right place |
| Am I copying code from another file? | **STOP** - extract to shared |

---

## Common Duplication Patterns

### Pattern 1: Copy-Paste Functions

**Bad**: Copying a validation function to another file

**Good**: Extract to shared utilities, import where needed

### Pattern 2: Similar Components

**Bad**: Creating a new component that's 80% similar to existing

**Good**: Extend existing component with props/variants

### Pattern 3: Repeated Constants

**Bad**: Defining the same constant in multiple files

**Good**: Single source of truth, import everywhere

---

## When to Abstract

**Abstract when**:
- Same code appears 3+ times
- Logic is complex enough to have bugs
- Multiple people might need this

**Don't abstract when**:
- Only used once
- Trivial one-liner
- Abstraction would be more complex than duplication

---

## After Batch Modifications

When you've made similar changes to multiple files:

1. **Review**: Did you catch all instances?
2. **Search**: Run grep to find any missed
3. **Consider**: Should this be abstracted?

---

## Checklist Before Commit

- [ ] Searched for existing similar code
- [ ] No copy-pasted logic that should be shared
- [ ] Constants defined in one place
- [ ] Similar patterns follow same structure

---

## Extending Viben CLI (Viben-specific)

When adding new workflow commands:

**CRITICAL**: Extend the `viben` CLI rather than creating standalone scripts.

### CLI Structure

```
packages/core/src/cli/
├── index.ts           # Main entry point (registers all commands)
├── commands/          # Command implementations
│   ├── task.ts        # Task management commands
│   ├── swarm.ts       # Multi-agent commands
│   ├── user.ts        # User/developer commands
│   └── team.ts        # Team workspace commands
└── lib/               # Shared utilities
    └── viben-workspace.ts  # Workspace operations
```

### Steps to Add a New Command

1. **Create/extend command file** in `packages/core/src/cli/commands/`
2. **Register command** in `packages/core/src/cli/index.ts`
3. **Update documentation** in `docs/specs/backend/script-conventions.md`

### Example: Adding a New Subcommand

```typescript
// In packages/core/src/cli/commands/task.ts
taskCommand
  .command("my-new-command")
  .description("Description of what it does")
  .option("--option <value>", "Option description")
  .action(async (options) => {
    // Implementation
  });
```

### Quick Checklist for New Commands

```bash
# After adding a new command, verify:
grep -l "my-new-command" packages/core/src/cli/commands/  # Should match
viben task my-new-command --help  # Should show help
```

**Why this matters**: Using the CLI provides:
- Consistent interface across all workflow operations
- Automatic `--help` and `--json` support
- Proper error handling and exit codes
- Easy testing and maintenance
