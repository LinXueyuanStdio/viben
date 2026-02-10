# Break the Loop - Deep Bug Analysis

When debug is complete, use this for deep analysis.

---

## Analysis Framework

### 1. Root Cause Category

| Category | Example |
|----------|---------|
| **A. Missing Spec** | No documentation on how to do it |
| **B. Cross-Layer Contract** | API returns different format |
| **C. Change Propagation** | Changed one place, missed others |
| **D. Test Gap** | Unit passes, integration fails |
| **E. Implicit Assumption** | Undocumented assumption |

### 2. Why Fixes Failed (if applicable)

- Surface fix vs root cause
- Incomplete scope
- Wrong mental model

### 3. Prevention Mechanisms

| Type | Example |
|------|---------|
| Documentation | Update thinking guide |
| Architecture | Type-safe wrappers |
| Compile-time | TypeScript strict |
| Runtime | Monitoring/alerts |
| Test Coverage | E2E tests |

### 4. Knowledge Capture

- [ ] Update `.viben/spec/guides/`
- [ ] Update `.viben/spec/backend/` or `frontend/`
- [ ] Create issue record

---

## Core Philosophy

> **The value of debugging is not in fixing the bug, but in making this class of bugs never happen again.**
