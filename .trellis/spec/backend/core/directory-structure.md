# Directory Structure

> How backend code is organized in this project.

---

## Overview

Viben backend consists of two main components:

1. **Core Package** (`backend/browse-mcp`): Main application with built-in data sources
2. **Plugin Packages** (`backend/plugins/*`): Third-party extensible data sources

The architecture uses **stevedore** for plugin discovery via Python entry points.

---

## Directory Layout

```
backend/
├── browse-mcp/                    # Core package
│   ├── browse_mcp/
│   │   ├── __init__.py
│   │   ├── base.py               # BaseSearcher interface
│   │   ├── plugin.py             # Plugin discovery & loading
│   │   ├── api/                  # API endpoints
│   │   ├── sources/              # Built-in data sources (20+)
│   │   │   ├── arxiv.py
│   │   │   ├── pubmed.py
│   │   │   ├── semantic.py
│   │   │   ├── ieee.py
│   │   │   └── ...
│   │   ├── utils/                # Utilities
│   │   └── models/               # Data models
│   ├── pyproject.toml
│   ├── README.md
│   └── tests/
│
└── plugins/                       # Plugin packages
    ├── browse-mcp-plugin-context7/
    │   ├── browse_mcp_plugin_context7/
    │   │   ├── __init__.py
    │   │   └── searcher.py       # Context7 searcher implementation
    │   ├── pyproject.toml        # Entry point registration
    │   ├── README.md
    │   └── tests/
    │
    └── browse-mcp-plugin-social-media/
        ├── browse_mcp_plugin_social_media/
        │   ├── __init__.py
        │   ├── twitter.py        # Twitter searcher
        │   └── linkedin.py       # LinkedIn searcher
        ├── pyproject.toml
        ├── README.md
        └── tests/
```

---

## Module Organization

### Core Package (`backend/browse-mcp`)

**Purpose:** Main application with built-in academic/research data sources

**Key Modules:**

| Module | Purpose | Examples |
|--------|---------|----------|
| `base.py` | Base classes and interfaces | `BaseSearcher` |
| `plugin.py` | Plugin discovery with stevedore | `discover_searchers()` |
| `api/` | API endpoints and routes | REST API handlers |
| `sources/` | Built-in data source implementations | arXiv, PubMed, Semantic Scholar |
| `utils/` | Helper functions | HTTP clients, parsers |
| `models/` | Data models and schemas | Paper, Author, Citation |

**Built-in Sources (20+):**
- Academic: arxiv, pubmed, pmc, biorxiv, medrxiv, semantic, core, crossref, iacr
- Publishers: acm, ieee, sciencedirect, springer, scopus, jstor
- General: google_scholar, researchgate, wos, sci_hub, hub

### Plugin Packages (`backend/plugins/*`)

**Purpose:** Third-party extensible data sources

**Structure Pattern:**
```
browse-mcp-plugin-{name}/
├── browse_mcp_plugin_{name}/     # Package with underscores
│   ├── __init__.py
│   └── searcher.py               # Searcher implementation
├── pyproject.toml                # Entry point registration
├── README.md
└── tests/
```

**Entry Point Registration:**
```toml
[tool.poetry.plugins."browse_mcp.searchers"]
entry_name = "browse_mcp_plugin_name.searcher:SearcherClass"
```

**Available Plugins:**
- `browse-mcp-plugin-context7`: Context7 web searcher
- `browse-mcp-plugin-social-media`: Twitter, LinkedIn searchers

---

## Naming Conventions

### Package Names

| Type | Pattern | Example |
|------|---------|---------|
| Core package | `browse-mcp` | `backend/browse-mcp` |
| Plugin package | `browse-mcp-plugin-{name}` | `browse-mcp-plugin-context7` |
| Python module | Use underscores | `browse_mcp_plugin_context7` |

**Note:** Package names use hyphens (`-`), Python modules use underscores (`_`).

### File Names

| Type | Pattern | Example |
|------|---------|---------|
| Data source | Lowercase with underscores | `arxiv.py`, `google_scholar.py` |
| Base classes | Descriptive | `base.py`, `plugin.py` |
| API routes | Feature-based | `search.py`, `papers.py` |
| Tests | `test_` prefix | `test_arxiv.py` |

### Class Names

| Type | Pattern | Example |
|------|---------|---------|
| Searcher | `{Name}Searcher` | `ArxivSearcher`, `PubMedSearcher` |
| Model | PascalCase | `Paper`, `Author`, `Citation` |
| Exception | `{Name}Error` | `APIError`, `SearchError` |

