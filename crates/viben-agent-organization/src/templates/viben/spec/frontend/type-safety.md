# Type Safety Guidelines

> To be filled by the team with project-specific TypeScript conventions.

---

## General Rules

- [ ] No `any` types
- [ ] No non-null assertions (`!`)
- [ ] Explicit return types on public functions

---

## Type Definitions

<!-- Document where types should be defined -->

---

## Forbidden Patterns

| Pattern | Why | Alternative |
|---------|-----|-------------|
| `any` | Bypasses type checking | Proper type definition |
| `as unknown as X` | Dangerous cast | Type guards |
| ... | ... | ... |

---

## Type Utilities

<!-- Document common type utilities used in the project -->
