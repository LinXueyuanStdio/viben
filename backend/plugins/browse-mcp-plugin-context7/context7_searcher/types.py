"""Data types for Context7 documentation content."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class LibraryDoc:
    """Standardized format for library documentation from Context7.

    This class represents documentation content retrieved from Context7,
    providing up-to-date library/framework documentation for LLM consumption.
    """

    # Core fields
    library_id: str  # e.g., "/vercel/next.js" or "mongodb/docs"
    library_name: str  # e.g., "Next.js", "MongoDB"
    title: str  # Document section title
    content: str  # Documentation text
    url: str  # Source URL to the documentation

    # Optional fields
    code_examples: List[str] = field(default_factory=list)  # Code snippets
    version: Optional[str] = None  # Library version
    topic: Optional[str] = None  # Topic filter used
    description: Optional[str] = None  # Library description
    trust_score: Optional[float] = None  # Context7 trust score
    extra: Dict = field(default_factory=dict)  # Additional metadata

    def __post_init__(self):
        """Initialize default values for list and dict fields."""
        if self.code_examples is None:
            self.code_examples = []
        if self.extra is None:
            self.extra = {}

    def to_text(self) -> str:
        """Convert LibraryDoc to a text representation.

        This method formats the documentation into a readable text format
        optimized for LLM consumption.

        Returns:
            Formatted text representation of the documentation.
        """
        lines = []

        # Library identification
        lines.append(f"Library: {self.library_name}")
        lines.append(f"Library ID: {self.library_id}")

        if self.version:
            lines.append(f"Version: {self.version}")

        if self.topic:
            lines.append(f"Topic: {self.topic}")

        # Document title
        if self.title:
            lines.append(f"Title: {self.title}")

        # Description
        if self.description:
            lines.append(f"Description: {self.description}")

        # Main content
        if self.content:
            lines.append("")
            lines.append("--- Documentation ---")
            lines.append(self.content)

        # Code examples
        if self.code_examples:
            lines.append("")
            lines.append("--- Code Examples ---")
            for i, example in enumerate(self.code_examples, 1):
                lines.append(f"\nExample {i}:")
                lines.append("```")
                lines.append(example)
                lines.append("```")

        # URL reference
        if self.url:
            lines.append("")
            lines.append(f"Source URL: {self.url}")

        # Trust score
        if self.trust_score is not None:
            lines.append(f"Trust Score: {self.trust_score}")

        # Extra metadata
        if self.extra:
            lines.append(f"Extra: {self.extra}")

        return "\n".join(lines)

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization.

        Returns:
            Dictionary representation of the LibraryDoc.
        """
        return {
            "library_id": self.library_id,
            "library_name": self.library_name,
            "title": self.title,
            "content": self.content,
            "code_examples": self.code_examples,
            "url": self.url,
            "version": self.version,
            "topic": self.topic,
            "description": self.description,
            "trust_score": self.trust_score,
            "extra": self.extra,
        }


def sanitize_filename(filename: str, max_length: int = 200) -> str:
    """Sanitize a string to be safe for use as a filename.

    This function removes or replaces characters that are invalid or potentially
    dangerous in filenames across different operating systems.

    Args:
        filename: The original filename or content ID
        max_length: Maximum length for the sanitized filename (default: 200)

    Returns:
        A sanitized filename safe for use across operating systems

    Examples:
        >>> sanitize_filename("/vercel/next.js")
        '_vercel_next.js'
        >>> sanitize_filename("library:topic")
        'library_topic'
    """
    if not filename:
        return "unnamed"

    # Remove or replace path separators to prevent path traversal
    sanitized = filename.replace("/", "_").replace("\\", "_")

    # Remove or replace characters invalid on Windows: < > : " | ? *
    invalid_chars = '<>:"|?*'
    for char in invalid_chars:
        sanitized = sanitized.replace(char, "_")

    # Remove control characters (ASCII 0-31)
    sanitized = "".join(char if ord(char) >= 32 else "_" for char in sanitized)

    # Remove leading/trailing dots and spaces
    sanitized = sanitized.strip(". ")

    # If the result is empty or only underscores, use a default name
    if not sanitized or sanitized.replace("_", "") == "":
        return "unnamed"

    # Truncate to max_length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    return sanitized
