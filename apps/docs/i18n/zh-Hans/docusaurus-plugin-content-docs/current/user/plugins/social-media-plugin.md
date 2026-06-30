---
sidebar_position: 4
title: "Social Media Plugin"
description: "Search and fetch content from GitHub, Twitter, Zhihu, and Xiaohongshu"
---

# Social Media Plugin

The social media plugin adds support for searching and fetching content from popular social platforms to Viben. This page provides detailed documentation for each supported data source.

## Installation

```bash
pip install browse-mcp-plugin-social-media
```

## Supported Platforms

| Data Source | Description | Status |
|-------------|-------------|--------|
| `github` | GitHub repositories and code | Available |
| `twitter` | Twitter/X posts | Requires API |
| `zhihu` | Zhihu Q&A articles | Reference implementation |
| `xiaohongshu` | Xiaohongshu posts | Reference implementation |

:::note Implementation Status
This plugin is a **reference implementation** demonstrating the plugin architecture. The GitHub searcher uses the public API. Other data sources have placeholder implementations that require completion of actual API integration.
:::

## GitHub

Search GitHub repositories, code, and issues.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Optional | Personal access token for higher rate limits |

Without a token, GitHub allows 60 requests per hour. With a token, you get 5,000 requests per hour.

To create a token:
1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Generate a new token with `repo` permissions
3. Set the environment variable

### Usage

```python
# Search repositories
browse_search([
    {"searcher": "github", "query": "machine learning python", "max_results": 10}
])

# Search with specific filters
browse_search([
    {"searcher": "github", "query": "language:python stars:>1000", "max_results": 5}
])
```

### Response Format

```
Platform: github
Post ID: owner/repo-name
Title: Repository Name
Author: owner
Content: Repository description...
Published: 2024-01-15 10:30:00
URL: https://github.com/owner/repo-name
Engagement: 1234 likes, 56 comments
Tags: python, machine-learning, deep-learning
```

### GitHub Search Syntax

GitHub supports advanced search syntax:

| Query | Description |
|-------|-------------|
| `language:python` | Filter by language |
| `stars:>1000` | Minimum star count |
| `forks:>100` | Minimum fork count |
| `created:>2023-01-01` | Created after date |
| `pushed:>2023-01-01` | Last pushed after date |
| `topic:machine-learning` | Filter by topic |

Example:
```python
browse_search([{
    "searcher": "github",
    "query": "transformer language:python stars:>500 topic:nlp",
    "max_results": 10
}])
```

## Twitter/X

Search Twitter posts and topics.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `TWITTER_BEARER_TOKEN` | Yes | Twitter API v2 Bearer Token |

To obtain a token:
1. Apply for a [Twitter Developer Account](https://developer.twitter.com/)
2. Create a project and app
3. Generate a Bearer Token

### Usage

```python
# Search tweets
browse_search([
    {"searcher": "twitter", "query": "#MachineLearning", "max_results": 20}
])

# Search with operators
browse_search([
    {"searcher": "twitter", "query": "from:OpenAI GPT", "max_results": 10}
])
```

### Response Format

```
Platform: twitter
Post ID: 1234567890
Title: Tweet Preview...
Author: @username
Content: Full tweet content...
Published: 2024-01-15 10:30:00
URL: https://twitter.com/username/status/1234567890
Engagement: 500 likes, 100 comments, 50 shares
Tags: #MachineLearning, #AI
```

### Twitter Search Operators

| Operator | Description |
|----------|-------------|
| `from:username` | Tweets from user |
| `to:username` | Replies to user |
| `#hashtag` | Contains hashtag |
| `@mention` | Mentions user |
| `lang:en` | Language filter |
| `is:retweet` | Include retweets |
| `-is:retweet` | Exclude retweets |

## Zhihu

Search Zhihu questions, answers, and articles.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ZHIHU_API_KEY` | Optional | API key for higher rate limits |

### Usage

```python
# Search Zhihu content
browse_search([
    {"searcher": "zhihu", "query": "机器学习", "max_results": 10}
])

# Search Chinese content
browse_search([
    {"searcher": "zhihu", "query": "深度学习入门", "max_results": 5}
])
```

### Response Format

```
Platform: zhihu
Post ID: 123456789
Title: Question Title
Author: Author Name
Content: Answer or article content...
Published: 2024-01-15 10:30:00
URL: https://www.zhihu.com/question/123456789
Engagement: 1000 likes, 50 comments
Tags: machine-learning, artificial-intelligence
```

## Xiaohongshu

Search Xiaohongshu notes and posts.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `XIAOHONGSHU_API_KEY` | Optional | API key for access |

### Usage

```python
# Search Xiaohongshu content
browse_search([
    {"searcher": "xiaohongshu", "query": "科技测评", "max_results": 10}
])
```

### Response Format

```
Platform: xiaohongshu
Post ID: 123456789
Title: Post Title
Author: @username
Content: Post content...
Published: 2024-01-15 10:30:00
URL: https://www.xiaohongshu.com/explore/123456789
Engagement: 500 likes, 30 comments
Tags: Tech, Review, Digital
Media: 3 attachment(s)
```

## SocialPost Type

All social media data sources return `SocialPost` objects:

```python
@dataclass
class SocialPost:
    # Core fields
    post_id: str        # Unique identifier
    title: str          # Post title or preview
    content: str        # Main content
    author: str         # Author name/username
    platform: str       # Platform name
    url: str            # Direct link
    published_date: datetime

    # Engagement metrics
    likes: int = 0
    comments: int = 0
    shares: int = 0

    # Optional fields
    tags: List[str]
    media_urls: List[str]
    extra: Dict
```

## Enabling/Disabling Data Sources

Control which social media data sources are active:

```bash
# Enable only specific data sources
export BROWSE_MCP_ENABLED_SOURCES="arxiv,github,twitter"

# Or disable specific data sources
export BROWSE_MCP_DISABLED_SOURCES="zhihu,xiaohongshu"
```

## Rate Limits

Each platform has different rate limits:

| Platform | Unauthenticated | Authenticated |
|----------|-----------------|---------------|
| GitHub | 60/hour | 5,000/hour |
| Twitter | Not available | Varies by tier |
| Zhihu | Depends on implementation | Depends on implementation |
| Xiaohongshu | Depends on implementation | Depends on implementation |

The plugin handles rate limiting internally. If you hit limits, consider:

- Adding API keys for higher limits
- Reducing `max_results` per query
- Adding delays between searches

## Contributing

The social media plugin is open source. To contribute:

1. Fork the repository
2. Implement or improve searchers
3. Add tests
4. Submit a Pull Request

Priority areas:

- Complete Twitter API integration
- Add Zhihu API integration
- Add Xiaohongshu API integration
- Add new platforms (LinkedIn, Reddit, etc.)

## Next Steps

- [Plugin Overview](./overview) - Learn about plugin architecture
- [Installing Plugins](./installing-plugins) - Installation guide
- [Plugin Configuration](./configuration) - Advanced configuration
