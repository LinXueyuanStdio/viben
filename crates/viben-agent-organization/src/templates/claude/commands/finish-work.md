# Finish Work - Pre-Commit Checklist

Before submitting or committing, use this checklist.

---

## Checklist

### 1. Code Quality

```bash
# Must pass (adjust for your project)
pnpm lint
pnpm typecheck
```

- [ ] Lint passes with 0 errors?
- [ ] Type check passes?
- [ ] No `console.log` statements?
- [ ] No `any` types?

### 2. Documentation Sync

- [ ] Does `.viben/spec/backend/` need updates?
- [ ] Does `.viben/spec/frontend/` need updates?
- [ ] Does `.viben/spec/guides/` need updates?

**Key Question**:
> "If I fixed a bug or discovered something, should I document it?"

### 3. API Changes

If you modified API endpoints:

- [ ] Input schema updated?
- [ ] Output schema updated?
- [ ] Client code updated?

### 4. Cross-Layer Verification

If the change spans multiple layers:

- [ ] Data flows correctly?
- [ ] Error handling works?
- [ ] Types consistent?

---

## Core Principle

> **Delivery includes code + documentation + verification**
