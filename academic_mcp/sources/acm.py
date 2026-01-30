from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


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

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}. ACM requires institutional access for PDF download.")

        # Read the PDF
        try:
            reader = PdfReader(pdf_path)
            text = ""

            for page in reader.pages:
                text += page.extract_text() + "\n"

            return text.strip()
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
