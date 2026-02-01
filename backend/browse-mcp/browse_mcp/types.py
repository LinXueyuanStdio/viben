from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Optional, TypeVar, Generic
from abc import ABC, abstractmethod


@dataclass
class Paper:
    """Standardized paper format with core fields for academic sources"""

    # 核心字段（必填，但允许空值或默认值）
    paper_id: str  # Unique identifier (e.g., arXiv ID, PMID, DOI)
    title: str  # Paper title
    authors: List[str]  # List of author names
    abstract: str  # Abstract text
    doi: str  # Digital Object Identifier
    published_date: datetime  # Publication date
    pdf_url: str  # Direct PDF link
    url: str  # URL to paper page
    source: str  # Source platform (e.g., 'arxiv', 'pubmed')

    # 可选字段
    updated_date: Optional[datetime] = None  # Last updated date
    categories: List[str] = None  # Subject categories
    keywords: List[str] = None  # Keywords
    citations: int = 0  # Citation count
    references: Optional[List[str]] = None  # List of reference IDs/DOIs
    extra: Optional[Dict] = None  # Source-specific extra metadata

    def __post_init__(self):
        """Post-initialization to handle default values"""
        if self.authors is None:
            self.authors = []
        if self.categories is None:
            self.categories = []
        if self.keywords is None:
            self.keywords = []
        if self.references is None:
            self.references = []
        if self.extra is None:
            self.extra = {}

    def to_dict(self) -> Dict:
        """Convert paper to dictionary format for serialization"""
        return {
            "paper_id": self.paper_id,
            "title": self.title,
            "authors": "; ".join(self.authors) if self.authors else "",
            "abstract": self.abstract,
            "doi": self.doi,
            "published_date": self.published_date.isoformat() if self.published_date else "",
            "pdf_url": self.pdf_url,
            "url": self.url,
            "source": self.source,
            "updated_date": self.updated_date.isoformat() if self.updated_date else "",
            "categories": "; ".join(self.categories) if self.categories else "",
            "keywords": "; ".join(self.keywords) if self.keywords else "",
            "citations": self.citations,
            "references": "; ".join(self.references) if self.references else "",
            "extra": str(self.extra) if self.extra else "",
        }


    def to_text(self) -> str:
        """Convert Paper object to a text representation."""
        texts = []
        if self.source:
            texts.append(f"Source: '{self.source}'")
        if self.paper_id:
            texts.append(f"Paper ID: '{self.paper_id}'")
        if self.title:
            texts.append(f"Title: {self.title}")
        if self.authors:
            texts.append(f"Authors: {'; '.join(self.authors)}")
        if self.abstract:
            texts.append(f"Abstract: {self.abstract}")
        if self.published_date:
            texts.append(f"Published Date: {self.published_date.strftime('%Y-%m-%d')}")
        if self.url:
            texts.append(f"URL: {self.url}")
        if self.doi:
            texts.append(f"DOI: {self.doi}")
        if self.categories:
            texts.append(f"Categories: {'; '.join(self.categories)}")
        if self.keywords:
            texts.append(f"Keywords: {'; '.join(self.keywords)}")
        if self.citations:
            texts.append(f"Citations: {self.citations}")
        if self.references:
            texts.append(f"References: {'; '.join(self.references)}")
        if self.extra:
            texts.append(f"Extra Info: {self.extra}")
        if not texts:
            texts.append(str(self.to_dict()))
        text = "\n".join(texts)
        return text


def paper2text(paper: Paper) -> str:
    """Convert Paper object to a text representation.

    Deprecated: Use paper.to_text() instead. This function is kept for backward compatibility.
    """
    return paper.to_text()


# Type variable for generic content types
T = TypeVar('T')


class ContentSource(ABC, Generic[T]):
    """Generic base class for content sources.

    This abstract class defines the interface for all content sources,
    allowing plugins to work with any content type (papers, social posts, etc.).

    Type Parameters:
        T: The content type returned by this source (e.g., Paper, SocialPost)

    Example:
        ```python
        @dataclass
        class SocialPost:
            post_id: str
            title: str
            content: str

            def to_text(self) -> str:
                return f"Title: {self.title}\\nContent: {self.content}"

        class TwitterSource(ContentSource[SocialPost]):
            def search(self, query: str, **kwargs) -> List[SocialPost]:
                # Implementation
                pass
        ```
    """

    @abstractmethod
    def search(self, query: str, **kwargs) -> List[T]:
        """Search for content matching the query.

        Args:
            query: Search query string
            **kwargs: Source-specific search parameters

        Returns:
            List of content items of type T
        """
        raise NotImplementedError

    @abstractmethod
    def download(self, content_id: str, save_path: str) -> str:
        """Download content to a file.

        Args:
            content_id: Unique identifier for the content
            save_path: Directory to save the downloaded content

        Returns:
            Path to the downloaded file
        """
        raise NotImplementedError

    @abstractmethod
    def read(self, content_id: str, save_path: str) -> str:
        """Read and extract text content.

        Args:
            content_id: Unique identifier for the content
            save_path: Directory containing the content file

        Returns:
            Extracted text content
        """
        raise NotImplementedError


class PaperSource(ContentSource[Paper]):
    """Abstract base class for academic paper sources.

    This class specializes ContentSource for academic papers. All existing
    paper searchers should inherit from this class for backward compatibility.
    """

    def search(self, query: str, **kwargs) -> List[Paper]:
        """Search for academic papers matching the query."""
        raise NotImplementedError

    def download(self, content_id: str, save_path: str) -> str:
        """Download paper PDF.

        This method is an alias for download_pdf for backward compatibility.
        """
        return self.download_pdf(content_id, save_path)

    def read(self, content_id: str, save_path: str) -> str:
        """Read and extract text from paper.

        This method is an alias for read_paper for backward compatibility.
        """
        return self.read_paper(content_id, save_path)

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download paper PDF (legacy method name)."""
        raise NotImplementedError

    def read_paper(self, paper_id: str, save_path: str) -> str:
        """Extract and read text content from paper (legacy method name)."""
        raise NotImplementedError
