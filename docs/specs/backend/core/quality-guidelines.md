# Backend Quality Guidelines

> Code standards for packages/core TypeScript development.

## Overview

This guide defines the code quality standards for the Viben project, applicable to both TypeScript and Python code.

---

## Tech Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js
- **Framework**: Hono (HTTP), Commander (CLI)
- **Build**: tsup
- **Lint**: ESLint / Biome

---

## TypeScript Quality Requirements

### Linting & Formatting

| Tool | Purpose | Command |
|------|---------|---------|
| ESLint | Code linting | `pnpm lint` |
| Prettier | Code formatting | `pnpm format` |
| TypeScript | Type checking | `pnpm typecheck` |

### Pre-commit Checks

```bash
# Run all checks
pnpm lint
pnpm typecheck
pnpm build
```

### Type Safety

All public functions must have type annotations:

```typescript
// Correct
function createAgent(config: AgentConfig): Promise<Agent> {
  // ...
}

// Incorrect - missing types
function createAgent(config) {
  // ...
}
```

Use `unknown` instead of `any`:

```typescript
// Correct
function handleData(data: unknown): void {
  if (typeof data === 'string') {
    // ...
  }
}

// Incorrect
function handleData(data: any): void {
  // ...
}
```

---

## Python Quality Requirements

### Linting & Formatting

| Tool | Purpose | Command |
|------|---------|---------|
| ruff | Linting | `ruff check .` |
| ruff | Formatting | `ruff format .` |
| mypy | Type checking | `mypy browse_mcp/` |

### Pre-commit Checks

```bash
cd backend/browse-mcp
ruff check browse_mcp/
ruff format --check browse_mcp/
```

### Type Hints

All public functions must have type hints:

```python
from typing import List, Optional

# Correct
def search(query: str, max_results: int = 10) -> List[Paper]:
    pass

# Incorrect - missing types
def search(query, max_results=10):
    pass
```

### Docstring

Use Google-style docstrings:

```python
def search(query: str, max_results: int = 10) -> List[Paper]:
    """Search for papers.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return.

    Returns:
        List of Paper objects matching the query.

    Raises:
        ValueError: If query is empty.
    """
    pass
```

---

## Code Metrics

| Metric | Limit |
|--------|-------|
| Function length | < 50 lines |
| File length | < 500 lines |
| Cyclomatic complexity | < 10 |
| Nesting depth | < 4 levels |

---

## Forbidden Patterns

### TypeScript

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| `any` type | Type unsafe | Use `unknown` or specific types |
| `console.log` | Unstructured | Use `logger` |
| Hardcoded paths | Not portable | Use config or path module |
| `eval()` / `new Function()` | Security risk | Never use |

### Python

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| `except:` (bare) | Catches all exceptions | `except Exception:` |
| `print()` | Unstructured | `logger.info()` |
| Hardcoded paths | Not portable | Use `pathlib` or config |
| `eval()` / `exec()` | Security risk | Never use |

---

## Naming Conventions

### File Names

| Type | TypeScript | Python |
|------|------------|--------|
| Component | `kebab-case.tsx` | - |
| Utility | `kebab-case.ts` | `snake_case.py` |
| Types | `types.ts` | `types.py` |
| Tests | `*.test.ts` | `test_*.py` |

### Variables and Functions

| Type | TypeScript | Python |
|------|------------|--------|
| Variable | `camelCase` | `snake_case` |
| Function | `camelCase` | `snake_case` |
| Constant | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` |
| Class | `PascalCase` | `PascalCase` |

### API Parameters

**Important**: All Gateway API query parameters use **snake_case**:

```typescript
// Correct
workspace_path, include_global, session_id

// Incorrect
workspacePath, includeGlobal, sessionId
```

---

## Testing Requirements

### Test File Location

```
# TypeScript
packages/core/src/
├── agent/
│   ├── agent.ts
│   └── agent.test.ts

# Python
backend/browse-mcp/
├── browse_mcp/
│   └── sources/
│       └── arxiv.py
└── tests/
    └── test_arxiv.py
```

### Test Naming

```typescript
// TypeScript
describe('AgentService', () => {
  it('should create agent with valid config', () => {
    // ...
  });

  it('should throw error for invalid config', () => {
    // ...
  });
});
```

```python
# Python
def test_search_returns_papers():
    """Test that search returns list of papers."""
    pass

def test_search_empty_query_raises():
    """Test that empty query raises ValueError."""
    pass
```

---

## Code Review Checklist

### Pre-commit Self-check

- [ ] Code passes lint checks
- [ ] Code passes type checks
- [ ] New features have test coverage
- [ ] Public APIs have documentation
- [ ] No hardcoded sensitive information
- [ ] Errors are properly handled
- [ ] No `console.log` or `print`

### Review Focus

- Type safety
- Error handling completeness
- Security vulnerabilities
- Performance issues
- Code readability

---

**Related:**
- [Directory Structure](./directory-structure.md)
- [Error Handling](../patterns/error-handling.md)
- [Logging Guidelines](../patterns/logging-guidelines.md)
