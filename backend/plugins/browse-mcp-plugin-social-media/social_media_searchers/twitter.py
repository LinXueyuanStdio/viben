"""Twitter/X searcher implementation.

Twitter (now X) is a social media platform for short-form posts called tweets.
This searcher retrieves tweets, threads, and user profiles.

Note: This implementation requires Twitter/X API access.
API access requires:
- Bearer token (Twitter API v2)
- Respect for rate limits
- Compliance with Twitter's Terms of Service

Environment Variables:
    TWITTER_BEARER_TOKEN: Required for API access
    TWITTER_API_KEY: Optional API key
    TWITTER_API_SECRET: Optional API secret
"""
import os
from datetime import datetime
from typing import List
from browse_mcp.types import ContentSource
from .types import SocialPost, sanitize_filename


class TwitterSearcher(ContentSource[SocialPost]):
    """Searcher for Twitter/X platform.

    Environment Variables:
        TWITTER_BEARER_TOKEN: Required bearer token for Twitter API v2
    """

    def __init__(self):
        """Initialize Twitter searcher."""
        self.bearer_token = os.getenv("TWITTER_BEARER_TOKEN", "")
        self.api_base = "https://api.twitter.com/2"
        self.web_base = "https://twitter.com"

        if not self.bearer_token:
            print(
                "Warning: TWITTER_BEARER_TOKEN not set. "
                "Twitter search will return placeholder data."
            )

    def search(
        self,
        query: str,
        max_results: int = 10,
        tweet_fields: str = "created_at,author_id,public_metrics",
        **kwargs,
    ) -> List[SocialPost]:
        """Search Twitter for tweets matching the query.

        Args:
            query: Search query string (supports Twitter search operators)
            max_results: Maximum number of results (10-100 per request)
            tweet_fields: Comma-separated list of tweet fields to include
            **kwargs: Additional parameters (e.g., start_time, end_time, sort_order)

        Returns:
            List of SocialPost objects representing tweets

        Search Query Examples:
            - "python programming" - Simple keyword search
            - "from:elonmusk" - Tweets from specific user
            - "#AI" - Hashtag search
            - "machine learning -tensorflow" - Exclude tensorflow
        """
        # TODO: Implement actual Twitter API v2 search
        # Use: https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference
        posts = []

        # Example placeholder result
        posts.append(
            SocialPost(
                post_id="tweet_1234567890",
                title="",  # Tweets don't have titles
                content=f"Just found an amazing resource about {query}! "
                "Here's what I learned... 🧵\n\n"
                "1/ First, it's important to understand...",
                author="@techexpert",
                platform="twitter",
                url=f"{self.web_base}/techexpert/status/1234567890",
                published_date=datetime.now(),
                tags=["tech", "learning", query.replace(" ", "")],
                likes=1234,
                comments=56,  # Replies
                shares=789,  # Retweets
                media_urls=["https://pbs.twimg.com/media/example.jpg"],
                extra={
                    "author_id": "987654321",
                    "conversation_id": "1234567890",
                    "is_reply": False,
                    "is_retweet": False,
                    "is_quote": False,
                    "impression_count": 50000,
                    "language": "en",
                },
            )
        )

        return posts[:max_results]

    def download(self, content_id: str, save_path: str) -> str:
        """Download Twitter content.

        Downloads:
        - Tweet text and metadata
        - Thread (if tweet is part of a thread)
        - Attached media (images, videos)

        Args:
            content_id: Tweet ID
            save_path: Directory to save downloaded content

        Returns:
            Path to downloaded file
        """
        # TODO: Implement Twitter content download
        # Sanitize content_id to prevent path traversal and invalid filename characters
        safe_filename = sanitize_filename(content_id)
        output_path = os.path.join(save_path, f"twitter_{safe_filename}.json")

        # Placeholder implementation
        import json

        content = {
            "id": content_id,
            "platform": "twitter",
            "text": f"Tweet content {content_id}",
            "author": "example_user",
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)

        return output_path

    def read(self, content_id: str, save_path: str) -> str:
        """Read and extract text from downloaded Twitter content.

        Args:
            content_id: Tweet ID
            save_path: Directory containing downloaded content

        Returns:
            Extracted tweet text and metadata
        """
        # TODO: Implement text extraction
        # Sanitize content_id to prevent path traversal and invalid filename characters
        safe_filename = sanitize_filename(content_id)
        file_path = os.path.join(save_path, f"twitter_{safe_filename}.json")

        try:
            import json

            with open(file_path, "r", encoding="utf-8") as f:
                content = json.load(f)
            return f"@{content['author']}: {content['text']}"
        except FileNotFoundError:
            return f"Twitter content {content_id} (not downloaded yet)"
