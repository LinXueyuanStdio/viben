# Plugin Marketplace and API Logs

## Goal

Implement a plugin marketplace system for browse-mcp with:
1. Centralized plugin index (`provider.index.json`)
2. Hierarchical data source naming `{provider}/{data_source_name}`
3. API logging in JSONL format
4. Enhanced Data Source page with marketplace UI

## Requirements

### 1. provider.index.json Schema (Project Root)

Create a plugin marketplace index file with:
- Provider metadata (name, description, version, author, homepage)
- List of data sources per provider with `{provider}/{data_source_name}` naming
- API key requirements (required/optional/none)
- Online link: https://github.com/LinXueyuanStdio/browse-mcp/raw/refs/heads/main/provider.index.json

```json
{
  "version": "1.0.0",
  "providers": {
    "academic": {
      "name": "Academic Sources",
      "description": "Academic paper search sources",
      "author": "browse-mcp",
      "sources": {
        "arxiv": { "name": "arXiv", "apiKey": "none" },
        "pubmed": { "name": "PubMed", "apiKey": "none" },
        "semantic": { "name": "Semantic Scholar", "apiKey": "optional" }
      }
    }
  }
}
```

### 2. Refactor browse-mcp Data Source Naming

Update Python backend to use `{provider}/{data_source_name}` naming:
- Entry points in `pyproject.toml`: `academic/arxiv`, `academic/pubmed`, etc.
- Plugin manager to handle hierarchical naming
- Backward compatibility with flat names for existing users

### 3. API Logging in JSONL Format

Add API request/response logging:
- Log file: `{logs_dir}/api/{run_id}.jsonl`
- Each line is a JSON object with:
  - `timestamp`: ISO 8601 timestamp
  - `api_key_hash`: SHA256 hash of first 8 chars (for privacy)
  - `provider`: Provider name
  - `source`: Data source name
  - `method`: `search`, `download`, `read`
  - `request`: Request parameters (sanitized)
  - `response`: Response summary (count, status)
  - `latency_ms`: Request duration
  - `status`: `success`, `error`
  - `error`: Error message if failed

### 4. Rust Backend Updates

Add commands for:
- `get_provider_index`: Fetch and cache provider.index.json
- `get_api_logs`: Read API JSONL logs for a session
- `get_api_log_summary`: Aggregate statistics

### 5. Data Source Page Redesign

Update UI to show plugin marketplace:
- Provider cards grouped by category
- Click provider → expand to show:
  - Provider description, author, version
  - List of data sources (`{provider}/{source}`)
  - API key configuration (button for all, including optional)
- Search/filter functionality
- Installed vs available indicators

### 6. API Logs Tab Implementation

Complete the placeholder in logs.tsx:
- Terminal-style display matching server logs
- Columns: timestamp, provider/source, method, latency, status
- Filtering by provider, status, date range
- Click to expand request/response details

## Acceptance Criteria

- [ ] `provider.index.json` created at project root with all current providers
- [ ] Browse-mcp uses `{provider}/{source}` naming internally
- [ ] API calls logged to JSONL files
- [ ] Desktop app can fetch and display provider index
- [ ] Data Source page shows provider marketplace UI
- [ ] API key buttons work for optional API key providers
- [ ] API Logs tab displays JSONL logs with filtering
- [ ] All lint/typecheck passes

## Technical Notes

### File Locations

**New Files:**
- `/provider.index.json` - Plugin marketplace schema
- `/apps/desktop/src-tauri/src/commands/marketplace.rs` - Rust marketplace commands
- `/apps/desktop/src/hooks/use-marketplace.ts` - React marketplace hook

**Modified Files:**
- Python: `plugin.py`, `__main__.py`, `pyproject.toml`
- Rust: `logs.rs`, `mcp.rs`, `mod.rs`
- React: `providers.tsx`, `logs.tsx`, `app-store.ts`, `use-logs.ts`

### Cross-Layer Data Flow

```
provider.index.json (static)
       ↓
[Remote URL or Local File]
       ↓
Rust: get_provider_index command (fetch + cache)
       ↓
React: useMarketplace hook
       ↓
UI: Provider cards, Data source list
```

### Naming Convention Migration

| Current | New |
|---------|-----|
| `arxiv` | `academic/arxiv` |
| `pubmed` | `academic/pubmed` |
| `google_scholar` | `web/google_scholar` |
| `iacr` | `academic/iacr` |

## Dependencies

This task depends on:
- Existing stevedore plugin system (completed)
- Existing logs system (logs.rs, use-logs.ts)
