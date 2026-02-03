# Plugin Architecture

> Pluggable provider system for extensible data sources in Browse MCP.

---

## Overview

Browse MCP implements a pluggable architecture that allows extending data sources through:

1. **Built-in Providers**: Core academic/research data sources in `backend/browse-mcp`
2. **Plugin Providers**: Third-party extensions in `backend/plugins/*`

The system uses **stevedore** for dynamic plugin discovery and loading via Python entry points.

---

## Architecture Components

### 1. Provider Hierarchy

All data sources follow a hierarchical naming convention:

```
provider/source_name
```

**Examples:**
- `browse-mcp/arxiv` - Built-in arXiv searcher
- `browse-mcp/pubmed` - Built-in PubMed searcher
- `context7/web` - Context7 plugin web searcher
- `social-media/twitter` - Social media plugin Twitter searcher

### 2. Provider Registry

**Location:** `provider.index.json` (root directory)

This JSON file catalogs all available data sources by category:

```json
{
  "providers": {
    "academic": {
      "name": "Academic Sources",
      "description": "Research paper databases and preprint servers",
      "sources": {
        "arxiv": {
          "name": "arXiv",
          "description": "Open access preprint repository",
          "apiKey": "none",
          "documentation": "https://arxiv.org/help/api"
        }
      }
    }
  }
}
```

**Categories:**
- `academic` - Research databases (arXiv, PubMed, Semantic Scholar, etc.)
- `publisher` - Publisher-specific sources (IEEE, Springer, ScienceDirect, etc.)
- `institutional` - University repositories (CORE, ResearchGate, etc.)
- `web` - General web sources (Google Scholar, Sci-Hub, etc.)

---

## Built-in Providers

### Location

```
backend/browse-mcp/browse_mcp/sources/
```

### Available Sources (20+)

| Source | Description | API Key |
|--------|-------------|---------|
| arxiv.py | arXiv preprint server | None |
| pubmed.py | PubMed/MEDLINE database | None |
| pmc.py | PubMed Central full-text | None |
| biorxiv.py | bioRxiv preprint server | None |
| medrxiv.py | medRxiv preprint server | None |
| semantic.py | Semantic Scholar API | Optional |
| core.py | CORE aggregator | Optional |
| crossref.py | Crossref metadata | None |
| iacr.py | IACR cryptology eprints | None |
| acm.py | ACM Digital Library | Optional |
| ieee.py | IEEE Xplore | Required |
| sciencedirect.py | ScienceDirect | Required |
| springer.py | SpringerLink | Required |
| scopus.py | Scopus | Required |
| google_scholar.py | Google Scholar | None |
| jstor.py | JSTOR | Required |
| researchgate.py | ResearchGate | None |
| wos.py | Web of Science | Required |
| sci_hub.py | Sci-Hub | None |
| hub.py | Generic hub searcher | None |

### Implementation Pattern

All built-in searchers inherit from `BaseSearcher` and implement:

```python
from browse_mcp.base import BaseSearcher

class ArxivSearcher(BaseSearcher):
    def search(self, query: str, **kwargs) -> List[Dict]:
        """Execute search and return results."""
        pass

    def get_paper_details(self, paper_id: str) -> Dict:
        """Fetch detailed metadata for a paper."""
        pass
```

---

## Plugin Providers

### Location

```
backend/plugins/
├── browse-mcp-plugin-context7/
│   ├── pyproject.toml
│   ├── README.md
│   ├── CHANGELOG.md
│   └── browse_mcp_plugin_context7/
│       └── searcher.py
└── browse-mcp-plugin-social-media/
    ├── pyproject.toml
    ├── README.md
    ├── CHANGELOG.md
    └── browse_mcp_plugin_social_media/
        └── searcher.py
```

### Plugin Discovery Mechanism

Plugins register their searchers via **entry points** in `pyproject.toml`:

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
twitter = "browse_mcp_plugin_social_media.twitter:TwitterSearcher"
linkedin = "browse_mcp_plugin_social_media.linkedin:LinkedInSearcher"
```

**Entry Point Namespace:** `browse_mcp.searchers`

### Loading Mechanism

The plugin system uses **stevedore** to discover and load entry points:

```python
from stevedore import extension

