"""GitHub searcher implementation.

GitHub is a code hosting platform with social features including
repositories, issues, discussions, and pull requests.

This searcher can find:
- Repositories
- Issues and Pull Requests
- Code snippets
- Users

Note: This implementation uses GitHub's public REST API.
For higher rate limits, set GITHUB_TOKEN environment variable.
"""
import base64
import json
import os
from datetime import datetime
from typing import List, Optional

import httpx
from browse_mcp.types import ContentSource
from loguru import logger

from .types import SocialPost, sanitize_filename


class GithubSearcher(ContentSource[SocialPost]):
    """Searcher for GitHub platform.

    Environment Variables:
        GITHUB_TOKEN: Personal access token for authenticated requests
                     (provides higher rate limits: 30 req/min vs 10 req/min)
    """

    def __init__(self):
        """Initialize GitHub searcher."""
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.api_base = "https://api.github.com"
        self.web_base = "https://github.com"
        self._client: Optional[httpx.Client] = None

    @property
    def client(self) -> httpx.Client:
        """Get or create HTTP client with proper headers."""
        if self._client is None:
            headers = {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "browse-mcp-social-media-plugin",
            }
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
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
        """Parse GitHub datetime string to datetime object."""
        if not dt_str:
            return datetime.now()
        try:
            # GitHub uses ISO 8601 format: 2024-01-15T10:30:00Z
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now()

    def search(
        self,
        query: str,
        max_results: int = 10,
        search_type: str = "repositories",
        **kwargs,
    ) -> List[SocialPost]:
        """Search GitHub for content matching the query.

        Args:
            query: Search query string (supports GitHub search qualifiers)
            max_results: Maximum number of results to return (1-100)
            search_type: Type of content to search:
                        'repositories', 'issues', 'code', 'users'
            **kwargs: Additional parameters:
                - sort: Sort field (e.g., 'stars', 'forks', 'updated')
                - order: Sort order ('asc' or 'desc')
                - language: Filter by programming language (for repos/code)

        Returns:
            List of SocialPost objects representing GitHub content

        Search Query Examples:
            - "machine learning" - Simple keyword search
            - "machine learning language:python" - Filter by language
            - "machine learning stars:>1000" - Filter by stars
            - "machine learning in:readme" - Search in README files
        """
        if not query or not query.strip():
            logger.warning("Empty query provided to GitHub search")
            return []

        # Map search type to endpoint
        endpoint_map = {
            "repositories": "/search/repositories",
            "issues": "/search/issues",
            "code": "/search/code",
            "users": "/search/users",
        }

        if search_type not in endpoint_map:
            logger.warning(f"Invalid search_type: {search_type}, using 'repositories'")
            search_type = "repositories"

        endpoint = endpoint_map[search_type]

        # Build query parameters
        params = {
            "q": query.strip(),
            "per_page": min(max_results, 100),  # GitHub API max is 100
        }

        # Add optional sort parameters
        if "sort" in kwargs:
            params["sort"] = kwargs["sort"]
        if "order" in kwargs:
            params["order"] = kwargs["order"]

        try:
            response = self.client.get(f"{self.api_base}{endpoint}", params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                logger.error(
                    "GitHub API rate limit exceeded. "
                    "Set GITHUB_TOKEN for higher limits.",
                )
            elif e.response.status_code == 422:
                logger.error(f"Invalid search query: {query}")
            else:
                logger.error(
                    f"GitHub API error: {e.response.status_code} - {e.response.text}",
                )
            return []
        except httpx.RequestError as e:
            logger.error(f"Network error while searching GitHub: {e}")
            return []

        # Parse results based on search type
        posts = []
        items = data.get("items", [])

        for item in items[:max_results]:
            try:
                if search_type == "repositories":
                    post = self._parse_repository(item)
                elif search_type == "issues":
                    post = self._parse_issue(item)
                elif search_type == "code":
                    post = self._parse_code(item)
                elif search_type == "users":
                    post = self._parse_user(item)
                else:
                    continue

                if post:
                    posts.append(post)
            except Exception as e:
                logger.warning(f"Error parsing GitHub item: {e}")
                continue

        logger.info(f"GitHub search returned {len(posts)} results for '{query}'")
        return posts

    def _parse_repository(self, item: dict) -> SocialPost:
        """Parse repository search result to SocialPost."""
        return SocialPost(
            post_id=f"github_repo_{item['id']}",
            title=item.get("full_name", ""),
            content=item.get("description", "") or "No description provided.",
            author=item.get("owner", {}).get("login", "unknown"),
            platform="github",
            url=item.get("html_url", ""),
            published_date=self._parse_datetime(item.get("created_at", "")),
            tags=item.get("topics", []),
            likes=item.get("stargazers_count", 0),
            comments=item.get("open_issues_count", 0),
            shares=item.get("forks_count", 0),
            extra={
                "type": "repository",
                "repo_name": item.get("full_name", ""),
                "language": item.get("language", ""),
                "license": item.get("license", {}).get("name", "")
                if item.get("license")
                else "",
                "is_fork": item.get("fork", False),
                "default_branch": item.get("default_branch", "main"),
                "watchers": item.get("watchers_count", 0),
                "size_kb": item.get("size", 0),
                "updated_at": item.get("updated_at", ""),
            },
        )

    def _parse_issue(self, item: dict) -> SocialPost:
        """Parse issue/PR search result to SocialPost."""
        # Determine if it's a PR or issue
        is_pr = "pull_request" in item
        item_type = "pull_request" if is_pr else "issue"

        # Extract repo info from URL
        repo_url = item.get("repository_url", "")
        repo_name = "/".join(repo_url.split("/")[-2:]) if repo_url else ""

        labels = [label.get("name", "") for label in item.get("labels", [])]

        reactions = item.get("reactions", {})
        reaction_count = (
            reactions.get("total_count", 0) if isinstance(reactions, dict) else 0
        )

        return SocialPost(
            post_id=f"github_{item_type}_{item['id']}",
            title=item.get("title", ""),
            content=item.get("body", "") or "No description provided.",
            author=item.get("user", {}).get("login", "unknown"),
            platform="github",
            url=item.get("html_url", ""),
            published_date=self._parse_datetime(item.get("created_at", "")),
            tags=labels,
            likes=reaction_count,
            comments=item.get("comments", 0),
            extra={
                "type": item_type,
                "repo": repo_name,
                "state": item.get("state", ""),
                "number": item.get("number", 0),
                "labels": labels,
                "assignees": [a.get("login", "") for a in item.get("assignees", [])],
                "updated_at": item.get("updated_at", ""),
                "closed_at": item.get("closed_at", ""),
            },
        )

    def _parse_code(self, item: dict) -> SocialPost:
        """Parse code search result to SocialPost."""
        repo = item.get("repository", {})
        repo_name = repo.get("full_name", "")

        return SocialPost(
            post_id=f"github_code_{item.get('sha', '')}",
            title=f"{repo_name}: {item.get('name', '')}",
            content=item.get("path", ""),  # Code content requires additional API call
            author=repo.get("owner", {}).get("login", "unknown"),
            platform="github",
            url=item.get("html_url", ""),
            published_date=datetime.now(),  # Code search doesn't return dates
            tags=[],
            extra={
                "type": "code",
                "repo": repo_name,
                "path": item.get("path", ""),
                "filename": item.get("name", ""),
                "sha": item.get("sha", ""),
            },
        )

    def _parse_user(self, item: dict) -> SocialPost:
        """Parse user search result to SocialPost."""
        return SocialPost(
            post_id=f"github_user_{item['id']}",
            title=item.get("login", ""),
            content=f"GitHub user: {item.get('login', '')}",
            author=item.get("login", ""),
            platform="github",
            url=item.get("html_url", ""),
            published_date=datetime.now(),  # User search doesn't return creation date
            tags=[item.get("type", "User")],
            extra={
                "type": "user",
                "user_type": item.get("type", "User"),
                "avatar_url": item.get("avatar_url", ""),
                "score": item.get("score", 0),
            },
        )

    def download(self, content_id: str, save_path: str) -> str:
        """Download GitHub content.

        Depending on content type, downloads:
        - Repository: README.md and metadata as markdown
        - Issue/PR: Full details as markdown
        - User: Profile info as JSON

        Args:
            content_id: GitHub content identifier. Formats:
                - Repository: 'owner/repo' or 'repo:owner/repo'
                - Issue/PR: 'owner/repo#123' or 'issue:owner/repo/123'
                - User: 'user:username'
            save_path: Directory to save downloaded content

        Returns:
            Path to downloaded file
        """
        safe_filename = sanitize_filename(content_id)

        # Parse content_id to determine type and fetch appropriate data
        try:
            content_data = self._fetch_content(content_id)
        except Exception as e:
            logger.error(f"Error fetching GitHub content {content_id}: {e}")
            # Write error info to file
            output_path = os.path.join(save_path, f"github_{safe_filename}.md")
            with open(output_path, "w", encoding="utf-8") as f:
                error_msg = (
                    f"# Error fetching GitHub content\n\n"
                    f"Content ID: {content_id}\nError: {e}\n"
                )
                f.write(error_msg)
            return output_path

        # Determine output format based on content type
        content_type = content_data.get("_type", "unknown")

        if content_type in ("repository", "issue", "pull_request"):
            output_path = os.path.join(save_path, f"github_{safe_filename}.md")
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(self._format_as_markdown(content_data))
        else:
            output_path = os.path.join(save_path, f"github_{safe_filename}.json")
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(content_data, f, ensure_ascii=False, indent=2, default=str)

        logger.info(f"Downloaded GitHub content to {output_path}")
        return output_path

    def _fetch_content(self, content_id: str) -> dict:
        """Fetch content from GitHub API based on content_id format."""
        # Parse content_id format
        if content_id.startswith("user:"):
            username = content_id[5:]
            return self._fetch_user_profile(username)
        elif content_id.startswith("repo:"):
            repo = content_id[5:]
            return self._fetch_repository_details(repo)
        elif content_id.startswith("issue:"):
            # Format: issue:owner/repo/number
            parts = content_id[6:].rsplit("/", 1)
            if len(parts) == 2:
                repo, number = parts
                return self._fetch_issue_details(repo, int(number))
        elif "#" in content_id:
            # Format: owner/repo#123
            repo, number = content_id.split("#", 1)
            return self._fetch_issue_details(repo, int(number))
        elif "/" in content_id and not content_id.startswith("github_"):
            # Assume it's a repository: owner/repo
            return self._fetch_repository_details(content_id)

        raise ValueError(f"Unknown content_id format: {content_id}")

    def _fetch_repository_details(self, repo: str) -> dict:
        """Fetch repository details including README."""
        response = self.client.get(f"{self.api_base}/repos/{repo}")
        response.raise_for_status()
        data = response.json()
        data["_type"] = "repository"

        # Try to fetch README
        try:
            readme_response = self.client.get(f"{self.api_base}/repos/{repo}/readme")
            if readme_response.status_code == 200:
                readme_data = readme_response.json()
                # Decode base64 content
                readme_content = base64.b64decode(
                    readme_data.get("content", ""),
                ).decode("utf-8")
                data["_readme"] = readme_content
        except Exception:
            data["_readme"] = ""

        return data

    def _fetch_issue_details(self, repo: str, number: int) -> dict:
        """Fetch issue or PR details including comments."""
        response = self.client.get(f"{self.api_base}/repos/{repo}/issues/{number}")
        response.raise_for_status()
        data = response.json()

        # Determine if it's a PR
        if "pull_request" in data:
            data["_type"] = "pull_request"
        else:
            data["_type"] = "issue"

        # Fetch comments
        try:
            comments_response = self.client.get(
                f"{self.api_base}/repos/{repo}/issues/{number}/comments",
                params={"per_page": 100},
            )
            if comments_response.status_code == 200:
                data["_comments"] = comments_response.json()
        except Exception:
            data["_comments"] = []

        return data

    def _fetch_user_profile(self, username: str) -> dict:
        """Fetch user profile details."""
        response = self.client.get(f"{self.api_base}/users/{username}")
        response.raise_for_status()
        data = response.json()
        data["_type"] = "user"
        return data

    def _format_as_markdown(self, data: dict) -> str:
        """Format GitHub content as readable markdown."""
        content_type = data.get("_type", "unknown")
        lines = []

        if content_type == "repository":
            lines.append(f"# {data.get('full_name', 'Repository')}")
            lines.append("")
            lines.append(
                f"**Description:** {data.get('description', 'No description')}",
            )
            lines.append(f"**Language:** {data.get('language', 'N/A')}")
            lines.append(f"**Stars:** {data.get('stargazers_count', 0)}")
            lines.append(f"**Forks:** {data.get('forks_count', 0)}")
            lines.append(f"**Open Issues:** {data.get('open_issues_count', 0)}")
            license_info = data.get("license")
            license_name = license_info.get("name", "N/A") if license_info else "N/A"
            lines.append(f"**License:** {license_name}")
            lines.append(f"**URL:** {data.get('html_url', '')}")
            lines.append("")

            if data.get("_readme"):
                lines.append("## README")
                lines.append("")
                lines.append(data["_readme"])

        elif content_type in ("issue", "pull_request"):
            type_name = "Pull Request" if content_type == "pull_request" else "Issue"
            lines.append(f"# {type_name}: {data.get('title', 'Untitled')}")
            lines.append("")
            lines.append(f"**State:** {data.get('state', 'unknown')}")
            lines.append(f"**Author:** @{data.get('user', {}).get('login', 'unknown')}")
            lines.append(f"**Created:** {data.get('created_at', '')}")
            lines.append(f"**URL:** {data.get('html_url', '')}")
            lines.append("")

            labels = [label.get("name", "") for label in data.get("labels", [])]
            if labels:
                lines.append(f"**Labels:** {', '.join(labels)}")
                lines.append("")

            lines.append("## Description")
            lines.append("")
            lines.append(
                data.get("body", "No description provided.")
                or "No description provided.",
            )
            lines.append("")

            comments = data.get("_comments", [])
            if comments:
                lines.append(f"## Comments ({len(comments)})")
                lines.append("")
                for comment in comments:
                    author = comment.get("user", {}).get("login", "unknown")
                    created = comment.get("created_at", "")
                    body = comment.get("body", "")
                    lines.append(f"### @{author} ({created})")
                    lines.append("")
                    lines.append(body)
                    lines.append("")

        return "\n".join(lines)

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and extract text from downloaded GitHub content.

        Args:
            content_id: GitHub content identifier
            save_path: Directory containing downloaded content
            page: Specific page number (ignored for GitHub - not paginated)
            start_page: Start page for range extraction (ignored for GitHub)
            end_page: End page for range extraction (ignored for GitHub)

        Returns:
            Extracted text content
        """
        # Note: page, start_page, end_page are ignored for GitHub content
        # as GitHub content is not paginated like PDFs
        safe_filename = sanitize_filename(content_id)

        # Try markdown first, then JSON
        md_path = os.path.join(save_path, f"github_{safe_filename}.md")
        json_path = os.path.join(save_path, f"github_{safe_filename}.json")

        if os.path.exists(md_path):
            with open(md_path, encoding="utf-8") as f:
                return f.read()
        elif os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
                return json.dumps(data, ensure_ascii=False, indent=2)

        # If not downloaded, try to fetch and return directly
        try:
            content_data = self._fetch_content(content_id)
            return self._format_as_markdown(content_data)
        except Exception as e:
            logger.warning(f"Could not read GitHub content {content_id}: {e}")
            return f"GitHub content {content_id} (not downloaded yet, fetch error: {e})"
