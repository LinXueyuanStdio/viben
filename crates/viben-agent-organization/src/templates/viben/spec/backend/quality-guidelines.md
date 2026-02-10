# Code Quality Guidelines

> To be filled by the team with project-specific quality standards.

---

## Linting & Formatting

| Tool | Purpose | Command |
|------|---------|---------|
| ... | Linting | `...` |
| ... | Formatting | `...` |

---

## Type Hints

<!-- Document type hint requirements -->

---

## Testing Requirements

<!-- Document testing requirements -->

---

## Forbidden Patterns

| Pattern | Why Forbidden | Alternative |
|---------|---------------|-------------|
| `except:` (bare) | Catches everything | `except Exception:` |
| `print()` | Not logged | Use logger |
| ... | ... | ... |

---

## Code Metrics

| Metric | Limit |
|--------|-------|
| Function length | < 50 lines |
| File length | < 500 lines |
| Cyclomatic complexity | < 10 |
