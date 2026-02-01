"""Data types for social media content."""
import re
from dataclasses import dataclass, field
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


def sanitize_filename(filename: str, max_length: int = 200) -> str:
    """Sanitize a string to be safe for use as a filename.

    This function removes or replaces characters that are invalid or potentially
    dangerous in filenames across different operating systems (Windows, macOS, Linux).

    Security considerations:
    - Prevents path traversal attacks by removing path separators
    - Removes characters that are invalid in Windows filenames
    - Removes control characters and other potentially dangerous characters
    - Limits filename length to prevent filesystem issues

    Args:
        filename: The original filename or content ID
        max_length: Maximum length for the sanitized filename (default: 200)

    Returns:
        A sanitized filename safe for use across operating systems

    Examples:
        >>> sanitize_filename("owner/repo")
        'owner_repo'
        >>> sanitize_filename("../../etc/passwd")
        '.._.._etc_passwd'
        >>> sanitize_filename("file:name*?.txt")
        'file_name__.txt'
    """
    if not filename:
        return "unnamed"

    # Remove or replace path separators (both / and \\) to prevent path traversal
    sanitized = filename.replace("/", "_").replace("\\", "_")

    # Remove or replace characters that are invalid on Windows:
    # < > : " | ? *
    invalid_chars = '<>:"|?*'
    for char in invalid_chars:
        sanitized = sanitized.replace(char, "_")

    # Remove control characters (ASCII 0-31)
    sanitized = "".join(char if ord(char) >= 32 else "_" for char in sanitized)

    # Remove leading/trailing dots and spaces (problematic on Windows)
    sanitized = sanitized.strip(". ")

    # If the result is empty or only underscores, use a default name
    if not sanitized or sanitized.replace("_", "") == "":
        return "unnamed"

    # Truncate to max_length while preserving file extension if present
    if len(sanitized) > max_length:
        # Try to preserve extension
        parts = sanitized.rsplit(".", 1)
        if len(parts) == 2 and len(parts[1]) <= 10:  # Reasonable extension length
            ext = parts[1]
            name = parts[0][: max_length - len(ext) - 1]
            sanitized = f"{name}.{ext}"
        else:
            sanitized = sanitized[:max_length]

    return sanitized
