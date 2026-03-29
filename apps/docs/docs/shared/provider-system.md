# Provider System Documentation

This document explains the Viben provider architecture and how `provider.index.json` relates to the plugin system.

---

## Architecture Overview

Viben uses a **pluggable provider architecture** with two types of providers:

1. **Built-in Plugins** (`backend/browse-mcp`)
   - Core academic/research data sources
   - Maintained by the Viben team
   - Installed by default
   - Marked with `builtin: true` in the registry

2. **Third-party Plugins** (`backend/plugins/*`)
   - Community extensions
   - Installable via Python packages
   - Discovered automatically via entry points
   - Marked with `builtin: false` in the registry

---

## Provider Registry (`provider.index.json`)

This file serves as a **centralized catalog** of all available plugins and their data sources.

### V2 Schema (Current)

The v2 schema is **plugin-centric** rather than category-centric:

```json
{
  "version": "2.0.0",
  "updated_at": "2026-02-03T00:00:00Z",
  "categories": {
    "academic": {
      "name": "Academic Sources",
      "description": "Research databases and preprint servers",
      "icon": "graduation-cap"
    },
    "publisher": {
      "name": "Publisher Sources",
      "description": "Commercial publisher APIs",
      "icon": "book-open"
    }
  },
  "plugins": {
    "browse-mcp": {
      "name": "Viben Core",
      "description": "Core academic and research data sources",
      "version": "0.1.0",
      "author": {
        "name": "LinXueyuanStdio",
        "email": "linxueyuanstdio@gmail.com",
        "url": "https://github.com/LinXueyuanStdio"
      },
      "homepage": "https://github.com/LinXueyuanStdio/viben",
      "repository": "https://github.com/LinXueyuanStdio/viben",
      "license": "MIT",
      "categories": ["academic", "publisher", "institutional", "web"],
      "builtin": true,
      "sources": {
        "arxiv": {
          "name": "arXiv",
          "description": "Pre-prints in physics, mathematics, computer science",
          "category": "academic",
          "apiKey": "none",
          "documentation": "https://arxiv.org/help/api"
        }
      }
    },
    "browse-mcp-plugin-social-media": {
      "name": "Social Media Sources",
      "description": "Search and retrieve content from social media platforms",
      "version": "0.1.0",
      "author": {
        "name": "LinXueyuanStdio"
      },
      "categories": ["social"],
      "builtin": false,
      "package": "browse-mcp-plugin-social-media",
      "sources": {
        "zhihu": {
          "name": "Zhihu",
          "description": "Chinese Q&A platform",
          "category": "social",
          "apiKey": "none"
        }
      }
    }
  }
}
```

### Key Differences from V1

| V1 (Old) | V2 (Current) | Reason |
|----------|--------------|--------|
| `providers` (category-based) | `plugins` (package-based) | Plugins are the installable units |
| Category = provider | Category = metadata | Categories are for grouping only |
| Flat `author` string | Rich `author` object | More metadata for marketplace |
| No `builtin` flag | `builtin: true/false` | Distinguish core vs third-party |
| No `package` field | `package` for installable plugins | Enable pip install from marketplace |
| No `category` on sources | `category` per source | Fine-grained categorization |

### Categories

Categories are metadata for organizing sources in the UI:

| Category ID | Name | Icon | Description |
|-------------|------|------|-------------|
| `academic` | Academic Sources | graduation-cap | Research databases and preprints |
| `publisher` | Publisher Sources | book-open | Commercial publisher APIs |
| `institutional` | Institutional Sources | building | University and library repos |
| `web` | Web Sources | globe | Web-based search engines |
| `social` | Social Media | users | Social media platforms |
| `docs` | Documentation | file-text | Documentation and knowledge bases |

**Third-party plugins can define custom categories** as needed.

---

## Hierarchical Naming

All data sources use a hierarchical naming format:

```
{plugin_id}/{source_id}
```

**Examples:**

| Plugin Package | Source ID | Full Name |
|----------------|-----------|-----------|
| browse-mcp | arxiv | `browse-mcp/arxiv` |
| browse-mcp | pubmed | `browse-mcp/pubmed` |
| browse-mcp-plugin-social-media | zhihu | `browse-mcp-plugin-social-media/zhihu` |

---

## Frontend Types

The frontend uses the following TypeScript types:

### MarketplaceCategory

```typescript
interface MarketplaceCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  plugin_count: number;
  source_count: number;
}
```

### MarketplacePlugin

```typescript
interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  version?: string;
  author_name: string;
  author_email?: string;
  author_url?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  categories: string[];
  builtin: boolean;
  package?: string;
  source_count: number;
  sources: string[];
}
```

### FlatSource

```typescript
interface FlatSource {
  id: string;           // plugin/source (e.g., "browse-mcp/arxiv")
  source_name: string;  // flat name (e.g., "arxiv")
  plugin_id: string;    // plugin ID (e.g., "browse-mcp")
  name: string;         // display name
  description: string;
  category?: string;    // category ID
  api_key_type: "none" | "optional" | "required";
  documentation?: string;
  plugin_name: string;  // plugin display name
}
```

---

## Backend API

The Tauri backend provides these commands:

### get_provider_index

Returns the full provider index with categories and plugins.

```typescript
const index = await invoke<ProviderIndex>("get_provider_index", {
  forceRefresh: false
});
```

### get_flat_sources

Returns all sources as a flat list for the Built-in Sources tab.

```typescript
const sources = await invoke<FlatSource[]>("get_flat_sources");
```

### get_sources_by_category

Returns sources grouped by category.

```typescript
const byCategory = await invoke<Record<string, FlatSource[]>>("get_sources_by_category");
```