### Entry Point Names

| Pattern | Example | Provider Name |
|---------|---------|---------------|
| Lowercase with underscores | `arxiv` | `browse-mcp/arxiv` |
| Descriptive | `semantic_scholar` | `browse-mcp/semantic_scholar` |
| Plugin prefix | `context7_web` | `context7/web` |

**Provider Naming Format:** `{provider}/{source_name}`

---

## Module Dependencies

### Core Package Dependencies

```
browse_mcp/
├── base.py                 # No internal dependencies
├── plugin.py               # Depends on: base.py
├── sources/
│   └── *.py                # Depends on: base.py
├── api/
│   └── *.py                # Depends on: plugin.py, sources/
└── utils/
    └── *.py                # No internal dependencies (utilities only)
```

**Dependency Rules:**
1. `base.py` has no internal dependencies (foundation)
2. All searchers depend on `base.py` only
3. `plugin.py` orchestrates searcher discovery
4. API layer depends on plugin system
5. Utils are standalone (no circular dependencies)

### Plugin Package Dependencies

```
browse_mcp_plugin_name/
├── searcher.py             # Depends on: browse_mcp.base
└── utils.py                # Plugin-specific utilities
```

**Rules:**
- Plugins only depend on `browse_mcp.base` (public interface)
- Plugins NEVER import from `browse_mcp.sources` (encapsulation)
- Each plugin is independent (no cross-plugin dependencies)

---

## Examples

### Example 1: Built-in Searcher

**File:** `backend/browse-mcp/browse_mcp/sources/arxiv.py`

```python
from browse_mcp.base import BaseSearcher
from typing import List, Dict

class ArxivSearcher(BaseSearcher):
    """arXiv preprint repository searcher."""

    def __init__(self):
        super().__init__(name="arxiv")
        self.base_url = "http://export.arxiv.org/api/query"

    def search(self, query: str, max_results: int = 10) -> List[Dict]:
        """Search arXiv for papers."""
        # Implementation here
        pass

    def get_paper_details(self, paper_id: str) -> Dict:
        """Fetch detailed metadata for an arXiv paper."""
        # Implementation here
        pass
```

### Example 2: Plugin Searcher

**File:** `backend/plugins/browse-mcp-plugin-context7/browse_mcp_plugin_context7/searcher.py`

```python
from browse_mcp.base import BaseSearcher
import os

class Context7Searcher(BaseSearcher):
    """Context7 web searcher plugin."""

    def __init__(self):
        super().__init__(name="context7")
        self.api_key = os.getenv("CONTEXT7_API_KEY")

    def search(self, query: str, **kwargs) -> List[Dict]:
        # Context7 API implementation
        pass
```

**Entry Point:** `pyproject.toml`
```toml
[tool.poetry.plugins."browse_mcp.searchers"]
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
```

### Example 3: Plugin Discovery

**File:** `backend/browse-mcp/browse_mcp/plugin.py`

```python
from stevedore import extension

def discover_searchers():
    """Discover all available searchers (built-in + plugins)."""
    mgr = extension.ExtensionManager(
        namespace='browse_mcp.searchers',
        invoke_on_load=True,
    )

    searchers = {}
    for ext in mgr:
        searchers[ext.name] = ext.obj

    return searchers
```

---

## Adding New Components

### Adding a Built-in Source

1. Create file in `backend/browse-mcp/browse_mcp/sources/{name}.py`
2. Implement `BaseSearcher` interface
3. Register in `provider.index.json`
4. Add tests in `backend/browse-mcp/tests/test_{name}.py`

### Creating a Plugin

1. Create package: `backend/plugins/browse-mcp-plugin-{name}/`
2. Implement searcher inheriting from `BaseSearcher`
3. Register entry point in `pyproject.toml`
4. Update `provider.index.json`
5. Install plugin: `cd backend/plugins/browse-mcp-plugin-{name} && poetry install`

**See:** [Plugin Architecture Guide](./plugin-architecture.md) for detailed instructions.

---

## References

- **Plugin Architecture:** [plugin-architecture.md](./plugin-architecture.md)
- **Provider Registry:** `provider.index.json` (root directory)
- **Base Searcher:** `backend/browse-mcp/browse_mcp/base.py`
- **Plugin System:** `backend/browse-mcp/browse_mcp/plugin.py`

---

**Last Updated:** 2026-02-03
