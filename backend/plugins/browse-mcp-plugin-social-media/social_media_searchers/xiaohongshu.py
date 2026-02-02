"""Xiaohongshu (小红书) searcher implementation.

Xiaohongshu (Little Red Book) is a Chinese lifestyle and e-commerce platform
focused on product reviews, travel, fashion, and lifestyle content.

Note: Xiaohongshu does not provide an official public API. This implementation uses:
1. Xiaohongshu's internal API endpoints (reverse-engineered from web/mobile)
2. Web page parsing as fallback

Important considerations:
- Rate limiting: Xiaohongshu has strict rate limits
- Authentication: Most content requires login
- Anti-scraping: Heavy anti-bot measures including:
  - X-s and X-t signature headers
  - Device fingerprinting
  - Captcha challenges
- Terms of Service: Use responsibly

Environment Variables:
    XIAOHONGSHU_COOKIE: Browser cookie for authenticated requests
                        (required for most operations)
"""
import hashlib
import json
import os
import re
import time
from datetime import datetime
from html import unescape
from typing import Any, Dict, List, Optional

import httpx
from browse_mcp.types import ContentSource
from loguru import logger

from .types import SocialPost, sanitize_filename


class XiaohongshuSearcher(ContentSource[SocialPost]):
    """Searcher for Xiaohongshu (小红书) platform.

    This searcher attempts to use Xiaohongshu's internal API endpoints.
    Due to heavy anti-scraping measures, a valid browser cookie is strongly recommended.

    Environment Variables:
        XIAOHONGSHU_COOKIE: Browser cookie string for authenticated requests
                           (required for reliable access to content)
    """

    def __init__(self):
        """Initialize Xiaohongshu searcher."""
        self.cookie = os.getenv("XIAOHONGSHU_COOKIE", "")
        self.base_url = "https://www.xiaohongshu.com"
        self.api_url = "https://edith.xiaohongshu.com/api/sns"
        self._client: Optional[httpx.Client] = None

        if not self.cookie:
            logger.warning(
                "XIAOHONGSHU_COOKIE not set. "
                "Xiaohongshu has strict anti-scraping measures. "
                "Set your browser cookie for reliable access.",
            )

    @property
    def client(self) -> httpx.Client:
        """Get or create HTTP client with proper headers."""
        if self._client is None:
            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Referer": "https://www.xiaohongshu.com/",
                "Origin": "https://www.xiaohongshu.com",
            }
            if self.cookie:
                headers["Cookie"] = self.cookie
            self._client = httpx.Client(
                headers=headers, timeout=30.0, follow_redirects=True,
            )
        return self._client

    def __del__(self):
        """Clean up HTTP client."""
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass

    def _parse_datetime(self, timestamp: Any) -> datetime:
        """Parse Xiaohongshu timestamp to datetime object."""
        if not timestamp:
            return datetime.now()
        try:
            if isinstance(timestamp, (int, float)):
                # Xiaohongshu uses milliseconds
                if timestamp > 1e12:
                    timestamp = timestamp / 1000
                return datetime.fromtimestamp(timestamp)
            elif isinstance(timestamp, str):
                # Try parsing as integer first
                try:
                    ts = int(timestamp)
                    if ts > 1e12:
                        ts = ts / 1000
                    return datetime.fromtimestamp(ts)
                except ValueError:
                    pass
                # Try ISO format
                return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except (ValueError, OSError):
            pass
        return datetime.now()

    def _clean_html(self, html_text: str) -> str:
        """Clean HTML tags and entities from text."""
        if not html_text:
            return ""
        # Remove HTML tags
        text = re.sub(r"<[^>]+>", "", html_text)
        # Decode HTML entities
        text = unescape(text)
        # Clean up whitespace but preserve newlines
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n", "\n\n", text)
        return text.strip()

    def _generate_search_id(self) -> str:
        """Generate a search ID for API requests."""
        return hashlib.md5(str(time.time()).encode()).hexdigest()[:16]

    def search(
        self,
        query: str,
        max_results: int = 10,
        search_type: str = "note",
        **kwargs,
    ) -> List[SocialPost]:
        """Search Xiaohongshu for posts matching the query.

        Note: Due to Xiaohongshu's anti-scraping measures, this method may not work
        without proper authentication (XIAOHONGSHU_COOKIE). If the API returns errors,
        the method will return an informative message.

        Args:
            query: Search query string
            max_results: Maximum number of results to return
            search_type: Type of content to search:
                        'note' - Notes (posts) - default
                        'user' - Users
            **kwargs: Additional parameters:
                - page: Page number (1-indexed)
                - sort: Sort order
                        ('general', 'time_descending', 'popularity_descending')

        Returns:
            List of SocialPost objects representing Xiaohongshu notes
        """
        if not query or not query.strip():
            logger.warning("Empty query provided to Xiaohongshu search")
            return []

        if not self.cookie:
            logger.error(
                "Xiaohongshu search requires authentication. "
                "Please set XIAOHONGSHU_COOKIE environment variable. "
                "To get your cookie: "
                "1) Login to xiaohongshu.com in browser, "
                "2) Open DevTools (F12), 3) Go to Network tab, "
                "4) Copy the Cookie header from any request.",
            )
            return []

        # Build search request
        # Xiaohongshu web search uses /web/v1/search/notes endpoint
        page = kwargs.get("page", 1)
        sort = kwargs.get("sort", "general")

        params = {
            "keyword": query.strip(),
            "page": page,
            "page_size": min(max_results, 20),
            "search_id": self._generate_search_id(),
            "sort": sort,
            "note_type": 0,  # 0=all, 1=video, 2=image
        }

        try:
            # Try the web search endpoint
            response = self.client.get(
                f"{self.api_url}/web/v1/search/notes", params=params,
            )

            # Check for anti-bot redirect
            if response.status_code == 302 or "captcha" in response.text.lower():
                logger.error(
                    "Xiaohongshu detected automated access. "
                    "Please update your cookie or try again later.",
                )
                return []

            response.raise_for_status()
            data = response.json()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error(
                    "Xiaohongshu authentication failed. "
                    "Please update your XIAOHONGSHU_COOKIE.",
                )
            elif e.response.status_code == 403:
                logger.error(
                    "Xiaohongshu access forbidden. "
                    "Your cookie may have expired or the request was blocked.",
                )
            elif e.response.status_code == 461:
                logger.error(
                    "Xiaohongshu request requires additional verification. "
                    "Try logging in through the browser first.",
                )
            else:
                logger.error(f"Xiaohongshu API error: {e.response.status_code}")
            return []
        except httpx.RequestError as e:
            logger.error(f"Network error while searching Xiaohongshu: {e}")
            return []

        # Check API response status
        if not data.get("success", False):
            error_msg = data.get("msg", "Unknown error")
            logger.error(f"Xiaohongshu API error: {error_msg}")
            return []

        # Parse results
        posts = []
        items = data.get("data", {}).get("notes", [])

        for item in items[:max_results]:
            try:
                post = self._parse_note(item)
                if post:
                    posts.append(post)
            except Exception as e:
                logger.warning(f"Error parsing Xiaohongshu note: {e}")
                continue

        logger.info(f"Xiaohongshu search returned {len(posts)} results for '{query}'")
        return posts

    def _parse_note(self, note: dict) -> SocialPost:
        """Parse Xiaohongshu note to SocialPost."""
        note_id = note.get("id", "") or note.get("note_id", "")
        user = note.get("user", {}) or note.get("author", {})

        # Get content (title and description)
        title = note.get("title", "") or note.get("display_title", "")
        desc = note.get("desc", "") or note.get("description", "")

        # Extract tags from desc (format: #tag1 #tag2)
        tags = re.findall(r"#(\w+)", desc)

        # Get media URLs
        media_urls = []
        # Image list
        images = note.get("images_list", []) or note.get("image_list", [])
        for img in images:
            url = img.get("url", "") or img.get("info_list", [{}])[0].get("url", "")
            if url:
                media_urls.append(url)

        # Cover image
        cover = note.get("cover", {})
        cover_url = cover.get("url", "") or cover.get("url_default", "")
        if cover_url and cover_url not in media_urls:
            media_urls.insert(0, cover_url)

        # Interaction stats
        liked_count = note.get("liked_count", 0) or note.get("likes", 0)
        # Parse string values like "1.2万"
        if isinstance(liked_count, str):
            liked_count = self._parse_count(liked_count)

        collected_count = note.get("collected_count", 0) or note.get("collects", 0)
        if isinstance(collected_count, str):
            collected_count = self._parse_count(collected_count)

        comment_count = note.get("comment_count", 0) or note.get("comments", 0)
        if isinstance(comment_count, str):
            comment_count = self._parse_count(comment_count)

        share_count = note.get("share_count", 0) or note.get("shares", 0)
        if isinstance(share_count, str):
            share_count = self._parse_count(share_count)

        return SocialPost(
            post_id=f"xhs_{note_id}",
            title=title,
            content=self._clean_html(desc),
            author=user.get("nickname", "") or user.get("name", "小红书用户"),
            platform="xiaohongshu",
            url=f"{self.base_url}/explore/{note_id}",
            published_date=self._parse_datetime(
                note.get("time") or note.get("timestamp"),
            ),
            tags=tags,
            likes=liked_count,
            comments=comment_count,
            shares=share_count,
            media_urls=media_urls,
            extra={
                "type": note.get("type", "normal"),
                "note_id": note_id,
                "user_id": user.get("user_id", "") or user.get("id", ""),
                "collected_count": collected_count,
                "is_video": note.get("type") == "video",
                "video_id": note.get("video", {})
                .get("consumer", {})
                .get("origin_video_key", ""),
            },
        )

    def _parse_count(self, count_str: str) -> int:
        """Parse count string like '1.2万' to integer."""
        if not count_str:
            return 0
        count_str = str(count_str).strip()

        # Already a number
        if count_str.isdigit():
            return int(count_str)

        # Parse Chinese number suffixes
        multipliers = {"万": 10000, "亿": 100000000, "k": 1000, "w": 10000}
        for suffix, mult in multipliers.items():
            if suffix in count_str:
                try:
                    num = float(count_str.replace(suffix, ""))
                    return int(num * mult)
                except ValueError:
                    pass
        return 0

    def download(self, content_id: str, save_path: str) -> str:
        """Download Xiaohongshu post content.

        Downloads:
        - Post text content
        - Post metadata
        - Image URLs (actual images can be downloaded separately)

        Args:
            content_id: Xiaohongshu note ID
            save_path: Directory to save downloaded content

        Returns:
            Path to downloaded file
        """
        safe_filename = sanitize_filename(content_id)
        output_path = os.path.join(save_path, f"xiaohongshu_{safe_filename}.json")

        # Clean content_id
        note_id = content_id
        if note_id.startswith("xhs_"):
            note_id = note_id[4:]

        if not self.cookie:
            logger.error("Xiaohongshu download requires authentication.")
            content = {
                "error": "Authentication required",
                "message": "Set XIAOHONGSHU_COOKIE to download notes",
                "id": note_id,
                "platform": "xiaohongshu",
            }
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            return output_path

        try:
            # Fetch note details
            content_data = self._fetch_note(note_id)

            # Save as JSON
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content_data, f, ensure_ascii=False, indent=2, default=str)

            logger.info(f"Downloaded Xiaohongshu content to {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Error downloading Xiaohongshu note {note_id}: {e}")
            content = {
                "error": str(e),
                "id": note_id,
                "platform": "xiaohongshu",
            }
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content, f, ensure_ascii=False, indent=2)
            return output_path

    def _fetch_note(self, note_id: str) -> Dict[str, Any]:
        """Fetch note details from API."""
        # Try the web API endpoint
        params = {
            "source_note_id": note_id,
        }

        response = self.client.get(f"{self.api_url}/web/v1/feed", params=params)
        response.raise_for_status()
        data = response.json()

        if not data.get("success", False):
            raise ValueError(f"API error: {data.get('msg', 'Unknown error')}")

        # Extract note from response
        items = data.get("data", {}).get("items", [])
        if not items:
            raise ValueError("Note not found")

        note_data = items[0].get("note_card", {})
        note_data["_type"] = "note"
        return note_data

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and extract text from downloaded Xiaohongshu content.

        Args:
            content_id: Xiaohongshu note ID
            save_path: Directory containing downloaded content
            page: Specific page number (ignored for Xiaohongshu - not paginated)
            start_page: Start page for range extraction (ignored for Xiaohongshu)
            end_page: End page for range extraction (ignored for Xiaohongshu)

        Returns:
            Extracted text content
        """
        # Note: page, start_page, end_page are ignored for Xiaohongshu content
        # as notes are not paginated like PDFs
        safe_filename = sanitize_filename(content_id)
        file_path = os.path.join(save_path, f"xiaohongshu_{safe_filename}.json")

        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)

            # Check for error in stored data
            if "error" in data:
                return f"Error: {data['error']}\n{data.get('message', '')}"

            # Format the note data as readable text
            return self._format_note_text(data)

        except FileNotFoundError:
            # If not downloaded, try to fetch directly
            if self.cookie:
                try:
                    note_id = content_id
                    if note_id.startswith("xhs_"):
                        note_id = note_id[4:]
                    note_data = self._fetch_note(note_id)
                    return self._format_note_text(note_data)
                except Exception as e:
                    logger.warning(f"Could not fetch note {content_id}: {e}")
            return f"Xiaohongshu content {content_id} (not downloaded yet)"

        except json.JSONDecodeError:
            return f"Xiaohongshu content {content_id} (invalid JSON)"

    def _format_note_text(self, data: Dict[str, Any]) -> str:
        """Format Xiaohongshu note data as readable text."""
        lines = []

        # Title
        title = data.get("title", "") or data.get("display_title", "")
        if title:
            lines.append(f"# {title}")
            lines.append("")

        # Author
        user = data.get("user", {})
        author = user.get("nickname", "") or user.get("name", "")
        if author:
            lines.append(f"**Author:** {author}")

        # Stats
        liked = data.get("liked_count", 0)
        collected = data.get("collected_count", 0)
        comments = data.get("comment_count", 0)
        lines.append(
            f"**Likes:** {liked}  **Collected:** {collected}  **Comments:** {comments}",
        )
        lines.append("")

        # Content
        desc = data.get("desc", "") or data.get("description", "")
        if desc:
            lines.append("---")
            lines.append("")
            lines.append(self._clean_html(desc))
            lines.append("")

        # Images
        images = data.get("images_list", []) or data.get("image_list", [])
        if images:
            lines.append("---")
            lines.append("")
            lines.append(f"**Images:** {len(images)} attached")
            for i, img in enumerate(images, 1):
                url = img.get("url", "") or img.get("info_list", [{}])[0].get("url", "")
                if url:
                    lines.append(f"  {i}. {url}")

        # URL
        note_id = data.get("note_id", "") or data.get("id", "")
        if note_id:
            lines.append("")
            lines.append(f"**URL:** {self.base_url}/explore/{note_id}")

        return "\n".join(lines)
