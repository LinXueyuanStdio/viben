"""HTTP client for Context7 API.

This module provides a client for interacting with the Context7 API
to resolve library IDs and fetch documentation.
"""
import os
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger


class Context7Client:
    """HTTP client for Context7 API.

    This client handles communication with the Context7 service to:
    - Resolve library names to Context7-compatible IDs
    - Fetch documentation for libraries

    Environment Variables:
        CONTEXT7_API_KEY: Optional API key for authenticated requests.
                         May provide higher rate limits.
    """

    BASE_URL = "https://context7.com/api"

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Context7 client.

        Args:
            api_key: Optional API key. If not provided, will try to read
                    from CONTEXT7_API_KEY environment variable.
        """
        self.api_key = api_key or os.getenv("CONTEXT7_API_KEY")
        if not self.api_key:
            logger.warning(
                "No CONTEXT7_API_KEY found. Requests may be rate-limited. "
                "Set CONTEXT7_API_KEY environment variable for higher limits."
            )
        self._client: Optional[httpx.Client] = None

    def _get_client(self) -> httpx.Client:
        """Get or create HTTP client with proper headers.

        Returns:
            Configured httpx.Client instance.
        """
        if self._client is None:
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            self._client = httpx.Client(
                base_url=self.BASE_URL,
                headers=headers,
                timeout=30.0,
            )
        return self._client

    def close(self) -> None:
        """Close the HTTP client."""
        if self._client is not None:
            self._client.close()
            self._client = None

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

    def resolve_library_id(
        self,
        library_name: str,
    ) -> List[Dict[str, Any]]:
        """Resolve a library name to Context7-compatible library IDs.

        This method searches for libraries matching the given name and
        returns a list of potential matches with their IDs.

        Args:
            library_name: The name of the library to search for
                         (e.g., "next.js", "react", "mongodb")

        Returns:
            List of dictionaries containing library information:
            - id: The Context7 library ID (e.g., "/vercel/next.js")
            - name: The library display name
            - description: Library description
            - trust_score: Context7 trust score

        Raises:
            httpx.HTTPStatusError: If the API request fails.
        """
        client = self._get_client()

        try:
            response = client.post(
                "/v1/resolve",
                json={"libraryName": library_name},
            )
            response.raise_for_status()
            data = response.json()

            # Extract library matches from response
            libraries = data.get("libraries", [])
            logger.debug(f"Resolved '{library_name}' to {len(libraries)} libraries")

            return libraries

        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to resolve library '{library_name}': {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error resolving library '{library_name}': {e}")
            raise

    def get_library_docs(
        self,
        library_id: str,
        topic: Optional[str] = None,
        tokens: int = 10000,
    ) -> Dict[str, Any]:
        """Fetch documentation for a library.

        Args:
            library_id: The Context7 library ID (e.g., "/vercel/next.js")
            topic: Optional topic to filter documentation
                  (e.g., "routing", "data fetching")
            tokens: Maximum number of tokens to return (default: 10000)

        Returns:
            Dictionary containing documentation content:
            - content: The documentation text
            - code_examples: List of code snippets
            - url: Source URL
            - metadata: Additional information

        Raises:
            httpx.HTTPStatusError: If the API request fails.
        """
        client = self._get_client()

        payload: Dict[str, Any] = {
            "libraryId": library_id,
            "tokens": tokens,
        }
        if topic:
            payload["topic"] = topic

        try:
            response = client.post(
                "/v1/docs",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            logger.debug(
                f"Retrieved docs for '{library_id}'" f"{f' (topic: {topic})' if topic else ''}"
            )

            return data

        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to get docs for library '{library_id}': {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting docs for '{library_id}': {e}")
            raise

    def search_docs(
        self,
        library_id: str,
        query: str,
        tokens: int = 10000,
        topic: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search documentation for a specific query.

        This method performs a semantic search within a library's documentation.

        Args:
            library_id: The Context7 library ID
            query: Search query for finding relevant documentation
            tokens: Maximum number of tokens to return (default: 10000)
            topic: Optional topic filter

        Returns:
            Dictionary containing search results with documentation content.

        Raises:
            httpx.HTTPStatusError: If the API request fails.
        """
        client = self._get_client()

        payload: Dict[str, Any] = {
            "libraryId": library_id,
            "query": query,
            "tokens": tokens,
        }
        if topic:
            payload["topic"] = topic

        try:
            response = client.post(
                "/v1/search",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            logger.debug(f"Searched docs for '{library_id}' with query '{query}'")

            return data

        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to search docs for '{library_id}': {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error searching docs for '{library_id}': {e}")
            raise
