"""Zhihu (知乎) searcher implementation.

Zhihu is a Chinese question-and-answer platform similar to Quora.
This searcher retrieves questions, answers, and articles from Zhihu.

Note: Zhihu does not provide an official public API. This implementation uses:
1. Zhihu's internal API endpoints (reverse-engineered from web/mobile)
2. Web scraping as fallback

Important considerations:
- Rate limiting: Respect Zhihu's rate limits
- Authentication: Some content requires login
- Terms of Service: Use responsibly
- Anti-scraping: Zhihu has measures against automated access

Environment Variables:
    ZHIHU_COOKIE: Browser cookie for authenticated requests (optional)
"""
import os
import re
from datetime import datetime
from html import unescape
from typing import Any, Dict, List, Optional

import httpx
from browse_mcp.types import ContentSource
from loguru import logger

from .types import SocialPost, sanitize_filename


class ZhihuSearcher(ContentSource[SocialPost]):
    """Searcher for Zhihu platform.

    This searcher uses Zhihu's internal API endpoints to search for content.
    Results include questions, answers, and articles (zhuanlan).

    Environment Variables:
        ZHIHU_COOKIE: Browser cookie string for authenticated requests
                     (provides access to more content and higher rate limits)
    """

    def __init__(self):
        """Initialize Zhihu searcher."""
        self.cookie = os.getenv("ZHIHU_COOKIE", "")
        self.base_url = "https://www.zhihu.com"
        self.api_url = "https://www.zhihu.com/api/v4"
        self._client: Optional[httpx.Client] = None

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
                "Referer": "https://www.zhihu.com/",
                "Origin": "https://www.zhihu.com",
                "x-requested-with": "fetch",
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
        """Parse Zhihu timestamp to datetime object."""
        if not timestamp:
            return datetime.now()
        try:
            if isinstance(timestamp, (int, float)):
                return datetime.fromtimestamp(timestamp)
            elif isinstance(timestamp, str):
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
        # Clean up whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def search(
        self,
        query: str,
        max_results: int = 10,
        search_type: str = "general",
        **kwargs,
    ) -> List[SocialPost]:
        """Search Zhihu for content matching the query.

        Args:
            query: Search query string
            max_results: Maximum number of results to return
            search_type: Type of content to search:
                        'general' - All content types
                        'question' - Questions only
                        'answer' - Answers only
                        'article' - Articles (zhuanlan) only
                        'user' - Users only
            **kwargs: Additional parameters:
                - offset: Pagination offset
                - sort: Sort order ('default', 'upvoted_count', 'created_time')

        Returns:
            List of SocialPost objects representing Zhihu content
        """
        if not query or not query.strip():
            logger.warning("Empty query provided to Zhihu search")
            return []

        # Map search type to API type parameter
        type_map = {
            "general": "general",
            "question": "question",
            "answer": "answer",
            "article": "article",
            "user": "people",
        }

        search_type_param = type_map.get(search_type, "general")

        # Build API URL for search
        # Zhihu uses /api/v4/search_v3 endpoint
        params = {
            "q": query.strip(),
            "t": search_type_param,
            "correction": "1",
            "offset": kwargs.get("offset", 0),
            "limit": min(max_results, 20),  # API typically limits to 20 per page
        }

        try:
            response = self.client.get(f"{self.api_url}/search_v3", params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("Zhihu API requires authentication for this request.")
            elif e.response.status_code == 403:
                logger.error(
                    "Zhihu API access forbidden. "
                    "Try setting ZHIHU_COOKIE environment variable.",
                )
            elif e.response.status_code == 429:
                logger.error(
                    "Zhihu API rate limit exceeded. Please wait and try again.",
                )
            else:
                logger.error(f"Zhihu API error: {e.response.status_code}")
            return []
        except httpx.RequestError as e:
            logger.error(f"Network error while searching Zhihu: {e}")
            return []

        # Parse results
        posts = []
        items = data.get("data", [])

        for item in items[:max_results]:
            try:
                post = self._parse_search_result(item)
                if post:
                    posts.append(post)
            except Exception as e:
                logger.warning(f"Error parsing Zhihu item: {e}")
                continue

        logger.info(f"Zhihu search returned {len(posts)} results for '{query}'")
        return posts

    def _parse_search_result(self, item: dict) -> Optional[SocialPost]:
        """Parse Zhihu search result to SocialPost."""
        item_type = item.get("type", "")

        # Handle different result types
        if item_type == "search_result":
            # Nested result object
            obj = item.get("object", {})
            return self._parse_content_object(obj)
        elif item_type in ("answer", "question", "article", "zvideo"):
            return self._parse_content_object(item)

        return None

    def _parse_content_object(self, obj: dict) -> Optional[SocialPost]:
        """Parse a Zhihu content object to SocialPost."""
        obj_type = obj.get("type", "")

        if obj_type == "answer":
            return self._parse_answer(obj)
        elif obj_type == "question":
            return self._parse_question(obj)
        elif obj_type == "article":
            return self._parse_article(obj)
        elif obj_type == "zvideo":
            return self._parse_video(obj)

        return None

    def _parse_answer(self, answer: dict) -> SocialPost:
        """Parse Zhihu answer to SocialPost."""
        answer_id = str(answer.get("id", ""))
        question = answer.get("question", {})
        question_id = str(question.get("id", ""))
        author = answer.get("author", {})

        content = answer.get("content", "") or answer.get("excerpt", "")
        content = self._clean_html(content)

        return SocialPost(
            post_id=f"zhihu_answer_{answer_id}",
            title=question.get("title", ""),
            content=content,
            author=author.get("name", "匿名用户"),
            platform="zhihu",
            url=f"{self.base_url}/question/{question_id}/answer/{answer_id}",
            published_date=self._parse_datetime(answer.get("created_time")),
            tags=[],
            likes=answer.get("voteup_count", 0),
            comments=answer.get("comment_count", 0),
            extra={
                "type": "answer",
                "question_id": question_id,
                "answer_id": answer_id,
                "author_url_token": author.get("url_token", ""),
                "is_collapsed": answer.get("is_collapsed", False),
                "updated_time": answer.get("updated_time"),
            },
        )

    def _parse_question(self, question: dict) -> SocialPost:
        """Parse Zhihu question to SocialPost."""
        question_id = str(question.get("id", ""))
        author = question.get("author", {})

        detail = question.get("detail", "") or question.get("excerpt", "")
        detail = self._clean_html(detail)

        # Get topics as tags
        topics = question.get("topics", [])
        tags = [t.get("name", "") for t in topics if t.get("name")]

        return SocialPost(
            post_id=f"zhihu_question_{question_id}",
            title=question.get("title", ""),
            content=detail,
            author=author.get("name", "匿名用户"),
            platform="zhihu",
            url=f"{self.base_url}/question/{question_id}",
            published_date=self._parse_datetime(question.get("created")),
            tags=tags,
            likes=question.get("follower_count", 0),
            comments=question.get("answer_count", 0),
            extra={
                "type": "question",
                "question_id": question_id,
                "answer_count": question.get("answer_count", 0),
                "follower_count": question.get("follower_count", 0),
                "view_count": question.get("visit_count", 0),
            },
        )

    def _parse_article(self, article: dict) -> SocialPost:
        """Parse Zhihu article (zhuanlan) to SocialPost."""
        article_id = str(article.get("id", ""))
        author = article.get("author", {})

        content = article.get("content", "") or article.get("excerpt", "")
        content = self._clean_html(content)

        # Get topics as tags
        topics = article.get("topics", [])
        tags = [t.get("name", "") for t in topics if t.get("name")]

        return SocialPost(
            post_id=f"zhihu_article_{article_id}",
            title=article.get("title", ""),
            content=content,
            author=author.get("name", "匿名用户"),
            platform="zhihu",
            url=f"{self.base_url}/p/{article_id}",
            published_date=self._parse_datetime(article.get("created")),
            tags=tags,
            likes=article.get("voteup_count", 0),
            comments=article.get("comment_count", 0),
            extra={
                "type": "article",
                "article_id": article_id,
                "author_url_token": author.get("url_token", ""),
                "image_url": article.get("image_url", ""),
            },
        )

    def _parse_video(self, video: dict) -> SocialPost:
        """Parse Zhihu video to SocialPost."""
        video_id = str(video.get("id", ""))
        author = video.get("author", {})

        return SocialPost(
            post_id=f"zhihu_video_{video_id}",
            title=video.get("title", ""),
            content=video.get("description", ""),
            author=author.get("name", "匿名用户"),
            platform="zhihu",
            url=f"{self.base_url}/zvideo/{video_id}",
            published_date=self._parse_datetime(video.get("created_at")),
            tags=[],
            likes=video.get("voteup_count", 0),
            comments=video.get("comment_count", 0),
            media_urls=[video.get("cover_url", "")] if video.get("cover_url") else [],
            extra={
                "type": "zvideo",
                "video_id": video_id,
                "play_count": video.get("play_count", 0),
                "duration": video.get("duration", 0),
            },
        )

    def download(self, content_id: str, save_path: str) -> str:
        """Download Zhihu content.

        Downloads the full content and saves as markdown.

        Args:
            content_id: Zhihu content ID. Formats:
                - Answer: 'answer:123456' or 'question_id/answer/answer_id'
                - Question: 'question:123456' or 'question/123456'
                - Article: 'article:123456' or 'p/123456'
            save_path: Directory to save downloaded content

        Returns:
            Path to downloaded file
        """
        safe_filename = sanitize_filename(content_id)
        output_path = os.path.join(save_path, f"zhihu_{safe_filename}.md")

        try:
            content_data = self._fetch_content(content_id)
        except Exception as e:
            logger.error(f"Error fetching Zhihu content {content_id}: {e}")
            with open(output_path, "w", encoding="utf-8") as f:
                error_msg = (
                    f"# Error fetching Zhihu content\n\n"
                    f"Content ID: {content_id}\nError: {e}\n"
                )
                f.write(error_msg)
            return output_path

        # Format as markdown
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self._format_as_markdown(content_data))

        logger.info(f"Downloaded Zhihu content to {output_path}")
        return output_path

    def _fetch_content(self, content_id: str) -> Dict[str, Any]:
        """Fetch content from Zhihu API based on content_id format."""
        # Parse content_id format
        if content_id.startswith("answer:"):
            answer_id = content_id[7:]
            return self._fetch_answer(answer_id)
        elif content_id.startswith("question:"):
            question_id = content_id[9:]
            return self._fetch_question(question_id)
        elif content_id.startswith("article:"):
            article_id = content_id[8:]
            return self._fetch_article(article_id)
        elif content_id.startswith("zhihu_answer_"):
            answer_id = content_id[13:]
            return self._fetch_answer(answer_id)
        elif content_id.startswith("zhihu_question_"):
            question_id = content_id[15:]
            return self._fetch_question(question_id)
        elif content_id.startswith("zhihu_article_"):
            article_id = content_id[14:]
            return self._fetch_article(article_id)
        elif "/answer/" in content_id:
            # Format: question_id/answer/answer_id
            parts = content_id.split("/answer/")
            if len(parts) == 2:
                return self._fetch_answer(parts[1])
        elif content_id.startswith("p/"):
            return self._fetch_article(content_id[2:])

        raise ValueError(f"Unknown content_id format: {content_id}")

    def _fetch_answer(self, answer_id: str) -> Dict[str, Any]:
        """Fetch answer details from API."""
        url = f"{self.api_url}/answers/{answer_id}"
        params = {"include": "content,voteup_count,comment_count,created_time,question"}
        response = self.client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        data["_type"] = "answer"
        return data

    def _fetch_question(self, question_id: str) -> Dict[str, Any]:
        """Fetch question details from API."""
        url = f"{self.api_url}/questions/{question_id}"
        params = {"include": "detail,topics,answer_count,follower_count"}
        response = self.client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        data["_type"] = "question"
        return data

    def _fetch_article(self, article_id: str) -> Dict[str, Any]:
        """Fetch article details from API."""
        url = f"{self.api_url}/articles/{article_id}"
        response = self.client.get(url)
        response.raise_for_status()
        data = response.json()
        data["_type"] = "article"
        return data

    def _format_as_markdown(self, data: Dict[str, Any]) -> str:
        """Format Zhihu content as readable markdown."""
        content_type = data.get("_type", data.get("type", "unknown"))
        lines = []

        if content_type == "answer":
            question = data.get("question", {})
            author = data.get("author", {})

            lines.append(f"# {question.get('title', 'Untitled Question')}")
            lines.append("")
            lines.append(f"**Answer by:** {author.get('name', '匿名用户')}")
            lines.append(f"**Upvotes:** {data.get('voteup_count', 0)}")
            lines.append(f"**Comments:** {data.get('comment_count', 0)}")
            q_id = question.get('id')
            a_id = data.get('id')
            lines.append(f"**URL:** {self.base_url}/question/{q_id}/answer/{a_id}")
            lines.append("")
            lines.append("---")
            lines.append("")

            content = data.get("content", "")
            content = self._clean_html(content)
            lines.append(content)

        elif content_type == "question":
            lines.append(f"# {data.get('title', 'Untitled Question')}")
            lines.append("")
            lines.append(f"**Answers:** {data.get('answer_count', 0)}")
            lines.append(f"**Followers:** {data.get('follower_count', 0)}")
            lines.append(f"**URL:** {self.base_url}/question/{data.get('id')}")
            lines.append("")

            topics = data.get("topics", [])
            if topics:
                topic_names = [t.get("name", "") for t in topics if t.get("name")]
                lines.append(f"**Topics:** {', '.join(topic_names)}")
                lines.append("")

            lines.append("---")
            lines.append("")

            detail = data.get("detail", "")
            detail = self._clean_html(detail)
            lines.append(detail)

        elif content_type == "article":
            author = data.get("author", {})

            lines.append(f"# {data.get('title', 'Untitled Article')}")
            lines.append("")
            lines.append(f"**Author:** {author.get('name', '匿名用户')}")
            lines.append(f"**Upvotes:** {data.get('voteup_count', 0)}")
            lines.append(f"**Comments:** {data.get('comment_count', 0)}")
            lines.append(f"**URL:** {self.base_url}/p/{data.get('id')}")
            lines.append("")
            lines.append("---")
            lines.append("")

            content = data.get("content", "")
            content = self._clean_html(content)
            lines.append(content)

        return "\n".join(lines)

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and extract text from downloaded Zhihu content.

        Args:
            content_id: Zhihu content ID
            save_path: Directory containing downloaded content
            page: Specific page number (ignored for Zhihu - not paginated)
            start_page: Start page for range extraction (ignored for Zhihu)
            end_page: End page for range extraction (ignored for Zhihu)

        Returns:
            Extracted text content
        """
        # Note: page, start_page, end_page are ignored for Zhihu content
        # as Zhihu content is not paginated like PDFs
        safe_filename = sanitize_filename(content_id)
        file_path = os.path.join(save_path, f"zhihu_{safe_filename}.md")

        if os.path.exists(file_path):
            with open(file_path, encoding="utf-8") as f:
                return f.read()

        # If not downloaded, try to fetch directly
        try:
            content_data = self._fetch_content(content_id)
            return self._format_as_markdown(content_data)
        except Exception as e:
            logger.warning(f"Could not read Zhihu content {content_id}: {e}")
            return f"Zhihu content {content_id} (not downloaded yet, fetch error: {e})"