def load_plugins():
    """Load all registered searcher plugins."""
    mgr = extension.ExtensionManager(
        namespace='browse_mcp.searchers',
        invoke_on_load=True,
    )
    return {ext.name: ext.obj for ext in mgr}
```

**Reference:** `backend/browse-mcp/browse_mcp/plugin.py`

---

## Creating a New Plugin

### 1. Package Structure

Create a new package following the naming convention:

```
backend/plugins/browse-mcp-plugin-{name}/
├── pyproject.toml
├── README.md
├── CHANGELOG.md
├── browse_mcp_plugin_{name}/
│   ├── __init__.py
│   └── searcher.py
└── dist/
```

### 2. Implement Searcher

Create searcher class inheriting from `BaseSearcher`:

```python
from browse_mcp.base import BaseSearcher
from typing import List, Dict

class MySearcher(BaseSearcher):
    """Custom data source searcher."""

    def __init__(self):
        super().__init__(name="my_source")

    def search(self, query: str, **kwargs) -> List[Dict]:
        """Search implementation."""
        # Your search logic here
        return results

    def get_paper_details(self, paper_id: str) -> Dict:
        """Fetch paper details."""
        # Your detail fetching logic
        return details
```

### 3. Register Entry Point

Add entry point in `pyproject.toml`:

```toml
[tool.poetry]
name = "browse-mcp-plugin-myname"
version = "0.1.0"

[tool.poetry.dependencies]
browse-mcp = "^0.1.0"

[tool.poetry.plugins."browse_mcp.searchers"]
my_searcher = "browse_mcp_plugin_myname.searcher:MySearcher"
```

### 4. Update Provider Registry

Add your plugin to `provider.index.json`:

```json
{
  "providers": {
    "custom": {
      "name": "Custom Sources",
      "sources": {
        "my_source": {
          "name": "My Source",
          "description": "Description of my data source",
          "apiKey": "required",
          "documentation": "https://docs.mysource.com"
        }
      }
    }
  }
}
```

### 5. Install Plugin

```bash
cd backend/plugins/browse-mcp-plugin-myname
poetry install
```

The plugin will be automatically discovered on next application start.

---

## Plugin Lifecycle

### Discovery

1. Application starts
2. Stevedore scans `browse_mcp.searchers` namespace
3. All registered entry points are discovered
4. Plugins are loaded and instantiated

### Loading

```python
# In browse_mcp/plugin.py
from stevedore import extension

def discover_searchers():
    """Discover all available searchers (built-in + plugins)."""
    mgr = extension.ExtensionManager(
        namespace='browse_mcp.searchers',
        invoke_on_load=True,
        propagate_map_exceptions=True,
    )

    searchers = {}
    for ext in mgr:
        # ext.name is the entry point name
        # ext.obj is the instantiated searcher
        searchers[ext.name] = ext.obj

    return searchers
```

### Usage

```python
from browse_mcp.plugin import discover_searchers

# Load all searchers
searchers = discover_searchers()

# Use a specific searcher
arxiv = searchers['arxiv']
results = arxiv.search("quantum computing")

# Use a plugin searcher
context7 = searchers['context7_web']
results = context7.search("machine learning")
```

---

## Best Practices

### 1. Naming Convention

**Entry Point Names:**
- Use lowercase with underscores: `my_source`, `web_searcher`
- Be descriptive: `twitter` not `tw`, `semantic_scholar` not `ss`

**Package Names:**
- Follow pattern: `browse-mcp-plugin-{name}`
- Use hyphens, not underscores: `browse-mcp-plugin-context7`

**Module Names:**
- Use underscores: `browse_mcp_plugin_context7`

### 2. Error Handling

Plugins should handle errors gracefully:

```python
class MySearcher(BaseSearcher):
    def search(self, query: str, **kwargs) -> List[Dict]:
        try:
            # Search logic
            return results
        except APIError as e:
            self.logger.error(f"API error: {e}")
            return []
        except Exception as e:
            self.logger.exception(f"Unexpected error: {e}")
            raise
```

### 3. Configuration

Use environment variables for API keys and configuration:

```python
import os

class MySearcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="my_source")
        self.api_key = os.getenv("MY_SOURCE_API_KEY")
        if not self.api_key:
            raise ValueError("MY_SOURCE_API_KEY not set")
