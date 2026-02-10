[!] **Prerequisite**: This command should only be used AFTER the human has tested and committed the code.

**AI must NOT execute git commit** - only read history.

---

## Record Work Progress

### Step 1: Get Context

```bash
./.viben/scripts/get-context.sh
```

### Step 2: Add Session

```bash
./.viben/scripts/add-session.sh \
  --title "Session Title" \
  --commit "hash1,hash2" \
  --summary "Brief summary"
```

**Auto-completes**:
- Appends session to journal
- Creates new file if >2000 lines
- Updates index.md stats

---

## Archive Task (if completed)

```bash
./.viben/scripts/task.sh archive <task-name>
```

---

## Commands

| Command | Purpose |
|---------|---------|
| `get-context.sh` | Get all context |
| `add-session.sh` | Record session |
| `task.sh archive` | Archive task |
