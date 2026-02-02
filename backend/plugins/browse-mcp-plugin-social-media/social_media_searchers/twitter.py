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

API Access Tiers (as of 2024):
- Free: Read-only, 100 reads/month, 1 app
- Basic ($100/month): 10,000 reads/month
- Pro ($5,000/month): 1,000,000 reads/month

Due to API limitations, this implementation:
1. Uses Twitter API v2 when bearer token is available
2. Returns informative error messages when API is unavailable
"""
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from browse_mcp.types import ContentSource
from loguru import logger

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
        self._client: Optional[httpx.Client] = None

        if not self.bearer_token:
            logger.warning(
                "TWITTER_BEARER_TOKEN not set. "
                "Twitter search requires API access. "
                "Get a bearer token at https://developer.twitter.com/",
            )

    @property
    def client(self) -> httpx.Client:
        """Get or create HTTP client with proper headers."""
        if self._client is None:
            headers = {
                "User-Agent": "browse-mcp-social-media-plugin",
            }
            if self.bearer_token:
                headers["Authorization"] = f"Bearer {self.bearer_token}"
            self._client = httpx.Client(headers=headers, timeout=30.0)
        return self._client

    def __del__(self):
        """Clean up HTTP client."""
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass

    def _parse_datetime(self, dt_str: str) -> datetime:
        """Parse Twitter datetime string to datetime object."""
        if not dt_str:
            return datetime.now()
        try:
            # Twitter API v2 uses ISO 8601 format: 2024-01-15T10:30:00.000Z
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now()

    def search(
        self,
        query: str,
        max_results: int = 10,
        tweet_fields: str = (
            "created_at,author_id,public_metrics,entities,conversation_id"
        ),
        expansions: str = "author_id,attachments.media_keys",
        **kwargs,
    ) -> List[SocialPost]:
        """Search Twitter for tweets matching the query.

        Args:
            query: Search query string (supports Twitter search operators)
            max_results: Maximum number of results (10-100 per request)
            tweet_fields: Comma-separated list of tweet fields to include
            expansions: Comma-separated list of expansions for additional data
            **kwargs: Additional parameters:
                - start_time: ISO 8601 timestamp for search start
                - end_time: ISO 8601 timestamp for search end
                - sort_order: 'recency' or 'relevancy'

        Returns:
            List of SocialPost objects representing tweets

        Search Query Examples:
            - "python programming" - Simple keyword search
            - "from:elonmusk" - Tweets from specific user
            - "#AI" - Hashtag search
            - "machine learning -tensorflow" - Exclude tensorflow
            - "machine learning lang:en" - Filter by language
        """
        if not query or not query.strip():
            logger.warning("Empty query provided to Twitter search")
            return []

        if not self.bearer_token:
            logger.error(
                "Twitter API requires authentication. "
                "Please set TWITTER_BEARER_TOKEN environment variable. "
                "Get a bearer token at https://developer.twitter.com/",
            )
            return []

        # Build request parameters
        # Twitter API v2 recent search endpoint (last 7 days)
        params = {
            "query": query.strip(),
            "max_results": min(max(max_results, 10), 100),  # API requires 10-100
            "tweet.fields": tweet_fields,
            "expansions": expansions,
            "media.fields": "url,preview_image_url,type",
            "user.fields": "username,name,profile_image_url",
        }

        # Add optional parameters
        if "start_time" in kwargs:
            params["start_time"] = kwargs["start_time"]
        if "end_time" in kwargs:
            params["end_time"] = kwargs["end_time"]
        if "sort_order" in kwargs:
            params["sort_order"] = kwargs["sort_order"]

        try:
            response = self.client.get(
                f"{self.api_base}/tweets/search/recent", params=params,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error(
                    "Twitter API authentication failed. Check your bearer token.",
                )
            elif e.response.status_code == 403:
                logger.error(
                    "Twitter API access forbidden. "
                    "Your API tier may not support this endpoint. "
                    "Free tier has limited access.",
                )
            elif e.response.status_code == 429:
                logger.error(
                    "Twitter API rate limit exceeded. Please wait and try again.",
                )
            else:
                logger.error(
                    f"Twitter API error: {e.response.status_code} - {e.response.text}",
                )
            return []
        except httpx.RequestError as e:
            logger.error(f"Network error while searching Twitter: {e}")
            return []

        # Check for API errors in response
        if "errors" in data and not data.get("data"):
            errors = data["errors"]
            for error in errors:
                logger.error(
                    f"Twitter API error: {error.get('message', 'Unknown error')}",
                )
            return []

        # Build lookup maps for users and media from includes
        includes = data.get("includes", {})
        users_map = {u["id"]: u for u in includes.get("users", [])}
        media_map = {m["media_key"]: m for m in includes.get("media", [])}

        # Parse tweets
        posts = []
        tweets = data.get("data", [])

        for tweet in tweets[:max_results]:
            try:
                post = self._parse_tweet(tweet, users_map, media_map)
                if post:
                    posts.append(post)
            except Exception as e:
                logger.warning(f"Error parsing tweet: {e}")
                continue

        logger.info(f"Twitter search returned {len(posts)} results for '{query}'")
        return posts

    def _parse_tweet(
        self, tweet: dict, users_map: Dict[str, Any], media_map: Dict[str, Any],
    ) -> SocialPost:
        """Parse tweet data to SocialPost."""
        tweet_id = tweet.get("id", "")
        author_id = tweet.get("author_id", "")

        # Get author info from includes
        author_data = users_map.get(author_id, {})
        author_username = author_data.get("username", "unknown")
        author_name = author_data.get("name", "")

        # Get public metrics
        metrics = tweet.get("public_metrics", {})

        # Extract hashtags and mentions from entities
        entities = tweet.get("entities", {})
        hashtags = [f"#{h['tag']}" for h in entities.get("hashtags", [])]
        mentions = [f"@{m['username']}" for m in entities.get("mentions", [])]
        urls = [
            u.get("expanded_url", u.get("url", "")) for u in entities.get("urls", [])
        ]

        # Get media URLs
        media_keys = tweet.get("attachments", {}).get("media_keys", [])
        media_urls = []
        for key in media_keys:
            media = media_map.get(key, {})
            media_url = media.get("url") or media.get("preview_image_url")
            if media_url:
                media_urls.append(media_url)

        return SocialPost(
            post_id=f"tweet_{tweet_id}",
            title="",  # Tweets don't have titles
            content=tweet.get("text", ""),
            author=f"@{author_username}",
            platform="twitter",
            url=f"{self.web_base}/{author_username}/status/{tweet_id}",
            published_date=self._parse_datetime(tweet.get("created_at", "")),
            tags=hashtags,
            likes=metrics.get("like_count", 0),
            comments=metrics.get("reply_count", 0),
            shares=metrics.get("retweet_count", 0) + metrics.get("quote_count", 0),
            media_urls=media_urls,
            extra={
                "author_id": author_id,
                "author_name": author_name,
                "conversation_id": tweet.get("conversation_id", ""),
                "mentions": mentions,
                "urls": urls,
                "impression_count": metrics.get("impression_count", 0),
                "bookmark_count": metrics.get("bookmark_count", 0),
                "language": tweet.get("lang", ""),
            },
        )

    def download(self, content_id: str, save_path: str) -> str:
        """Download Twitter content.

        Downloads:
        - Tweet text and metadata
        - Thread context (if part of a thread)
        - User info for the author

        Args:
            content_id: Tweet ID (numeric string)
            save_path: Directory to save downloaded content

        Returns:
            Path to downloaded file
        """
        safe_filename = sanitize_filename(content_id)
        output_path = os.path.join(save_path, f"twitter_{safe_filename}.json")

        # Clean the content_id (remove 'tweet_' prefix if present)
        tweet_id = content_id
        if tweet_id.startswith("tweet_"):
            tweet_id = tweet_id[6:]

        if not self.bearer_token:
            logger.error("Twitter API requires authentication for download.")
            content = {
                "error": "API authentication required",
                "message": "Set TWITTER_BEARER_TOKEN to download tweets",
                "id": tweet_id,
                "platform": "twitter",
            }
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            return output_path

        try:
            # Fetch tweet with expansions
            params = {
                "ids": tweet_id,
                "tweet.fields": (
                    "created_at,author_id,public_metrics,"
                    "entities,conversation_id,referenced_tweets"
                ),
                "expansions": "author_id,attachments.media_keys,referenced_tweets.id",
                "media.fields": "url,preview_image_url,type",
                "user.fields": "username,name,profile_image_url,description",
            }

            response = self.client.get(f"{self.api_base}/tweets", params=params)
            response.raise_for_status()
            data = response.json()

            # Save raw response with parsed data
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            logger.info(f"Downloaded Twitter content to {output_path}")
            return output_path

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Twitter API error downloading tweet {tweet_id}: "
                f"{e.response.status_code}",
            )
            content = {
                "error": f"API error: {e.response.status_code}",
                "id": tweet_id,
                "platform": "twitter",
            }
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            return output_path

        except httpx.RequestError as e:
            logger.error(f"Network error downloading tweet {tweet_id}: {e}")
            content = {
                "error": f"Network error: {str(e)}",
                "id": tweet_id,
                "platform": "twitter",
            }
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            return output_path

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and extract text from downloaded Twitter content.

        Args:
            content_id: Tweet ID
            save_path: Directory containing downloaded content
            page: Specific page number (ignored for Twitter - not paginated)
            start_page: Start page for range extraction (ignored for Twitter)
            end_page: End page for range extraction (ignored for Twitter)

        Returns:
            Extracted tweet text and metadata as formatted string
        """
        # Note: page, start_page, end_page are ignored for Twitter content
        # as tweets are not paginated like PDFs
        safe_filename = sanitize_filename(content_id)
        file_path = os.path.join(save_path, f"twitter_{safe_filename}.json")

        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)

            # Check for error in stored data
            if "error" in data:
                return f"Error: {data['error']}\n{data.get('message', '')}"

            # Format the tweet data as readable text
            return self._format_tweet_data(data)

        except FileNotFoundError:
            # If not downloaded, try to fetch directly
            if self.bearer_token:
                try:
                    self.download(content_id, save_path)
                    return self.read(content_id, save_path)
                except Exception as e:
                    logger.warning(f"Could not fetch tweet {content_id}: {e}")
            return f"Twitter content {content_id} (not downloaded yet)"

        except json.JSONDecodeError:
            return f"Twitter content {content_id} (invalid JSON)"

    def _format_tweet_data(self, data: dict) -> str:
        """Format Twitter API response as readable text."""
        lines = []

        # Get tweet data
        tweets = data.get("data", [])
        if not tweets:
            return "No tweet data found"

        tweet = tweets[0] if isinstance(tweets, list) else tweets

        # Get includes for user info
        includes = data.get("includes", {})
        users_map = {u["id"]: u for u in includes.get("users", [])}

        # Get author info
        author_id = tweet.get("author_id", "")
        author = users_map.get(author_id, {})
        username = author.get("username", "unknown")
        name = author.get("name", "")

        lines.append(f"Tweet by @{username}" + (f" ({name})" if name else ""))
        lines.append(f"ID: {tweet.get('id', '')}")
        lines.append(f"Created: {tweet.get('created_at', '')}")
        lines.append("")
        lines.append(tweet.get("text", ""))
        lines.append("")

        # Add metrics
        metrics = tweet.get("public_metrics", {})
        if metrics:
            lines.append("Engagement:")
            lines.append(f"  Likes: {metrics.get('like_count', 0)}")
            lines.append(f"  Retweets: {metrics.get('retweet_count', 0)}")
            lines.append(f"  Replies: {metrics.get('reply_count', 0)}")
            lines.append(f"  Quotes: {metrics.get('quote_count', 0)}")

        # Add URL
        lines.append("")
        lines.append(f"URL: {self.web_base}/{username}/status/{tweet.get('id', '')}")

        return "\n".join(lines)
