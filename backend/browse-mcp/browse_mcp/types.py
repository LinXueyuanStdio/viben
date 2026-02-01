from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Optional, TypeVar, Generic
from abc import ABC, abstractmethod


@dataclass
class Paper:
    """Standardized paper format with core fields for academic sources"""

    # Core fields (required, but allow empty values or defaults)
    paper_id: str  # Unique identifier (e.g., arXiv ID, PMID, DOI)
    title: str  # Paper title
    authors: List[str]  # List of author names
    abstract: str  # Abstract text
    doi: str  # Digital Object Identifier
    published_date: datetime  # Publication date
    pdf_url: str  # Direct PDF link
    url: str  # URL to paper page
    source: str  # Source platform (e.g., 'arxiv', 'pubmed')

    # Optional fields
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
    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and extract text content with optional pagination.

        Args:
            content_id: Unique identifier for the content
            save_path: Directory containing the content file
            page: Specific page number to read (1-indexed). If provided, only this page is returned.
            start_page: Start page for range extraction (1-indexed, inclusive).
            end_page: End page for range extraction (1-indexed, inclusive).

        Pagination behavior:
            - page=None, start_page=None, end_page=None: Return all content
            - page=3: Return only page 3
            - start_page=1, end_page=5: Return pages 1-5
            - start_page=10: Return from page 10 to end
            - end_page=5: Return pages 1-5

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

    def read(
        self,
        content_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read and extract text from paper with optional pagination.

        This method is an alias for read_paper for backward compatibility.
        """
        return self.read_paper(content_id, save_path, page=page, start_page=start_page, end_page=end_page)

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download paper PDF (legacy method name)."""
        raise NotImplementedError

    def read_paper(
        self,
        paper_id: str,
        save_path: str,
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Extract and read text content from paper with optional pagination.

        Args:
            paper_id: Unique identifier for the paper
            save_path: Directory containing/to save the PDF file
            page: Specific page number to read (1-indexed). If provided, only this page is returned.
            start_page: Start page for range extraction (1-indexed, inclusive).
            end_page: End page for range extraction (1-indexed, inclusive).

        Pagination behavior:
            - page=None, start_page=None, end_page=None: Return all content
            - page=3: Return only page 3
            - start_page=1, end_page=5: Return pages 1-5
            - start_page=10: Return from page 10 to end
            - end_page=5: Return pages 1-5

        Returns:
            Extracted text content from the paper
        """
        raise NotImplementedError


def extract_pdf_pages(
    pdf_path: str,
    page: Optional[int] = None,
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
) -> str:
    """Extract text from PDF with pagination support.

    This is a helper function that can be used by PaperSource implementations
    to support pagination in their read_paper methods.

    Args:
        pdf_path: Path to the PDF file
        page: Specific page number to read (1-indexed). If provided, only this page is returned.
        start_page: Start page for range extraction (1-indexed, inclusive).
        end_page: End page for range extraction (1-indexed, inclusive).

    Returns:
        Extracted text from the specified pages

    Pagination behavior:
        - page=None, start_page=None, end_page=None: Return all content
        - page=3: Return only page 3
        - start_page=1, end_page=5: Return pages 1-5
        - start_page=10: Return from page 10 to end
        - end_page=5: Return pages 1-5

    Example:
        ```python
        from browse_mcp.types import extract_pdf_pages

        # Read all pages
        text = extract_pdf_pages("paper.pdf")

        # Read only page 3
        text = extract_pdf_pages("paper.pdf", page=3)

        # Read pages 1-5
        text = extract_pdf_pages("paper.pdf", start_page=1, end_page=5)

        # Read from page 10 to end
        text = extract_pdf_pages("paper.pdf", start_page=10)
        ```
    """
    from PyPDF2 import PdfReader

    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)

    # Determine page range (convert to 0-indexed internally)
    if page is not None:
        # Single page requested
        page_indices = [page - 1]  # Convert to 0-indexed
    elif start_page is not None or end_page is not None:
        # Range requested
        start = (start_page or 1) - 1  # Convert to 0-indexed, default to 0
        end = end_page if end_page is not None else total_pages  # Default to total pages
        page_indices = list(range(start, min(end, total_pages)))
    else:
        # All pages
        page_indices = list(range(total_pages))

    # Extract text from specified pages
    text_parts = []
    for i in page_indices:
        if 0 <= i < total_pages:
            try:
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text_parts.append(f"--- Page {i + 1} ---\n{page_text}")
            except Exception:
                # Skip pages that fail to extract
                continue

    return "\n\n".join(text_parts)
