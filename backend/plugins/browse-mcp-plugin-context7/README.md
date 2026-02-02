# Browse-MCP Context7 Plugin

A plugin for [browse-mcp](https://github.com/LinXueyuanStdio/browse-mcp) that provides up-to-date library/framework documentation through the [Context7](https://context7.com) service.

## Features

- **Semantic Search**: Search across library documentation using natural language queries
- **Up-to-date Content**: Get the latest documentation directly from source repositories
- **Code Examples**: Retrieve relevant code snippets and examples
- **Wide Library Support**: Access documentation for popular libraries and frameworks

## Installation

### From PyPI (when published)

```bash
pip install browse-mcp-plugin-context7
```

### From Source

```bash
cd backend/plugins/browse-mcp-plugin-context7
pip install -e .
```

## Configuration

Set the optional API key for higher rate limits:

```bash
export CONTEXT7_API_KEY="your_api_key"
```

Without an API key, the plugin will still work but may be subject to rate limiting.

## Usage

Once installed, the searcher is automatically discovered by browse-mcp.

### Basic Search

```python
from browse_mcp import paper_search

# Search for Next.js documentation
results = paper_search([
    {"searcher": "context7", "query": "next.js", "max_results": 5}
])

# Search for React hooks documentation
results = paper_search([
    {"searcher": "context7", "query": "react hooks", "max_results": 3}
])
```

### Topic-Filtered Search

```python
# Search with topic filter
results = paper_search([
    {
        "searcher": "context7",
        "query": "next.js",
        "topic": "routing",
        "max_results": 5
    }
])
```

### Direct Library Search

```python
# Search within a specific library
results = paper_search([
    {
        "searcher": "context7",
        "query": "data fetching",
        "library_id": "/vercel/next.js",
        "max_results": 5
    }
])
```

### Multiple Library Search

```python
# Search across multiple libraries
results = paper_search([
    {"searcher": "context7", "query": "react", "max_results": 3},
    {"searcher": "context7", "query": "vue", "max_results": 3},
    {"searcher": "context7", "query": "svelte", "max_results": 3},
])
```

## Search Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | str | required | Search query (library name or topic) |
| `max_results` | int | 5 | Maximum number of results to return |
| `tokens` | int | 10000 | Maximum tokens per documentation result |
| `topic` | str | None | Optional topic filter (e.g., "routing", "authentication") |
| `library_id` | str | None | Optional specific library ID to search within |

## Content ID Format

When using `download()` and `read()` methods, the content ID format is:

- `{library_id}` - e.g., `/vercel/next.js`
- `{library_id}:{topic}` - e.g., `/vercel/next.js:routing`

## LibraryDoc Data Structure

The searcher returns `LibraryDoc` objects with the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `library_id` | str | Context7 library ID (e.g., "/vercel/next.js") |
| `library_name` | str | Human-readable library name |
| `title` | str | Documentation section title |
| `content` | str | Documentation text content |
| `code_examples` | List[str] | Code snippets and examples |
| `url` | str | Source URL for the documentation |
| `version` | Optional[str] | Library version |
| `topic` | Optional[str] | Topic filter used |
| `description` | Optional[str] | Library description |
| `trust_score` | Optional[float] | Context7 trust score |
| `extra` | Dict | Additional metadata |

## Controlling the Searcher

Use environment variables to control whether the searcher is enabled:

```bash
# Enable only context7 and other specific sources
export BROWSE_MCP_ENABLED_SOURCES="context7,arxiv"

# Or disable specific sources while keeping context7
export BROWSE_MCP_DISABLED_SOURCES="twitter"
```

## Development

### Project Structure

```
context7_searcher/
├── __init__.py      # Package initialization and exports
├── types.py         # LibraryDoc dataclass definition
├── context7.py      # Main Context7Searcher implementation
└── client.py        # HTTP client for Context7 API
```

### Running Tests

```bash
cd backend/plugins/browse-mcp-plugin-context7
pytest
```

### Code Style

The project uses `ruff` for linting and formatting:

```bash
ruff check context7_searcher/
ruff format context7_searcher/
```

## Error Handling

The plugin handles errors gracefully:

- **API Errors**: Logged and reported, but don't crash the search
- **Rate Limits**: Logged with warnings; consider setting `CONTEXT7_API_KEY`
- **Missing Libraries**: Returns empty results with informative logging
- **Network Issues**: Caught and logged with appropriate error messages

## Context7 API

This plugin communicates with Context7's API to:

1. **Resolve Library ID**: Convert library names to Context7-compatible IDs
2. **Get Library Docs**: Fetch documentation for a specific library
3. **Search Docs**: Perform semantic search within library documentation

For more information about Context7, visit [context7.com](https://context7.com).

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## Related Projects

- [browse-mcp](https://github.com/LinXueyuanStdio/browse-mcp) - Main browse-mcp project
- [Context7](https://context7.com) - Documentation service provider
