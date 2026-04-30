---
sidebar_position: 7
title: "API Module Conventions"
description: "Guidelines for building API modules in the browse-mcp Python backend"
---

# API Module Conventions

Guidelines for building API modules in the browse-mcp Python backend.

---

## Module Structure

```
browse_mcp/
+-- __main__.py      # MCP tool definitions (entry point)
+-- types.py         # Data models and interfaces
+-- plugin.py        # Plugin loading system
+-- sources/         # Searcher implementations
    +-- __init__.py
    +-- arxiv.py
    +-- pubmed.py
    +-- ...
```

---

## Tool Definition Pattern

Use FastMCP decorators with Pydantic models:

```python
from fastmcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("browse_mcp")

class SearchQuery(BaseModel):
    """Query parameters for search."""
    query: str = Field(..., min_length=1, max_length=500)
    max_results: int = Field(default=10, ge=1, le=100)

@mcp.tool(
    name="browse_search",
    description="Search for content across sources.",
)
async def browse_search(query_list: List[SearchQuery]) -> str:
    """Implementation..."""
    pass
```

---

## Interface Design

### ContentSource[T] Base Class

All searchers must implement:

```python
class ContentSource(ABC, Generic[T]):
    @abstractmethod
    def search(self, query: str, max_results: int = 10, **kwargs) -> List[T]:
        """Search for content."""
        pass

    @abstractmethod
    def download(self, content_id: str, save_path: str) -> str:
        """Download content to file. Returns file path."""
        pass

    @abstractmethod
    def read(self, content_id: str, save_path: str, **kwargs) -> str:
        """Read/extract text content."""
        pass
```

---

## Async Patterns

- Use `async/await` for I/O operations
- Use `httpx.AsyncClient` for HTTP requests
- Batch operations should run concurrently with `asyncio.gather`

```python
async def batch_search(queries: List[Query]) -> List[Result]:
    results = await asyncio.gather(*[
        search_single(q) for q in queries
    ])
    return results
```

---

## Error Handling

```python
from loguru import logger

try:
    result = searcher.search(query)
except Exception as e:
    logger.error(f"Search failed: {e}")
    return f"Error: {e}"
```

---

## Validation

Use Pydantic validators for input validation:

```python
class Query(BaseModel):
    query: str

    @field_validator('query')
    @classmethod
    def validate_query(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty")
        return v
```

---

## Backward Compatibility

When renaming or changing APIs:

1. Keep old names as deprecated aliases
2. Log deprecation warnings
3. Document migration path in changelog
