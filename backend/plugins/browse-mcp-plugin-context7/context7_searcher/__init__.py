"""Context7 documentation searcher plugin for browse-mcp.

This plugin provides a searcher for up-to-date library/framework documentation
through the Context7 service. It enables searching and retrieving documentation
directly through the browse-mcp interface.

Supported features:
- Semantic search across library documentation
- Up-to-date documentation content
- Code examples and snippets
- Support for many popular libraries and frameworks

Example usage:
    >>> from context7_searcher import Context7Searcher
    >>> searcher = Context7Searcher()
    >>> docs = searcher.search("next.js routing")
    >>> for doc in docs:
    ...     print(doc.to_text())

Environment Variables:
    CONTEXT7_API_KEY: Optional API key for authenticated requests.
                     Set this for higher rate limits.
"""

from .client import Context7Client
from .context7 import Context7Searcher
from .types import LibraryDoc, sanitize_filename

__all__ = [
    "LibraryDoc",
    "sanitize_filename",
    "Context7Searcher",
    "Context7Client",
]
