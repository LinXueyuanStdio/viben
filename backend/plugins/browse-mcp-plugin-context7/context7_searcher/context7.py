"""Context7 documentation searcher implementation.

This module provides a searcher for retrieving up-to-date library/framework
documentation through the Context7 service. It enables searching and
retrieving documentation directly through the browse-mcp interface.

Context7 provides:
- Semantic search across library documentation
- Up-to-date documentation content
- Code examples and snippets
- Support for many popular libraries and frameworks

Environment Variables:
    CONTEXT7_API_KEY: Optional API key for authenticated requests.
"""
import json
import os
from typing import List, Optional

from browse_mcp.types import ContentSource
from loguru import logger

from .client import Context7Client
from .types import LibraryDoc, sanitize_filename


class Context7Searcher(ContentSource[LibraryDoc]):
    """Searcher for library documentation via Context7.

    This class implements the ContentSource interface to provide
    documentation search and retrieval through Context7's service.

    Example usage:
        >>> searcher = Context7Searcher()
        >>> docs = searcher.search("next.js routing")
        >>> for doc in docs:
        ...     print(doc.to_text())

    Environment Variables:
        CONTEXT7_API_KEY: Optional API key for authenticated requests.
                         Set this for higher rate limits.
    """

    def __init__(self):
        """Initialize the Context7 searcher."""
        self._client: Optional[Context7Client] = None

    @property
    def client(self) -> Context7Client:
        """Get or create the Context7 client.

        Returns:
            Configured Context7Client instance.
        """
        if self._client is None:
            self._client = Context7Client()
        return self._client

    def search(
        self,
        query: str,
        max_results: int = 5,
        tokens: int = 10000,
        topic: Optional[str] = None,
        library_id: Optional[str] = None,
        **kwargs,
    ) -> List[LibraryDoc]:
        """Search for library documentation.

        This method first resolves the query to find matching libraries,
        then retrieves documentation for each library.

        Args:
            query: Search query string. Can be a library name (e.g., "next.js")
                  or a specific topic (e.g., "react hooks")
            max_results: Maximum number of documentation results to return
                        (default: 5)
            tokens: Maximum tokens per documentation result (default: 10000)
            topic: Optional topic filter to focus the documentation
                  (e.g., "routing", "authentication")
            library_id: Optional specific library ID to search within.
                       If provided, skips library resolution.
            **kwargs: Additional parameters (reserved for future use)

        Returns:
            List of LibraryDoc objects containing documentation.

        Example:
            >>> searcher = Context7Searcher()
            >>> # Search for Next.js routing documentation
            >>> docs = searcher.search("next.js", topic="routing")
            >>> # Search with specific library ID
            >>> docs = searcher.search(
            ...     "data fetching",
            ...     library_id="/vercel/next.js"
            ... )
        """
        results: List[LibraryDoc] = []

        try:
            if library_id:
                # Direct search within specific library
                libraries = [{"id": library_id, "name": library_id.split("/")[-1]}]
            else:
                # Resolve query to find libraries
                libraries = self.client.resolve_library_id(query)

            if not libraries:
                logger.info(f"No libraries found for query: {query}")
                return results

            # Limit libraries to search
            libraries_to_search = libraries[:max_results]

            for lib in libraries_to_search:
                lib_id = lib.get("id", "")
                lib_name = lib.get("name", lib_id.split("/")[-1] if lib_id else "Unknown")
                lib_description = lib.get("description", "")
                trust_score = lib.get("trustScore")

                try:
                    # Get documentation for this library
                    if library_id:
                        # Use search when we have a specific library and query
                        doc_data = self.client.search_docs(
                            library_id=lib_id,
                            query=query,
                            tokens=tokens,
                            topic=topic,
                        )
                    else:
                        # Use get_library_docs when searching by library name
                        doc_data = self.client.get_library_docs(
                            library_id=lib_id,
                            topic=topic,
                            tokens=tokens,
                        )

                    # Extract documentation content
                    content = doc_data.get("content", "")
                    code_examples = doc_data.get("codeExamples", [])
                    if isinstance(code_examples, str):
                        code_examples = [code_examples] if code_examples else []
                    url = doc_data.get("url", "")
                    title = doc_data.get("title", f"{lib_name} Documentation")
                    version = doc_data.get("version")

                    if content or code_examples:
                        results.append(
                            LibraryDoc(
                                library_id=lib_id,
                                library_name=lib_name,
                                title=title,
                                content=content,
                                code_examples=code_examples,
                                url=url,
                                version=version,
                                topic=topic,
                                description=lib_description,
                                trust_score=trust_score,
                                extra=doc_data.get("metadata", {}),
                            )
                        )

                except Exception as e:
                    logger.warning(f"Failed to get docs for library '{lib_name}' ({lib_id}): {e}")
                    continue

        except Exception as e:
            logger.error(f"Error during Context7 search for '{query}': {e}")

        logger.info(f"Found {len(results)} documentation results for '{query}'")
        return results[:max_results]

    def download(self, content_id: str, save_path: str) -> str:
        """Download and save documentation to a JSON file.

        The content_id format can be:
        - "{library_id}" - Download all docs for the library
        - "{library_id}:{topic}" - Download docs filtered by topic

        Args:
            content_id: Library identifier, optionally with topic filter
                       (e.g., "/vercel/next.js" or "/vercel/next.js:routing")
            save_path: Directory to save the downloaded documentation

        Returns:
            Path to the saved JSON file.

        Example:
            >>> searcher = Context7Searcher()
            >>> path = searcher.download("/vercel/next.js", "./docs")
            >>> path = searcher.download("/vercel/next.js:routing", "./docs")
        """
        # Parse content_id for library_id and optional topic
        if ":" in content_id:
            library_id, topic = content_id.rsplit(":", 1)
        else:
            library_id = content_id
            topic = None

        logger.info(
            f"Downloading docs for '{library_id}'" f"{f' (topic: {topic})' if topic else ''}"
        )

        try:
            # Fetch documentation
            doc_data = self.client.get_library_docs(
                library_id=library_id,
                topic=topic,
            )

            # Prepare output data
            output_data = {
                "library_id": library_id,
                "topic": topic,
                "content": doc_data.get("content", ""),
                "code_examples": doc_data.get("codeExamples", []),
                "url": doc_data.get("url", ""),
                "title": doc_data.get("title", ""),
                "version": doc_data.get("version"),
                "metadata": doc_data.get("metadata", {}),
            }

            # Save to file
            safe_filename = sanitize_filename(content_id)
            os.makedirs(save_path, exist_ok=True)
            output_path = os.path.join(save_path, f"context7_{safe_filename}.json")

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Saved documentation to {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Failed to download docs for '{content_id}': {e}")
            # Create empty placeholder file
            safe_filename = sanitize_filename(content_id)
            os.makedirs(save_path, exist_ok=True)
            output_path = os.path.join(save_path, f"context7_{safe_filename}.json")

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "library_id": library_id,
                        "topic": topic,
                        "error": str(e),
                        "content": "",
                    },
                    f,
                    indent=2,
                )

            return output_path

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and format downloaded documentation.

        Args:
            content_id: Library identifier used when downloading
            save_path: Directory containing the downloaded documentation
            page: Ignored (documentation is not paginated)
            start_page: Ignored (documentation is not paginated)
            end_page: Ignored (documentation is not paginated)

        Returns:
            Formatted text content of the documentation.

        Note:
            Pagination parameters are accepted for interface compatibility
            but are not used since documentation is not paginated like PDFs.
        """
        safe_filename = sanitize_filename(content_id)
        file_path = os.path.join(save_path, f"context7_{safe_filename}.json")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Check for errors
            if "error" in data and data.get("error"):
                return f"Error loading documentation: {data['error']}"

            # Parse content_id for library info
            if ":" in content_id:
                library_id, topic = content_id.rsplit(":", 1)
            else:
                library_id = content_id
                topic = data.get("topic")

            # Create LibraryDoc and format as text
            doc = LibraryDoc(
                library_id=library_id,
                library_name=library_id.split("/")[-1] if "/" in library_id else library_id,
                title=data.get("title", "Documentation"),
                content=data.get("content", ""),
                code_examples=data.get("code_examples", []),
                url=data.get("url", ""),
                version=data.get("version"),
                topic=topic,
                extra=data.get("metadata", {}),
            )

            return doc.to_text()

        except FileNotFoundError:
            logger.warning(f"Documentation file not found: {file_path}")
            return (
                f"Documentation for '{content_id}' not found. "
                f"Use download() first to fetch the documentation."
            )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse documentation file: {e}")
            return f"Error reading documentation file: {e}"
        except Exception as e:
            logger.error(f"Unexpected error reading documentation: {e}")
            return f"Error reading documentation: {e}"
