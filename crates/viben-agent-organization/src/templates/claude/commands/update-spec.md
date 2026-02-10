# Update Spec - Capture Knowledge

When you learn something valuable, update the relevant spec.

---

## When to Update

| Trigger | Target Spec |
|---------|-------------|
| Fixed a bug | Relevant guidelines |
| Discovered pattern | Guidelines file |
| Hit a gotcha | Add to "Common Mistakes" |
| Established convention | `quality-guidelines.md` |
| Cross-layer insight | `guides/` |

---

## Process

### 1. Identify What You Learned

- What did you learn?
- Why is it important?
- Where does it belong?

### 2. Classify Update Type

- **New Pattern** -> Add to "Patterns"
- **Forbidden Pattern** -> Add to "Anti-patterns"
- **Common Mistake** -> Add to "Common Mistakes"
- **Gotcha** -> Add warning callout

### 3. Read Target Spec

```bash
cat .viben/spec/<category>/<file>.md
```

### 4. Make Update

Follow these principles:
- Be specific with examples
- Explain why
- Keep it short

---

## Core Philosophy

> **Specs are living documents. Every "aha moment" should improve them.**
