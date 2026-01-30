from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


class ScienceDirectSearcher(PaperSource):
    """Searcher for Science Direct papers

    Note: Requires API key from https://dev.elsevier.com/
    Set environment variable: SCIENCEDIRECT_API_KEY
    """
    BASE_URL = "https://api.elsevier.com/content"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get('SCIENCEDIRECT_API_KEY', '')
        if not self.api_key:
            logger.warning("ScienceDirect API key not set. Set SCIENCEDIRECT_API_KEY environment variable.")

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search Science Direct for papers"""
        if not self.api_key:
            logger.error("API key required for Science Direct search")
            return []

        search_url = f"{self.BASE_URL}/search/sciencedirect"
        headers = {
            'X-ELS-APIKey': self.api_key,
            'Accept': 'application/json'
        }
        params = {
            'query': query,
            'count': max_results,
            'sort': 'relevance'
        }

        try:
            response = requests.get(search_url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            papers = []
            entries = data.get('search-results', {}).get('entry', [])

            for entry in entries:
                try:
                    # Extract authors
                    authors = []
                    author_list = entry.get('authors', {}).get('author', [])
                    if isinstance(author_list, list):
                        for author in author_list:
                            name = author.get('given-name', '') + ' ' + author.get('surname', '')
                            authors.append(name.strip())

                    # Parse publication date
                    pub_date_str = entry.get('prism:coverDate', '')
                    try:
                        if pub_date_str:
                            published_date = datetime.strptime(pub_date_str, '%Y-%m-%d')
                        else:
                            published_date = datetime.now()
                    except ValueError:
                        published_date = datetime.now()

                    # Extract URLs
                    doi = entry.get('prism:doi', '')
                    url = entry.get('prism:url', '')
                    if not url and doi:
                        url = f"https://doi.org/{doi}"

                    # PDF URL (if available)
                    pdf_url = ''
                    links = entry.get('link', [])
                    for link in links:
                        if link.get('@ref') == 'scidir':
                            pdf_url = link.get('@href', '')
                            break

                    paper = Paper(
                        paper_id=entry.get('dc:identifier', '').replace('SCOPUS_ID:', ''),
                        title=entry.get('dc:title', ''),
                        authors=authors,
                        abstract=entry.get('dc:description', ''),
                        doi=doi,
                        published_date=published_date,
                        pdf_url=pdf_url,
                        url=url,
                        source='sciencedirect',
                        categories=[entry.get('prism:aggregationType', '')],
                        keywords=[],
                        citations=int(entry.get('citedby-count', 0)),
                        extra={
                            'publication': entry.get('prism:publicationName', ''),
                            'volume': entry.get('prism:volume', ''),
                            'issue': entry.get('prism:issueIdentifier', ''),
                            'pages': entry.get('prism:pageRange', '')
                        }
                    )
                    papers.append(paper)

                except Exception as e:
                    logger.error(f"Error parsing Science Direct entry: {e}")
                    continue

            return papers

        except Exception as e:
            logger.error(f"Error searching Science Direct: {e}")
            return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from Science Direct

        Note: Direct PDF download requires institutional access or subscription
        """
        if not self.api_key:
            raise ValueError("API key required for Science Direct PDF download")

        # This is a placeholder - actual PDF download requires proper authentication
        # and institutional access
        logger.warning("Science Direct PDF download requires institutional access")
        raise NotImplementedError("Science Direct PDF download requires institutional access")

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}. Science Direct requires institutional access for PDF download.")

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
    # Test ScienceDirectSearcher
    searcher = ScienceDirectSearcher()

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
