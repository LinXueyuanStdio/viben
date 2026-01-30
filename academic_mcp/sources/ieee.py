from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


class IEEESearcher(PaperSource):
    """Searcher for IEEE Xplore papers

    Note: Requires API key from https://developer.ieee.org/
    Set environment variable: IEEE_API_KEY
    """
    BASE_URL = "http://ieeexploreapi.ieee.org/api/v1/search/articles"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get('IEEE_API_KEY', '')
        if not self.api_key:
            logger.warning("IEEE API key not set. Set IEEE_API_KEY environment variable.")

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search IEEE Xplore for papers"""
        if not self.api_key:
            logger.error("API key required for IEEE search")
            return []

        params = {
            'apikey': self.api_key,
            'querytext': query,
            'max_records': max_results,
            'sort_order': 'desc',
            'sort_field': 'article_number'
        }

        try:
            response = requests.get(self.BASE_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            papers = []
            articles = data.get('articles', [])

            for article in articles:
                try:
                    # Extract authors
                    authors = []
                    author_data = article.get('authors', {})
                    author_list = author_data.get('authors', [])
                    for author in author_list:
                        full_name = author.get('full_name', '')
                        if full_name:
                            authors.append(full_name)

                    # Parse publication date
                    pub_year = article.get('publication_year', '')
                    try:
                        if pub_year:
                            published_date = datetime(int(pub_year), 1, 1)
                        else:
                            published_date = datetime.now()
                    except (ValueError, TypeError):
                        published_date = datetime.now()

                    # Extract URLs
                    doi = article.get('doi', '')
                    article_number = article.get('article_number', '')
                    url = f"https://ieeexplore.ieee.org/document/{article_number}" if article_number else ''
                    pdf_url = article.get('pdf_url', '')

                    paper = Paper(
                        paper_id=article_number,
                        title=article.get('title', ''),
                        authors=authors,
                        abstract=article.get('abstract', ''),
                        doi=doi,
                        published_date=published_date,
                        pdf_url=pdf_url,
                        url=url,
                        source='ieee',
                        categories=[article.get('content_type', '')],
                        keywords=article.get('index_terms', {}).get('author_terms', {}).get('terms', []),
                        citations=int(article.get('citing_paper_count', 0)),
                        extra={
                            'publication': article.get('publication_title', ''),
                            'volume': article.get('volume', ''),
                            'issue': article.get('issue', ''),
                            'pages': f"{article.get('start_page', '')}-{article.get('end_page', '')}"
                        }
                    )
                    papers.append(paper)

                except Exception as e:
                    logger.error(f"Error parsing IEEE entry: {e}")
                    continue

            return papers

        except Exception as e:
            logger.error(f"Error searching IEEE: {e}")
            return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from IEEE Xplore

        Note: Direct PDF download requires institutional access or subscription
        """
        if not self.api_key:
            raise ValueError("API key required for IEEE PDF download")

        logger.warning("IEEE PDF download requires institutional access")
        raise NotImplementedError("IEEE PDF download requires institutional access")

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}. IEEE requires institutional access for PDF download.")

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
    # Test IEEESearcher
    searcher = IEEESearcher()

    # Test search
    print("Testing search functionality...")
    query = "machine learning"
    max_results = 5
    try:
        papers = searcher.search(query, max_results=max_results)
        print(f"Found {len(papers)} papers for query '{query}':")
        for i, paper in enumerate(papers, 1):
            print(f"{i}. {paper.title} (ID: {paper.paper_id})")
            print(f"   DOI: {paper.doi}")
            print(f"   URL: {paper.url}")
    except Exception as e:
        print(f"Error during search: {e}")
