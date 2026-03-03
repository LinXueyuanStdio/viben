# Backend Quality Guidelines

> Code standards for packages/core TypeScript development.

---

## Status: 📝 To Fill

This document needs to be populated with:

- [ ] TypeScript strict mode requirements
- [ ] ESLint/Biome configuration
- [ ] Testing requirements
- [ ] Error handling patterns
- [ ] Performance guidelines

---

## Tech Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js
- **Framework**: Hono (HTTP), Commander (CLI)
- **Build**: tsup
- **Lint**: ESLint / Biome

---

## Forbidden Patterns

<!-- TODO: Document patterns that should never be used -->

Examples to document:
- `any` type usage
- Console.log in production code
- Hardcoded secrets
- Synchronous file operations in HTTP handlers

---

## Required Patterns

<!-- TODO: Document patterns that must always be used -->

Examples to document:
- Error handling with typed errors
- Input validation with Zod
- Structured logging
- API snake_case naming

---

## Testing Requirements

<!-- TODO: Document testing expectations -->

Examples to document:
- Unit test coverage targets
- Integration test requirements
- How to run tests (`pnpm test`)

---

## Code Review Checklist

<!-- TODO: Document what reviewers should check -->

Examples to document:
- Type safety
- Error handling
- API naming conventions
- Performance considerations

---

**Related:**
- [Directory Structure](./directory-structure.md)
- [API Module](./api-module.md)
- [Quality](./quality.md)
