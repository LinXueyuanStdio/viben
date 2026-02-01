"""Data types for social media content."""
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Optional


@dataclass
class SocialPost:
    """Standardized format for social media posts.

    This class represents content from various social media platforms
    with a unified structure.
    """

    # Core fields
    post_id: str  # Unique identifier (platform-specific ID)
    title: str  # Post title or first line
    content: str  # Main content/body
    author: str  # Author/creator username or name
    platform: str  # Platform name ('zhihu', 'xiaohongshu', 'github', 'twitter')
    url: str  # Direct URL to the post
    published_date: datetime  # Publication/creation time

    # Optional fields
    tags: List[str] = field(default_factory=list)  # Tags or topics
    likes: int = 0  # Like/upvote count
    comments: int = 0  # Comment count
    shares: int = 0  # Share/repost count
    media_urls: List[str] = field(default_factory=list)  # URLs to attached media (images, videos)
    extra: Dict = field(default_factory=dict)  # Platform-specific metadata

    def __post_init__(self):
        """Initialize default values for list fields."""
        if self.tags is None:
            self.tags = []
        if self.media_urls is None:
            self.media_urls = []
        if self.extra is None:
            self.extra = {}

    def to_text(self) -> str:
        """Convert SocialPost to a text representation.

        This method formats the post data into a readable text format
        that can be displayed to users or used by LLMs.
        """
        lines = []

        # Platform and basic info
        lines.append(f"Platform: {self.platform}")
        lines.append(f"Post ID: {self.post_id}")

        # Title and author
        if self.title:
            lines.append(f"Title: {self.title}")
        lines.append(f"Author: {self.author}")

        # Content
        if self.content:
            # Truncate very long content for readability
            content = self.content
            if len(content) > 1000:
                content = content[:1000] + "..."
            lines.append(f"Content: {content}")

        # Metadata
        lines.append(f"Published: {self.published_date.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"URL: {self.url}")

        # Engagement metrics
        if self.likes or self.comments or self.shares:
            engagement = []
            if self.likes:
                engagement.append(f"{self.likes} likes")
            if self.comments:
                engagement.append(f"{self.comments} comments")
            if self.shares:
                engagement.append(f"{self.shares} shares")
            lines.append(f"Engagement: {', '.join(engagement)}")

        # Tags
        if self.tags:
            lines.append(f"Tags: {', '.join(self.tags)}")

        # Media
        if self.media_urls:
            lines.append(f"Media: {len(self.media_urls)} attachment(s)")

        # Extra info
        if self.extra:
            lines.append(f"Extra: {self.extra}")

        return "\n".join(lines)

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "post_id": self.post_id,
            "title": self.title,
            "content": self.content,
            "author": self.author,
            "platform": self.platform,
            "url": self.url,
            "published_date": self.published_date.isoformat(),
            "tags": self.tags,
            "likes": self.likes,
            "comments": self.comments,
            "shares": self.shares,
            "media_urls": self.media_urls,
            "extra": self.extra,
        }
