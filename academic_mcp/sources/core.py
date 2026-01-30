from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


class CORESearcher(PaperSource):
    """Searcher for CORE papers

    Note: Requires API key from https://core.ac.uk/services/api
    Set environment variable: CORE_API_KEY
    """
    BASE_URL = "https://api.core.ac.uk/v3"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get('CORE_API_KEY', '')
        if not self.api_key:
            logger.warning("CORE API key not set. Set CORE_API_KEY environment variable.")

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search CORE for papers"""
        if not self.api_key:
            logger.error("API key required for CORE search")
            return []

        search_url = f"{self.BASE_URL}/search/works"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Accept': 'application/json'
        }
        params = {
            'q': query,
            'limit': max_results
        }

        try:
            response = requests.get(search_url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            papers = []
            results = data.get('results', [])

            for result in results:
                try:
                    # Extract authors
                    authors = []
                    author_list = result.get('authors', [])
                    for author in author_list:
                        if isinstance(author, dict):
                            name = author.get('name', '')
                            if name:
                                authors.append(name)
                        elif isinstance(author, str):
                            authors.append(author)

                    # Parse publication date
                    pub_year = result.get('yearPublished')
                    try:
                        if pub_year:
                            published_date = datetime(int(pub_year), 1, 1)
                        else:
                            published_date = datetime.now()
                    except (ValueError, TypeError):
                        published_date = datetime.now()

                    # Extract URLs
                    doi = result.get('doi', '')
                    core_id = result.get('id', '')
                    url = result.get('links', [{}])[0].get('url', '')
                    if not url and doi:
                        url = f"https://doi.org/{doi}"
                    elif not url and core_id:
                        url = f"https://core.ac.uk/display/{core_id}"

                    # PDF URL
                    pdf_url = result.get('downloadUrl', '')

                    paper = Paper(
                        paper_id=str(core_id),
                        title=result.get('title', ''),
                        authors=authors,
                        abstract=result.get('abstract', ''),
                        doi=doi,
                        published_date=published_date,
                        pdf_url=pdf_url,
                        url=url,
                        source='core',
                        categories=[],
                        keywords=result.get('subjects', []),
                        citations=0,
                        extra={
                            'publisher': result.get('publisher', ''),
                            'language': result.get('language', {}).get('name', '')
                        }
                    )
                    papers.append(paper)

                except Exception as e:
                    logger.error(f"Error parsing CORE entry: {e}")
                    continue

            return papers

        except Exception as e:
            logger.error(f"Error searching CORE: {e}")
            return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from CORE"""
        if not self.api_key:
            raise ValueError("API key required for CORE PDF download")

        # Get paper details to find PDF URL
        details_url = f"{self.BASE_URL}/works/{paper_id}"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Accept': 'application/json'
        }

        try:
            response = requests.get(details_url, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()

            pdf_url = data.get('downloadUrl', '')
            if not pdf_url:
                raise ValueError(f"No PDF URL found for paper {paper_id}")

            # Download PDF
            os.makedirs(save_path, exist_ok=True)
            pdf_response = requests.get(pdf_url, timeout=60)
            pdf_response.raise_for_status()

            output_file = os.path.join(save_path, f"{paper_id}.pdf")
            with open(output_file, 'wb') as f:
                f.write(pdf_response.content)

            return output_file

        except Exception as e:
            logger.error(f"Error downloading PDF for {paper_id}: {e}")
            raise

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        if not os.path.exists(pdf_path):
            pdf_path = self.download_pdf(paper_id, save_path)

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
    # Test CORESearcher
    searcher = CORESearcher()

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
    except Exception as e:
        print(f"Error during search: {e}")
