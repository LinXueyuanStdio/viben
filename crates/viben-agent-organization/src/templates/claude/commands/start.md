# Session Start

Initialize your session with project context.

## Steps

### 1. Get Context

```bash
./.viben/scripts/get-context.sh
```

### 2. Read Workflow

```bash
cat .viben/workflow.md
```

### 3. Read Guidelines

Based on your task:

**Frontend work**:
```bash
cat .viben/spec/frontend/index.md
```

**Backend work**:
```bash
cat .viben/spec/backend/index.md
```

### 4. Check Tasks

```bash
./.viben/scripts/task.sh list
```

---

## Remember

- [!] Read guidelines BEFORE writing code
- [!] AI should NOT execute git commit
- [OK] Record sessions after work