### get_sources_by_plugin

Returns sources grouped by plugin.

```typescript
const byPlugin = await invoke<Record<string, FlatSource[]>>("get_sources_by_plugin");
```

### clear_provider_cache

Clears the local cache of the provider index.

```typescript
await invoke("clear_provider_cache");
```

---

## useMarketplace Hook

The `useMarketplace` hook provides convenient access to marketplace data:

```typescript
const {
  // Data
  index,           // Full provider index
  sources,         // Flat source list
  plugins,         // Plugin list
  categories,      // Category list
  loading,
  error,

  // Computed
  builtinPlugins,
  thirdPartyPlugins,
  pluginsByCategory,
  apiKeyRequiredSources,
  apiKeyOptionalSources,
  freeSources,

  // Actions
  refresh,
  clearCache,

  // Helpers
  getSource,
  getPlugin,
  getCategory,
  searchSources,
  searchPlugins,
} = useMarketplace();
```

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

## Built-in Plugins

### Location

```
backend/browse-mcp/browse_mcp/sources/
```

### Sources (18+)

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

### Entry Point Registration

Built-in sources are registered in `backend/browse-mcp/pyproject.toml`:

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
arxiv = "browse_mcp.sources.arxiv:ArxivSearcher"
pubmed = "browse_mcp.sources.pubmed:PubMedSearcher"
# ... (18+ more)
```

---

## Adding New Plugins

### Adding a Built-in Source

1. **Create implementation** in `backend/browse-mcp/browse_mcp/sources/`
2. **Register entry point** in `pyproject.toml`
3. **Update provider.index.json**:

```json
{
  "plugins": {
    "browse-mcp": {
      "sources": {
        "newsource": {
          "name": "New Source",
          "description": "Description here",
          "category": "academic",
          "apiKey": "none",
          "documentation": "https://..."
        }
      }
    }
  }
}
```

### Creating a Third-party Plugin

1. **Create plugin package** in `backend/plugins/`
2. **Implement searcher class**
3. **Register entry points**
4. **Add to provider.index.json**:

```json
{
  "plugins": {
    "browse-mcp-plugin-myplugin": {
      "name": "My Plugin",
      "description": "Custom data sources",
      "version": "0.1.0",
      "author": {
        "name": "Your Name"
      },
      "categories": ["custom"],
      "builtin": false,
      "package": "browse-mcp-plugin-myplugin",
      "sources": {
        "mysource": {
          "name": "My Source",
          "description": "Description",
          "category": "custom",
          "apiKey": "optional"
        }
      }
    }
  }
}
```

---

## Plugin vs Source vs Entry Point

| Concept | Definition | Example |
|---------|------------|---------|
| **Plugin** | Package providing one or more data sources | `browse-mcp`, `browse-mcp-plugin-social-media` |
| **Source** | Individual data source within a plugin | `arxiv`, `pubmed` |
| **Entry Point** | Python registration name for runtime loading | `arxiv`, `context7_web` |
| **Full Name** | Hierarchical identifier | `browse-mcp/arxiv`, `browse-mcp-plugin-social-media/zhihu` |

### Relationship

```
Plugin Package (browse-mcp-plugin-social-media)
├── Source: zhihu
│   ├── Entry Point: zhihu
│   ├── Full Name: browse-mcp-plugin-social-media/zhihu
│   └── Class: ZhihuSearcher
└── Source: weibo
    ├── Entry Point: weibo
    ├── Full Name: browse-mcp-plugin-social-media/weibo
    └── Class: WeiboSearcher
```

---

## API Key Management

### Configuration

API keys are stored securely using the system keychain via the Tauri backend.

### Indicating in Registry

```json
{
  "apiKey": "none",      // No API key needed
  "apiKey": "optional",  // Works without key, better with key
  "apiKey": "required"   // Must have key to function
}
```

### UI Behavior

- **none**: Source shown as "Free" with green badge
- **optional**: Source shown as "Optional" with blue badge
- **required**: Source shown as "Required" with amber badge

---

## Backward Compatibility

The backend automatically handles v1 schema by converting it to v2 format:

- V1 `providers` (categories) are converted to virtual plugins
- Each v1 provider becomes a plugin with `builtin: true`
- Sources retain their original structure

This ensures existing deployments continue to work until updated.

---

## Best Practices

### Naming Consistency

| Component | Format | Example |
|-----------|--------|---------|
| Plugin ID | `browse-mcp-plugin-{name}` | `browse-mcp-plugin-social-media` |
| Source ID | Lowercase with underscores | `google_scholar` |
| Category ID | Lowercase | `academic`, `publisher` |

### Plugin Metadata

Always include:
- **name**: Human-readable plugin name
- **description**: What the plugin provides
- **version**: Semantic version
- **author**: At minimum the name
- **categories**: At least one category
- **builtin**: `true` for core, `false` for third-party

### Source Metadata

Always include:
- **name**: Human-readable source name
- **description**: What the source provides
- **category**: Category ID
- **apiKey**: Key requirement level
- **documentation**: Official documentation URL (if available)

### Error Handling

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

### Testing

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

1. Check the API key is configured in Settings > Data Sources
2. Verify the source requires API key (`apiKey: "required"`)
3. Restart application after configuring API keys

---

## References

- **Plugin Architecture:** `docs/specs/backend/plugin-architecture.md`
- **Directory Structure:** `docs/specs/backend/directory-structure.md`
- **Provider Registry:** `provider.index.json`
- **Stevedore Documentation:** https://docs.openstack.org/stevedore/latest/

---

**Last Updated:** 2026-02-03
**Schema Version:** 2.0.0
