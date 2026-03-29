---
sidebar_position: 12
title: Provider System
description: Viben pluggable provider architecture for data sources and marketplace
---

# Provider System

> Documentation for Viben's pluggable provider architecture, including the provider registry, marketplace integration, and plugin system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Provider Registry](#provider-registry)
3. [Hierarchical Naming](#hierarchical-naming)
4. [Frontend Types](#frontend-types)
5. [Backend API](#backend-api)
6. [useMarketplace Hook](#usemarketplace-hook)
7. [Plugin System](#plugin-system)
8. [API Key Management](#api-key-management)
9. [Adding New Plugins](#adding-new-plugins)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Viben uses a **pluggable provider architecture** with two types of providers:

| Provider Type | Location | Description | Registry Flag |
|---------------|----------|-------------|---------------|
| **Built-in Plugins** | `backend/browse-mcp` | Core academic/research data sources maintained by the Viben team | `builtin: true` |
| **Third-party Plugins** | `backend/plugins/*` | Community extensions installable via Python packages | `builtin: false` |

### How It Works

1. **Plugin Discovery**: Plugins register via stevedore entry points in `pyproject.toml`
2. **Runtime Loading**: Application discovers all registered searchers at startup
3. **UI Metadata**: `provider.index.json` provides display information for the frontend
4. **Marketplace**: Users can browse, install, and configure data sources

---

## Provider Registry

The `provider.index.json` file serves as a centralized catalog of all available plugins and their data sources.

### V2 Schema Structure

The current v2 schema is **plugin-centric** rather than category-centric:

```json
{
  "version": "2.0.0",
  "updated_at": "2026-02-03T00:00:00Z",
  "categories": {
    "academic": {
      "name": "Academic Sources",
      "description": "Research databases and preprint servers",
      "icon": "graduation-cap"
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
    }
  }
}
```

### Categories

Categories organize sources in the UI:

| Category ID | Name | Icon | Description |
|-------------|------|------|-------------|
| `academic` | Academic Sources | graduation-cap | Research databases and preprints |
| `publisher` | Publisher Sources | book-open | Commercial publisher APIs |
| `institutional` | Institutional Sources | building | University and library repos |
| `web` | Web Sources | globe | Web-based search engines |
| `social` | Social Media | users | Social media platforms |
| `docs` | Documentation | file-text | Documentation and knowledge bases |

Third-party plugins can define custom categories as needed.

### V1 to V2 Migration

| V1 (Old) | V2 (Current) | Reason |
|----------|--------------|--------|
| `providers` (category-based) | `plugins` (package-based) | Plugins are the installable units |
| Category = provider | Category = metadata | Categories are for grouping only |
| Flat `author` string | Rich `author` object | More metadata for marketplace |
| No `builtin` flag | `builtin: true/false` | Distinguish core vs third-party |
| No `package` field | `package` for installable plugins | Enable pip install from marketplace |
| No `category` on sources | `category` per source | Fine-grained categorization |

The backend automatically converts v1 schema to v2 format for backward compatibility.

---

## Hierarchical Naming

All data sources use a hierarchical naming format:

```
{plugin_id}/{source_id}
```

### Examples

| Plugin Package | Source ID | Full Name |
|----------------|-----------|-----------|
| browse-mcp | arxiv | `browse-mcp/arxiv` |
| browse-mcp | pubmed | `browse-mcp/pubmed` |
| browse-mcp-plugin-social-media | zhihu | `browse-mcp-plugin-social-media/zhihu` |

### Concept Relationships

| Concept | Definition | Example |
|---------|------------|---------|
| **Plugin** | Package providing one or more data sources | `browse-mcp`, `browse-mcp-plugin-social-media` |
| **Source** | Individual data source within a plugin | `arxiv`, `pubmed` |
| **Entry Point** | Python registration name for runtime loading | `arxiv`, `context7_web` |
| **Full Name** | Hierarchical identifier | `browse-mcp/arxiv` |

### Hierarchy Structure

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

## Frontend Types

The frontend uses the following TypeScript types for marketplace data.

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

The Tauri backend provides these commands for marketplace data.

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

The `useMarketplace` hook provides convenient access to marketplace data.

### Usage

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

### Computed Properties

| Property | Description |
|----------|-------------|
| `builtinPlugins` | Plugins with `builtin: true` |
| `thirdPartyPlugins` | Plugins with `builtin: false` |
| `pluginsByCategory` | Plugins grouped by category ID |
| `apiKeyRequiredSources` | Sources requiring an API key |
| `apiKeyOptionalSources` | Sources with optional API key |
| `freeSources` | Sources that work without API key |

### Helper Functions

| Function | Description |
|----------|-------------|
| `getSource(id)` | Get a source by full ID (e.g., `browse-mcp/arxiv`) |
| `getPlugin(id)` | Get a plugin by ID |
| `getCategory(id)` | Get a category by ID |
| `searchSources(query)` | Search sources by name/description |
| `searchPlugins(query)` | Search plugins by name/description |

---

## Plugin System

### Plugin Discovery via Entry Points

Plugins register themselves via **stevedore entry points** in `pyproject.toml`:

```toml
[tool.poetry.plugins."browse_mcp.searchers"]
arxiv = "browse_mcp.sources.arxiv:ArxivSearcher"
context7_web = "browse_mcp_plugin_context7.searcher:Context7Searcher"
```

### Runtime Loading

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

### Provider Metadata vs Runtime Code

| Component | Source | Purpose |
|-----------|--------|---------|
| `provider.index.json` | UI metadata | Display names, descriptions, API key requirements, documentation links |
| Entry point system | Runtime code | Actual searcher implementations, API integration logic |

### Built-in Sources

Located in `backend/browse-mcp/browse_mcp/sources/`:

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

---

## API Key Management

### Configuration

API keys are stored securely using the system keychain via the Tauri backend.

### API Key Types

| Type | Badge | UI Behavior |
|------|-------|-------------|
| `none` | Green "Free" | Source works without any API key |
| `optional` | Blue "Optional" | Works without key, enhanced with key |
| `required` | Amber "Required" | Must have key to function |

### Registry Format

```json
{
  "apiKey": "none",      // No API key needed
  "apiKey": "optional",  // Works without key, better with key
  "apiKey": "required"   // Must have key to function
}
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

## Best Practices

### Naming Consistency

| Component | Format | Example |
|-----------|--------|---------|
| Plugin ID | `browse-mcp-plugin-{name}` | `browse-mcp-plugin-social-media` |
| Source ID | Lowercase with underscores | `google_scholar` |
| Category ID | Lowercase | `academic`, `publisher` |

### Plugin Metadata Checklist

Always include:
- **name**: Human-readable plugin name
- **description**: What the plugin provides
- **version**: Semantic version
- **author**: At minimum the name
- **categories**: At least one category
- **builtin**: `true` for core, `false` for third-party

### Source Metadata Checklist

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

## Related

- [Marketplace Publish Flow](./marketplace-publish-flow.md)
- [Component Guide](./components.md)
- [Hook Guidelines](./hook-guidelines.md)

---

**Last Updated**: 2026-03-28
**Schema Version**: 2.0.0
