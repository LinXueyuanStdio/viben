# Frontend Quality Guidelines

> To be filled by the team with project-specific quality standards.

---

## Linting & Formatting

| Tool | Command |
|------|---------|
| ESLint | `pnpm lint` |
| Prettier | `pnpm format` |
| TypeScript | `pnpm typecheck` |

---

## Pre-commit Checks

```bash
# Must pass before commit
pnpm lint
pnpm typecheck
```

---

## Forbidden Patterns

| Pattern | Why | Alternative |
|---------|-----|-------------|
| `console.log` | Not production-ready | Use logger |
| Inline styles | Hard to maintain | CSS/Tailwind |
| ... | ... | ... |

---

## Performance

- [ ] Memoize expensive computations
- [ ] Use React.memo for pure components
- [ ] Lazy load routes
