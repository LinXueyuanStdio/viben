from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


class WOSSearcher(PaperSource):
    """Searcher for Web of Science papers

    Note: Requires API key from Clarivate Analytics
    Set environment variable: WOS_API_KEY
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get('WOS_API_KEY', '')
        if not self.api_key:
            logger.warning("Web of Science API key not set. Set WOS_API_KEY environment variable.")

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search Web of Science for papers"""
        if not self.api_key:
            logger.error("API key required for Web of Science search")
            return []

        logger.warning("Web of Science API requires institutional subscription")
        logger.warning("Please use institutional access at https://www.webofscience.com/")
        return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from Web of Science

        Note: Requires institutional access
        """
        logger.warning("Web of Science PDF download requires institutional access")
        raise NotImplementedError("Web of Science PDF download requires institutional access")

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}. Web of Science requires institutional access.")

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
    # Test WOSSearcher
    searcher = WOSSearcher()

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
