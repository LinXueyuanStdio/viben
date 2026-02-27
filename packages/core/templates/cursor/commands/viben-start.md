# Start Session

Initialize your AI development session and begin working on tasks.

---

## Operation Types

Operations in this document are categorized as:

| Marker | Meaning | Executor |
|--------|---------|----------|
| `[AI]` | Bash scripts or file reads executed by AI | You (AI) |
| `[USER]` | Slash commands executed by user | User |

---

## Initialization

### Step 1: Understand Viben Workflow `[AI]`

First, read the workflow guide to understand the development process:

```bash
cat .viben/workflow.md  # Development process, conventions, and quick start guide
```

### Step 2: Get Current Status `[AI]`

```bash
./.viben/scripts/get-context.sh
```

This returns:
- Developer identity
- Git status (branch, uncommitted changes)
- Recent commits
- Active tasks
- Journal file status

### Step 3: Read Project Guidelines `[AI]`

Based on the upcoming task, read appropriate spec docs:

**For Frontend Work**:
```bash
cat .viben/spec/frontend/index.md
```

**For Backend Work**:
```bash
cat .viben/spec/backend/index.md
```

**For Cross-Layer Features**:
```bash
cat .viben/spec/guides/index.md
cat .viben/spec/guides/cross-layer-thinking-guide.md
```

### Step 4: Check Active Tasks `[AI]`

```bash
./.viben/scripts/task.sh list
```

If continuing previous work, review the task file.

### Step 5: Report Ready Status and Ask for Tasks

Output a summary:

```markdown
## Session Initialized

| Item | Status |
|------|--------|
| Developer | {name} |
| Branch | {branch} |
| Uncommitted | {count} file(s) |
| Journal | {file} ({lines}/2000 lines) |
| Active Tasks | {count} |

Ready for your task. What would you like to work on?
```

---

## Working on Tasks

### For Simple Tasks

1. Read relevant guidelines based on task type `[AI]`
2. Implement the task directly `[AI]`
3. Remind user to run `/viben-finish-work` before committing `[USER]`

### For Complex Tasks (Multi-Step Tasks)

#### Step 1: Create Task `[AI]`

```bash
./.viben/scripts/task.sh create "<title>" --slug <name>
```

#### Step 2: Implement and Verify `[AI]`

1. Read relevant spec docs
2. Implement the task
3. Run lint and type checks

#### Step 3: Complete

1. Verify typecheck and lint pass `[AI]`
2. Remind user to test
3. Remind user to commit
4. Remind user to run `/viben-record-session` `[USER]`
5. Archive task `[AI]`:
   ```bash
   ./.viben/scripts/task.sh archive <task-name>
   ```

---

## User Available Commands `[USER]`

The following slash commands are for users (not AI):

| Command | Description |
|---------|-------------|
| `/viben-start` | Start development session (this command) |
| `/viben-before-frontend-dev` | Read frontend guidelines |
| `/viben-before-backend-dev` | Read backend guidelines |
| `/viben-check-frontend` | Check frontend code |
| `/viben-check-backend` | Check backend code |
| `/viben-check-cross-layer` | Cross-layer verification |
| `/viben-finish-work` | Pre-commit checklist |
| `/viben-record-session` | Record session progress |

---

## AI Executed Scripts `[AI]`

| Script | Purpose |
|--------|---------|
| `task.sh create "<title>" [--slug <name>]` | Create task directory |
| `task.sh list` | List active tasks |
| `task.sh archive <name>` | Archive task |
| `get-context.sh` | Get session context |

---

## Session End Reminder

**IMPORTANT**: When a task or session is completed, remind the user:

> Before ending this session, please run `/viben-record-session` to record what we accomplished.
