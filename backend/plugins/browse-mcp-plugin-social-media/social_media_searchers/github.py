"""GitHub searcher implementation.

GitHub is a code hosting platform with social features including
repositories, issues, discussions, and pull requests.

This searcher can find:
- Repositories
- Issues and Pull Requests
- Discussions
- Code snippets
- Users

Note: This implementation uses GitHub's public API.
For higher rate limits, set GITHUB_TOKEN environment variable.
"""
import os
from datetime import datetime
from typing import List
from browse_mcp.types import ContentSource
from .types import SocialPost, sanitize_filename


class GithubSearcher(ContentSource[SocialPost]):
    """Searcher for GitHub platform.

    Environment Variables:
        GITHUB_TOKEN: Personal access token for authenticated requests
                     (provides higher rate limits)
    """

    def __init__(self):
        """Initialize GitHub searcher."""
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.api_base = "https://api.github.com"
        self.web_base = "https://github.com"

    def search(
        self,
        query: str,
        max_results: int = 10,
        search_type: str = "repositories",
        **kwargs,
    ) -> List[SocialPost]:
        """Search GitHub for content matching the query.

        Args:
            query: Search query string
            max_results: Maximum number of results to return
            search_type: Type of content to search:
                        'repositories', 'issues', 'discussions', 'code', 'users'
            **kwargs: Additional parameters (e.g., language, sort, order)

        Returns:
            List of SocialPost objects representing GitHub content
        """
        # TODO: Implement actual GitHub API search
        # Use: https://docs.github.com/en/rest/search
        posts = []

        # Example placeholder result for repository
        if search_type == "repositories":
            posts.append(
                SocialPost(
                    post_id="github_repo_12345",
                    title=f"Repository: {query}",
                    content=f"A repository about {query}. "
                    "This repository provides tools and utilities for...",
                    author="octocat",
                    platform="github",
                    url=f"{self.web_base}/octocat/example-repo",
                    published_date=datetime.now(),
                    tags=["python", "machine-learning", query],
                    likes=2345,  # Stars
                    comments=123,  # Issues
                    shares=456,  # Forks
                    extra={
                        "repo_name": "octocat/example-repo",
                        "language": "Python",
                        "license": "MIT",
                        "is_fork": False,
                        "open_issues": 123,
                        "watchers": 567,
                    },
                )
            )

        # Example placeholder result for issue
        elif search_type == "issues":
            posts.append(
                SocialPost(
                    post_id="github_issue_67890",
                    title=f"Issue: {query}",
                    content=f"I encountered a problem with {query}...\n\n"
                    "Steps to reproduce:\n1. ...\n2. ...",
                    author="contributor123",
                    platform="github",
                    url=f"{self.web_base}/owner/repo/issues/123",
                    published_date=datetime.now(),
                    tags=["bug", "help wanted", query],
                    likes=45,  # Reactions
                    comments=12,
                    extra={
                        "repo": "owner/repo",
                        "state": "open",
                        "labels": ["bug", "help wanted"],
                        "assignees": ["maintainer1"],
                    },
                )
            )

        return posts[:max_results]

    def download(self, content_id: str, save_path: str) -> str:
        """Download GitHub content.

        Depending on content type, downloads:
        - Repository: Clone or download zip
        - Issue/PR: Save as markdown
        - Discussion: Save as markdown

        Args:
            content_id: GitHub content identifier (e.g., 'owner/repo', 'owner/repo#123')
            save_path: Directory to save downloaded content

        Returns:
            Path to downloaded file or directory
        """
        # TODO: Implement GitHub content download
        # Sanitize content_id to prevent path traversal and invalid filename characters
        safe_filename = sanitize_filename(content_id)
        output_path = os.path.join(save_path, f"github_{safe_filename}.md")

        # Placeholder implementation
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(f"# GitHub Content: {content_id}\n\nContent here...")

        return output_path

    def read(self, content_id: str, save_path: str) -> str:
        """Read and extract text from downloaded GitHub content.

        Args:
            content_id: GitHub content identifier
            save_path: Directory containing downloaded content

        Returns:
            Extracted text content
        """
        # TODO: Implement text extraction
        # Sanitize content_id to prevent path traversal and invalid filename characters
        safe_filename = sanitize_filename(content_id)
        file_path = os.path.join(save_path, f"github_{safe_filename}.md")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            return f"GitHub content {content_id} (not downloaded yet)"
