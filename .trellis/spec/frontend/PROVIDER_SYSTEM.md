# Provider System Documentation

This document explains the Browse MCP provider architecture and how `provider.index.json` relates to the plugin system.

---

## Architecture Overview

Browse MCP uses a **pluggable provider architecture** with two types of providers:

1. **Built-in Providers** (`backend/browse-mcp`)
   - Core academic/research data sources
   - Maintained by the Browse MCP team
   - Installed by default

2. **Plugin Providers** (`backend/plugins/*`)
   - Third-party extensions
   - Installable via Python packages
   - Discovered automatically via entry points

---

## Provider Registry (`provider.index.json`)

This file serves as a **centralized catalog** of all available data sources, regardless of whether they are built-in or plugins.

### Structure

```json
{
  "version": "1.0.0",
  "updated_at": "2025-02-02T00:00:00Z",
  "providers": {
    "category_name": {
      "name": "Display Name",
      "description": "Category description",
      "author": "provider-package-name",
      "homepage": "https://...",
      "sources": {
        "source_id": {
          "name": "Display Name",
          "description": "What this source provides",
          "apiKey": "none" | "optional" | "required",
          "documentation": "https://..."
        }
      }
    }
  }
}
```

### Categories

| Category | Description | Provider |
|----------|-------------|----------|
| `academic` | Research databases and preprint servers | browse-mcp |
| `publisher` | Publisher-specific APIs (IEEE, Springer, etc.) | browse-mcp |
| `institutional` | Institutional access sources (JSTOR, WoS) | browse-mcp |
| `web` | General web search (Google Scholar) | browse-mcp |

**Plugin categories should use custom names** to avoid conflicts with built-in categories.

---

## Hierarchical Naming

All data sources use a hierarchical naming format:

```
{provider}/{source_id}
```

**Examples:**

| Provider Package | Source ID | Full Name |
|------------------|-----------|-----------|
| browse-mcp | arxiv | `browse-mcp/arxiv` |
| browse-mcp | pubmed | `browse-mcp/pubmed` |
| browse-mcp-plugin-context7 | web | `context7/web` |
| browse-mcp-plugin-social-media | twitter | `social-media/twitter` |

### Mapping Rules

1. **Built-in sources**: Use `browse-mcp` as provider prefix
2. **Plugin sources**: Use plugin package name (without `browse-mcp-plugin-` prefix)
3. **Source ID**: Use the `source_id` from `provider.index.json`

---

## How Providers are Loaded

### 1. Plugin Discovery (Entry Points)

Plugins register themselves via **stevedore entry points** in `pyproject.toml`:

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
arxiv = "browse_mcp.sources.arxiv:ArxivSearcher"
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
```

### 2. Runtime Loading

At application startup:

```python
from stevedore import extension

# Discover all registered searchers (built-in + plugins)
mgr = extension.ExtensionManager(
    namespace='browse_mcp.searchers',
    invoke_on_load=True,
)

# Create searcher registry
searchers = {ext.name: ext.obj for ext in mgr}
```

### 3. Provider Metadata

The `provider.index.json` provides **UI metadata**:
- Display names
- Descriptions
- API key requirements
- Documentation links

The entry point system provides **runtime code**:
- Actual searcher implementations
- API integration logic

---

## Built-in Providers

### Location

```
backend/browse-mcp/browse_mcp/sources/
```

### Sources (20+)

| Source File | Source ID | API Key | Category |
|-------------|-----------|---------|----------|
| arxiv.py | arxiv | none | academic |
| pubmed.py | pubmed | none | academic |
| pmc.py | pmc | none | academic |
| biorxiv.py | biorxiv | none | academic |
| medrxiv.py | medrxiv | none | academic |
| semantic.py | semantic | optional | academic |
| core.py | core | optional | academic |
| crossref.py | crossref | none | academic |
| iacr.py | iacr | none | academic |
| acm.py | acm | none | academic |
| ieee.py | ieee | required | publisher |
| sciencedirect.py | sciencedirect | required | publisher |
| springer.py | springer | required | publisher |
| scopus.py | scopus | required | publisher |
| google_scholar.py | google_scholar | none | web |
| jstor.py | jstor | none | institutional |
| researchgate.py | researchgate | none | institutional |
| wos.py | wos | none | institutional |
| sci_hub.py | sci_hub | none | web |
| hub.py | hub | none | web |

### Entry Point Registration

Built-in sources are registered in `backend/browse-mcp/pyproject.toml`:

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
arxiv = "browse_mcp.sources.arxiv:ArxivSearcher"
pubmed = "browse_mcp.sources.pubmed:PubMedSearcher"
# ... (20+ more)
```

---

## Plugin Providers

### Available Plugins

| Plugin Package | Sources | Category |
|----------------|---------|----------|
| browse-mcp-plugin-context7 | web | custom |
| browse-mcp-plugin-social-media | twitter, linkedin | custom |

### Plugin Structure

```
backend/plugins/browse-mcp-plugin-{name}/
├── browse_mcp_plugin_{name}/
│   ├── __init__.py
│   └── searcher.py
├── pyproject.toml
├── README.md
└── tests/
```

### Entry Point Pattern

```toml
[tool.poetry]
name = "browse-mcp-plugin-{name}"

[tool.poetry.plugins."browse_mcp.searchers"]
{name}_{source} = "browse_mcp_plugin_{name}.searcher:SearcherClass"
```

---

## Adding New Providers

### Adding a Built-in Source

1. **Create implementation:**
   ```python
   # backend/browse-mcp/browse_mcp/sources/newsource.py
   from browse_mcp.base import BaseSearcher

   class NewSourceSearcher(BaseSearcher):
       def __init__(self):
           super().__init__(name="newsource")

       def search(self, query: str, **kwargs):
           # Implementation
           pass
   ```

