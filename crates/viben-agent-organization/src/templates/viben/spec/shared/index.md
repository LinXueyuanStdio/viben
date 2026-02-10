# Shared Coding Standards

> Cross-cutting standards that apply to all code in the project.

---

## General Principles

1. **Consistency** - Follow existing patterns in the codebase
2. **Simplicity** - Prefer simple, readable code over clever solutions
3. **Documentation** - Document public APIs and complex logic
4. **Type Safety** - Use type hints (Python) and TypeScript strictly

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | snake_case (Python) / kebab-case (TS) | `user_service.py` / `user-service.ts` |
| Classes | PascalCase | `UserService` |
| Functions | snake_case (Python) / camelCase (TS) | `get_user()` / `getUser()` |
| Constants | UPPER_SNAKE | `MAX_RESULTS` |
| Variables | snake_case (Python) / camelCase (TS) | `user_name` / `userName` |

---

## Error Handling

1. **Be specific** - Use specific exception/error types, not generic `Exception` or `Error`
2. **Log errors** - Use proper logging for error tracking
3. **User messages** - Return user-friendly error messages
4. **Don't swallow** - Don't catch and ignore exceptions/errors silently

---

## Code Quality

- Run linters before committing
- Keep functions under 50 lines
- Keep files under 500 lines
- Avoid deeply nested code (max 3 levels)

---

## Git Conventions

### Commit Messages

```
type(scope): description

Types: feat, fix, docs, refactor, test, chore
```

### Branch Names

```
feature/<name>
fix/<name>
docs/<name>
task/<name>
```

---

**Language**: All code comments and documentation should be in **English**.
