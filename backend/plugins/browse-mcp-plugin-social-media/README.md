# Browse-MCP Social Media Plugin

A reference plugin implementation for [browse-mcp](https://github.com/LinXueyuanStdio/browse-mcp) that adds support for searching and retrieving content from social media platforms.

## Supported Platforms

- **Zhihu (知乎)**: Chinese Q&A and article platform
- **Xiaohongshu (小红书)**: Chinese lifestyle sharing platform
- **GitHub**: Code hosting and collaboration platform
- **Twitter/X**: Social media platform

## Installation

### From PyPI (when published)

```bash
pip install browse-mcp-plugin-social-media
```

### From Source

```bash
cd backend/plugins/browse-mcp-plugin-social-media
pip install -e .
```

## Configuration

Set environment variables for API authentication:

```bash
# Optional: Zhihu API key
export ZHIHU_API_KEY="your_zhihu_key"

# Optional: Xiaohongshu API key
export XIAOHONGSHU_API_KEY="your_xiaohongshu_key"

# Optional: GitHub personal access token (for higher rate limits)
export GITHUB_TOKEN="your_github_token"

# Required for Twitter: Bearer token
export TWITTER_BEARER_TOKEN="your_twitter_bearer_token"
```

## Usage

Once installed, the searchers are automatically discovered by browse-mcp:

```python
from browse_mcp import paper_search

# Search Zhihu
results = paper_search([
    {"searcher": "zhihu", "query": "人工智能", "max_results": 5}
])

# Search GitHub repositories
results = paper_search([
    {"searcher": "github", "query": "machine learning", "max_results": 10}
])

# Search Twitter
results = paper_search([
    {"searcher": "twitter", "query": "#AI", "max_results": 20}
])

# Search multiple platforms
results = paper_search([
    {"searcher": "zhihu", "query": "编程", "max_results": 5},
    {"searcher": "xiaohongshu", "query": "数码产品", "max_results": 5},
    {"searcher": "github", "query": "python", "max_results": 5},
])
```

## Controlling Which Searchers are Enabled

Use environment variables to control which searchers are active:

```bash
# Enable only specific sources
export BROWSE_MCP_ENABLED_SOURCES="zhihu,github"

# Or disable specific sources
export BROWSE_MCP_DISABLED_SOURCES="twitter"
```

## Development

### Project Structure

```
social_media_searchers/
├── __init__.py          # Package initialization
├── types.py             # SocialPost dataclass
├── zhihu.py             # Zhihu searcher
├── xiaohongshu.py       # Xiaohongshu searcher
├── github.py            # GitHub searcher
└── twitter.py           # Twitter searcher
```

### Creating Your Own Plugin

Use this plugin as a reference. Key steps:

1. **Define your content type** (or use `SocialPost`):
   ```python
   @dataclass
   class MyContent:
       content_id: str
       title: str
       # ... other fields

       def to_text(self) -> str:
           # Format for display
           return f"Title: {self.title}"
   ```

2. **Implement ContentSource**:
   ```python
   from browse_mcp.types import ContentSource

   class MySearcher(ContentSource[MyContent]):
       def search(self, query: str, **kwargs) -> List[MyContent]:
           # Your implementation
           pass

       def download(self, content_id: str, save_path: str) -> str:
           # Your implementation
           pass

       def read(self, content_id: str, save_path: str) -> str:
           # Your implementation
           pass
   ```

3. **Register as plugin** in `pyproject.toml`:
   ```toml
   [tool.poetry.plugins."browse_mcp.searchers"]
   my_searcher = "my_package:MySearcher"
   ```

## Implementation Notes

### Current Status

This is a **reference implementation** with placeholder code. To use in production:

1. **Implement actual API calls** for each platform
2. **Add proper error handling** and retry logic
3. **Handle rate limiting** appropriately
4. **Respect robots.txt** and Terms of Service
5. **Add comprehensive tests**

### API Requirements

- **Zhihu**: Requires unofficial API or web scraping (no official public API)
- **Xiaohongshu**: Requires unofficial API or web scraping
- **GitHub**: Uses [GitHub REST API](https://docs.github.com/en/rest) (public, rate limits apply)
- **Twitter**: Requires [Twitter API v2](https://developer.twitter.com/en/docs/twitter-api) (authentication required)

### Rate Limits

Each platform has different rate limits. Implement appropriate throttling:

- GitHub: 60 requests/hour (unauthenticated), 5000 requests/hour (authenticated)
- Twitter: Varies by endpoint and tier
- Zhihu/Xiaohongshu: Depends on implementation method

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
- See browse-mcp documentation for more plugin examples
