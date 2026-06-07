# Browse Plugin: Google Search

Example local Browse SDK plugin that adds a `google_search` source to the
gateway browse MCP server.

The SDK discovers this plugin from the repository root `plugins/` directory.
When the gateway starts the TypeScript browse MCP server, `BrowseClient` loads
the source through `createDefaultSources()`.

## Environment

To return real Google Custom Search results, set:

```bash
export GOOGLE_SEARCH_API_KEY="..."
export GOOGLE_SEARCH_CX="..."
```

Without those variables, the source returns a configuration result explaining
which variables are required.

## Example

Use the MCP `browse_search` tool with:

```json
{
  "query_list": [
    {
      "searcher": "google_search",
      "query": "Viben AI",
      "max_results": 3
    }
  ]
}
```
