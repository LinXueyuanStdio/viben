# Changelog

All notable changes to the browse-mcp-plugin-social-media project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-01

### Added
- Initial release of social media plugin for browse-mcp
- Support for Zhihu (知乎) platform searcher
- Support for Xiaohongshu (小红书) platform searcher
- Support for GitHub platform searcher
- Support for Twitter/X platform searcher
- `SocialPost` dataclass for unified social media content representation
- Poetry-based plugin configuration
- Comprehensive README with usage examples
- Reference implementation with placeholder API calls

### Features
- Generic content type support via `ContentSource[SocialPost]`
- Automatic plugin discovery via stevedore
- Environment variable configuration for API keys
- Individual searcher enable/disable via `BROWSE_MCP_ENABLED_SOURCES`
- Detailed content metadata in `SocialPost.extra` field

### Documentation
- Complete README with installation and usage instructions
- API requirements and rate limit information
- Development guide for creating custom plugins
- Code examples for each platform

### Notes
- This is a reference implementation with placeholder code
- Actual API integration needs to be implemented for production use
- Requires API keys/tokens for full functionality
