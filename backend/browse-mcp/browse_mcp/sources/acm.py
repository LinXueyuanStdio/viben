from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource, extract_pdf_pages


class ACMSearcher(PaperSource):
    """Searcher for ACM Digital Library papers

    Note: ACM Digital Library does not provide a free public API
    This implementation uses web scraping which may be restricted
    """

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search ACM Digital Library for papers

        Note: ACM does not provide a free public API
        This is a placeholder implementation
        """
        logger.warning("ACM Digital Library does not provide a free public API")
        logger.warning("Please use institutional access or manual search at https://dl.acm.org/")
        return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from ACM Digital Library

        Note: Requires institutional access
        """
        logger.warning("ACM PDF download requires institutional access")
        raise NotImplementedError("ACM PDF download requires institutional access")

    def read_paper(
        self,
        paper_id: str,
        save_path: str = "./downloads",
        page: Optional[int] = None,
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> str:
        """Read a paper and convert it to text format with optional pagination.

        Args:
            paper_id: ACM paper ID
            save_path: Directory where the PDF is/will be saved
            page: Specific page number to read (1-indexed)
            start_page: Start page for range extraction (1-indexed)
            end_page: End page for range extraction (1-indexed)

        Returns:
            str: The extracted text content of the paper
        """
        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}. ACM requires institutional access for PDF download.")

        # Read the PDF with pagination support
        try:
            text = extract_pdf_pages(pdf_path, page=page, start_page=start_page, end_page=end_page)
            return text.strip() if text else ""
        except Exception as e:
            logger.error(f"Error reading PDF for {paper_id}: {e}")
            return ""


if __name__ == "__main__":
    # Test ACMSearcher
    searcher = ACMSearcher()

    # Test search
    print("Testing search functionality...")
    query = "machine learning"
    max_results = 5
    try:
        papers = searcher.search(query, max_results=max_results)
        print(f"Found {len(papers)} papers for query '{query}':")
        for i, paper in enumerate(papers, 1):
            print(f"{i}. {paper.title} (ID: {paper.paper_id})")
    except Exception as e:
        print(f"Error during search: {e}")
