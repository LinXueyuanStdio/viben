# Onboard

Initialize a new developer or AI agent for the Viben workflow.

## Steps

### 1. Initialize Developer Identity

```bash
# Check if already initialized
./.viben/scripts/get-developer.sh

# If not initialized, run:
./.viben/scripts/init-developer.sh <your-name>
```

**Naming conventions**:
- Human developers: `john-doe`, `alice-smith`
- Cursor AI: `cursor-agent`, `cursor-<project>`
- Claude Code: `claude-agent`, `claude-<project>`

### 2. Read Project Documentation

```bash
# Read the workflow guide
cat .viben/workflow.md

# Get current context
./.viben/scripts/get-context.sh
```

### 3. Read Development Guidelines

**For Frontend work**:
```bash
cat .viben/spec/frontend/index.md
```

**For Backend work**:
```bash
cat .viben/spec/backend/index.md
```

### 4. Understand Task System

```bash
# List active tasks
./.viben/scripts/task.sh list

# View a specific task
cat .viben/tasks/<task-dir>/task.json
```

### 5. Familiarize with Commands

Available slash commands:
- `/viben:start` - Initialize session
- `/viben:finish-work` - Pre-commit checklist
- `/viben:check-backend` - Verify backend code
- `/viben:check-frontend` - Verify frontend code
- `/viben:record-session` - Record session progress

---

## Checklist

- [ ] Developer identity initialized
- [ ] Read workflow.md
- [ ] Read relevant spec documents
- [ ] Understand task system
- [ ] Know available commands
