from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


class SpringerSearcher(PaperSource):
    """Searcher for Springer Link papers

    Note: Requires API key from https://dev.springernature.com/
    Set environment variable: SPRINGER_API_KEY
    """
    BASE_URL = "http://api.springernature.com/metadata/json"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get('SPRINGER_API_KEY', '')
        if not self.api_key:
            logger.warning("Springer API key not set. Set SPRINGER_API_KEY environment variable.")

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search Springer Link for papers"""
        if not self.api_key:
            logger.error("API key required for Springer search")
            return []

        params = {
            'q': query,
            'p': max_results,
            'api_key': self.api_key
        }

        try:
            response = requests.get(self.BASE_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            papers = []
            records = data.get('records', [])

            for record in records:
                try:
                    # Extract authors
                    authors = []
                    creators = record.get('creators', [])
                    if isinstance(creators, list):
                        for creator in creators:
                            if isinstance(creator, dict):
                                name = creator.get('creator', '')
                                if name:
                                    authors.append(name)
                            elif isinstance(creator, str):
                                authors.append(creator)

                    # Parse publication date
                    pub_date_str = record.get('publicationDate', '')
                    try:
                        if pub_date_str:
                            # Try different date formats
                            for fmt in ['%Y-%m-%d', '%Y-%m', '%Y']:
                                try:
                                    published_date = datetime.strptime(pub_date_str, fmt)
                                    break
                                except ValueError:
                                    continue
                            else:
                                published_date = datetime.now()
                        else:
                            published_date = datetime.now()
                    except Exception:
                        published_date = datetime.now()

                    # Extract URLs
                    doi = record.get('doi', '')
                    url = record.get('url', [])
                    if isinstance(url, list) and url:
                        url = url[0].get('value', '')
                    elif isinstance(url, str):
                        pass
                    else:
                        url = f"https://doi.org/{doi}" if doi else ''

                    # PDF URL
                    pdf_url = ''
                    for url_item in record.get('url', []):
                        if isinstance(url_item, dict) and url_item.get('format') == 'pdf':
                            pdf_url = url_item.get('value', '')
                            break

                    paper = Paper(
                        paper_id=doi or record.get('identifier', ''),
                        title=record.get('title', ''),
                        authors=authors,
                        abstract=record.get('abstract', ''),
                        doi=doi,
                        published_date=published_date,
                        pdf_url=pdf_url,
                        url=url if isinstance(url, str) else '',
                        source='springer',
                        categories=[record.get('publicationType', '')],
                        keywords=record.get('subjects', []),
                        citations=0,
                        extra={
                            'publication': record.get('publicationName', ''),
                            'volume': record.get('volume', ''),
                            'issue': record.get('number', ''),
                            'pages': f"{record.get('startingPage', '')}-{record.get('endingPage', '')}"
                        }
                    )
                    papers.append(paper)

                except Exception as e:
                    logger.error(f"Error parsing Springer entry: {e}")
                    continue

            return papers

        except Exception as e:
            logger.error(f"Error searching Springer: {e}")
            return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from Springer

        Note: Direct PDF download requires institutional access or subscription
        """
        if not self.api_key:
            raise ValueError("API key required for Springer PDF download")

        logger.warning("Springer PDF download requires institutional access")
        raise NotImplementedError("Springer PDF download requires institutional access")

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        pdf_path = os.path.join(save_path, f"{paper_id.replace('/', '_')}.pdf")

        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}. Springer requires institutional access for PDF download.")

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
    # Test SpringerSearcher
    searcher = SpringerSearcher()

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