```

### 4. Testing

Each plugin should include tests:

```python
# tests/test_searcher.py
import pytest
from browse_mcp_plugin_myname.searcher import MySearcher

def test_search():
    searcher = MySearcher()
    results = searcher.search("test query")
    assert len(results) > 0
    assert "title" in results[0]
```

### 5. Documentation

Include in `README.md`:
- Purpose and supported data sources
- API key requirements
- Installation instructions
- Usage examples
- Rate limits and limitations

---

## Forbidden Patterns

### ❌ Hardcoding API Keys

```python
# Bad
class MySearcher(BaseSearcher):
    api_key = "sk-1234567890abcdef"
```

```python
# Good
class MySearcher(BaseSearcher):
    def __init__(self):
        self.api_key = os.getenv("MY_SOURCE_API_KEY")
```

### ❌ Direct Imports Without Entry Points

```python
# Bad - bypassing plugin system
from browse_mcp_plugin_myname.searcher import MySearcher
searcher = MySearcher()
```

```python
# Good - using plugin discovery
from browse_mcp.plugin import discover_searchers
searchers = discover_searchers()
searcher = searchers['my_searcher']
```

### ❌ Blocking Operations Without Async

```python
# Bad - blocking I/O
def search(self, query: str) -> List[Dict]:
    response = requests.get(url)  # Blocks thread
    return response.json()
```

```python
# Good - async for I/O
async def search(self, query: str) -> List[Dict]:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```

---

## Troubleshooting

### Plugin Not Found

**Symptoms:** Plugin doesn't appear in loaded searchers

**Solutions:**
1. Verify entry point in `pyproject.toml`:
   ```bash
   poetry show browse-mcp-plugin-myname
   ```

2. Check entry point registration:
   ```python
   from stevedore import extension
   mgr = extension.ExtensionManager('browse_mcp.searchers')
   print([ext.name for ext in mgr])
   ```

3. Reinstall plugin:
   ```bash
   cd backend/plugins/browse-mcp-plugin-myname
   poetry install
   ```

### Import Errors

**Symptoms:** `ModuleNotFoundError` when loading plugin

**Solutions:**
1. Ensure plugin package is installed
2. Check import paths in entry point definition
3. Verify `__init__.py` files exist in all package directories

### API Key Issues

**Symptoms:** `ValueError: API_KEY not set`

**Solutions:**
1. Set environment variable:
   ```bash
   export MY_SOURCE_API_KEY="your-key-here"
   ```

2. Add to `.env` file:
   ```
   MY_SOURCE_API_KEY=your-key-here
   ```

3. Check key loading in plugin code

---

## Examples

### Example 1: Context7 Plugin

```python
# browse_mcp_plugin_context7/searcher.py
from browse_mcp.base import BaseSearcher

class Context7Searcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="context7")
        self.api_key = os.getenv("CONTEXT7_API_KEY")

    def search(self, query: str, **kwargs) -> List[Dict]:
        # Context7 API search implementation
        pass
```

```toml
# pyproject.toml
[tool.poetry.plugins."browse_mcp.searchers"]
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
```

### Example 2: Social Media Plugin

```python
# browse_mcp_plugin_social_media/twitter.py
from browse_mcp.base import BaseSearcher

class TwitterSearcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="twitter")
        self.bearer_token = os.getenv("TWITTER_BEARER_TOKEN")

    def search(self, query: str, **kwargs) -> List[Dict]:
        # Twitter API v2 search implementation
        pass
```

```toml
# pyproject.toml
[tool.poetry.plugins."browse_mcp.searchers"]
twitter = "browse_mcp_plugin_social_media.twitter:TwitterSearcher"
linkedin = "browse_mcp_plugin_social_media.linkedin:LinkedInSearcher"
```

---

## References

- **Stevedore Documentation**: https://docs.openstack.org/stevedore/latest/
- **Plugin Implementation**: `backend/browse-mcp/browse_mcp/plugin.py`
- **Base Searcher**: `backend/browse-mcp/browse_mcp/base.py`
- **Provider Registry**: `provider.index.json`
- **Example Plugins**: `backend/plugins/`

---

**Last Updated:** 2026-02-03
