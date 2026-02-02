# Changelog

All notable changes to the browse-mcp-plugin-context7 project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-02

### Added
- Initial release of Context7 documentation searcher plugin for browse-mcp
- `LibraryDoc` dataclass for unified documentation content representation
- `Context7Searcher` implementing `ContentSource[LibraryDoc]` interface
- `Context7Client` HTTP client for Context7 API communication
- Support for library resolution and documentation retrieval
- Topic-filtered documentation search
- Direct library ID search support
- Poetry-based plugin configuration with stevedore entry points
- Comprehensive README with usage examples
- Environment variable configuration for API key (`CONTEXT7_API_KEY`)

### Features
- Semantic search across library documentation
- Up-to-date documentation content retrieval
- Code examples extraction
- Trust score integration from Context7
- JSON-based documentation storage for offline access
- Graceful error handling with informative logging

### API Methods
- `search()`: Search for library documentation with optional topic filter
- `download()`: Save documentation to JSON file
- `read()`: Read and format saved documentation

### Documentation
- Complete README with installation and usage instructions
- API parameter documentation
- LibraryDoc data structure reference
- Development guide
- Error handling documentation

### Notes
- Requires browse-mcp core package
- Optional CONTEXT7_API_KEY for higher rate limits
- Automatic plugin discovery via stevedore
