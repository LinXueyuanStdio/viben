# Code Quality Requirements

> Quality standards for browse-mcp Python backend.

---

## Linting & Formatting

### Required Tools

| Tool | Purpose | Command |
|------|---------|---------|
| `ruff` | Linting | `ruff check .` |
| `ruff` | Formatting | `ruff format .` |
| `mypy` | Type checking | `mypy browse_mcp/` |

### Pre-commit Checks

Before committing:

```bash
cd backend/browse-mcp
ruff check browse_mcp/
ruff format --check browse_mcp/
```

---

## Type Hints

### Required

All public functions must have type hints:

```python
# Good
def search(self, query: str, max_results: int = 10) -> List[Paper]:
    pass

# Bad - missing types
def search(self, query, max_results=10):
    pass
```

### Optional Types

Use `Optional` for nullable parameters:

```python
from typing import Optional

def read(
    self,
    content_id: str,
    page: Optional[int] = None,
) -> str:
    pass
```

---

## Documentation

### Docstrings

Use Google-style docstrings:

```python
def search(self, query: str, max_results: int = 10) -> List[Paper]:
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

## Testing

### Test File Location

```
backend/browse-mcp/
├── browse_mcp/
│   └── sources/
│       └── arxiv.py
└── tests/
    └── test_arxiv.py
```

### Test Naming

```python
def test_search_returns_papers():
    """Test that search returns list of papers."""
    pass

def test_search_empty_query_raises():
    """Test that empty query raises ValueError."""
    pass
```

---

## Forbidden Patterns

| Pattern | Why Forbidden | Alternative |
|---------|---------------|-------------|
| `except:` (bare) | Catches everything | `except Exception:` |
| `print()` | Not logged | `logger.info()` |
| Hardcoded paths | Not portable | Use `pathlib` or config |
| `eval()` / `exec()` | Security risk | Never use |

---

## Code Metrics

| Metric | Limit |
|--------|-------|
| Function length | < 50 lines |
| File length | < 500 lines |
| Cyclomatic complexity | < 10 |
| Nesting depth | < 4 levels |
