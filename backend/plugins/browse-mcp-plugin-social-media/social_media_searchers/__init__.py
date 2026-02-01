"""Social media searchers plugin for browse-mcp.

This plugin provides searchers for popular social media and code hosting platforms:
- Zhihu (知乎): Chinese Q&A and article platform
- Xiaohongshu (小红书): Chinese lifestyle sharing platform
- GitHub: Code hosting and collaboration platform
- Twitter/X: Social media platform
"""

from .types import SocialPost
from .zhihu import ZhihuSearcher
from .xiaohongshu import XiaohongshuSearcher
from .github import GithubSearcher
from .twitter import TwitterSearcher

__all__ = [
    "SocialPost",
    "ZhihuSearcher",
    "XiaohongshuSearcher",
    "GithubSearcher",
    "TwitterSearcher",
]
