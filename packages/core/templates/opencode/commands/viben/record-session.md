[!] **Prerequisite**: This command should only be used AFTER the human has tested and committed the code.

**AI must NOT execute git commit** - only read history (`git log`, `git status`, `git diff`).

---

## Record Work Progress (Simplified - Only 2 Steps)

### Step 1: Get Context

```bash
viben task context
```

### Step 2: One-Click Add Session

```bash
# Method 1: Simple parameters
viben task add-session \
  --title "Session Title" \
  --commit "hash1,hash2" \
  --summary "Brief summary of what was done"
```

**Auto-completes**:
- [OK] Appends session to journal-N.md
- [OK] Auto-detects line count, creates new file if >2000 lines
- [OK] Updates index.md (Total Sessions +1, Last Active, line stats, history)

---

## Archive Completed Task (if any)

If a task was completed this session:

```bash
viben task archive <task-name>
```

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `viben task context` | Get all context info |
| `viben task add-session --title "..." --commit "..."` | **One-click add session (recommended)** |
| `viben task create "<title>" [--slug <name>]` | Create new task directory |
| `viben task archive <name>` | Archive completed task |
| `viben task list` | List active tasks |