2. **Register entry point:**
   ```toml
   # backend/browse-mcp/pyproject.toml
   [tool.poetry.plugins."browse_mcp.searchers"]
   newsource = "browse_mcp.sources.newsource:NewSourceSearcher"
   ```

3. **Update provider registry:**
   ```json
   {
     "providers": {
       "academic": {
         "sources": {
           "newsource": {
             "name": "New Source",
             "description": "Description here",
             "apiKey": "none",
             "documentation": "https://..."
           }
         }
       }
     }
   }
   ```

### Creating a Plugin Provider

1. **Create plugin package:**
   ```bash
   mkdir -p backend/plugins/browse-mcp-plugin-myplugin/browse_mcp_plugin_myplugin
   cd backend/plugins/browse-mcp-plugin-myplugin
   poetry init
   ```

2. **Implement searcher:**
   ```python
   # browse_mcp_plugin_myplugin/searcher.py
   from browse_mcp.base import BaseSearcher

   class MyPluginSearcher(BaseSearcher):
       def __init__(self):
           super().__init__(name="myplugin")

       def search(self, query: str, **kwargs):
           # Implementation
           pass
   ```

3. **Register entry point:**
   ```toml
   # pyproject.toml
   [tool.poetry.plugins."browse_mcp.searchers"]
   myplugin_web = "browse_mcp_plugin_myplugin.searcher:MyPluginSearcher"
   ```

4. **Update provider registry:**
   ```json
   {
     "providers": {
       "custom": {
         "name": "Custom Sources",
         "description": "Third-party data sources",
         "author": "browse-mcp-plugin-myplugin",
         "homepage": "https://...",
         "sources": {
           "myplugin_web": {
             "name": "My Plugin",
             "description": "Custom data source",
             "apiKey": "optional",
             "documentation": "https://..."
           }
         }
       }
     }
   }
   ```

5. **Install plugin:**
   ```bash
   poetry install
   ```

---

## Provider vs Source vs Entry Point

| Concept | Definition | Example |
|---------|------------|---------|
| **Provider** | Package providing one or more data sources | `browse-mcp`, `context7` |
| **Source** | Individual data source within a provider | `arxiv`, `pubmed` |
| **Entry Point** | Python registration name for runtime loading | `arxiv`, `context7_web` |
| **Full Name** | Hierarchical identifier | `browse-mcp/arxiv`, `context7/web` |

### Relationship

```
Provider Package (browse-mcp-plugin-social-media)
├── Source: twitter
│   ├── Entry Point: twitter
│   ├── Full Name: social-media/twitter
│   └── Class: TwitterSearcher
└── Source: linkedin
    ├── Entry Point: linkedin
    ├── Full Name: social-media/linkedin
    └── Class: LinkedInSearcher
```

---

## API Key Management

### Configuration

API keys are managed via **environment variables**:

```bash
# .env
SEMANTIC_SCHOLAR_API_KEY=your-key-here
IEEE_API_KEY=your-key-here
CONTEXT7_API_KEY=your-key-here
```

### Loading in Code

```python
import os

class MySearcher(BaseSearcher):
    def __init__(self):
        super().__init__(name="mysource")
        self.api_key = os.getenv("MY_SOURCE_API_KEY")
        if not self.api_key:
            raise ValueError("MY_SOURCE_API_KEY environment variable not set")
```

### Indicating in Registry

```json
{
  "apiKey": "none",      // No API key needed
  "apiKey": "optional",  // Works without key, better with key
  "apiKey": "required"   // Must have key to function
}
```

---

## Best Practices

### 1. Naming Consistency

| Component | Format | Example |
|-----------|--------|---------|
| Package | `browse-mcp-plugin-{name}` | `browse-mcp-plugin-context7` |
| Module | `browse_mcp_plugin_{name}` | `browse_mcp_plugin_context7` |
| Entry Point | `{short_name}_{source}` | `context7_web` |
| Source ID | Lowercase with underscores | `google_scholar` |

### 2. Provider Metadata

Always include in `provider.index.json`:
- **name**: Human-readable display name
- **description**: What the source provides
- **apiKey**: Key requirement level
- **documentation**: Official API/source documentation

### 3. Error Handling

Searchers should fail gracefully:

```python
def search(self, query: str, **kwargs):
    try:
        # API call
        return results
    except APIError as e:
        self.logger.error(f"API error: {e}")
        return []  # Return empty results, don't crash
```

### 4. Testing

Each provider should include tests:

```python
def test_search():
    searcher = MySearcher()
    results = searcher.search("test query")
    assert len(results) > 0
    assert "title" in results[0]
```

---

## Troubleshooting

### Plugin Not Loading

**Check entry point registration:**
```bash
cd backend/plugins/browse-mcp-plugin-{name}
poetry show
```

**List all discovered plugins:**
```python
from stevedore import extension
mgr = extension.ExtensionManager('browse_mcp.searchers')
print([ext.name for ext in mgr])
```

### Source Not in UI

1. Check `provider.index.json` includes the source
2. Verify the source ID matches the entry point name
3. Restart the application to reload the registry

### API Key Issues

1. Check environment variable is set: `echo $MY_SOURCE_API_KEY`
2. Verify variable name matches code
3. Restart application after setting environment variables

---

## References

- **Plugin Architecture:** `.trellis/spec/backend/plugin-architecture.md`
- **Directory Structure:** `.trellis/spec/backend/directory-structure.md`
- **Provider Registry:** `provider.index.json`
- **Stevedore Documentation:** https://docs.openstack.org/stevedore/latest/

---

**Last Updated:** 2026-02-03
