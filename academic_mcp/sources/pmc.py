from typing import List, Dict, Any, Optional
from datetime import datetime
import requests
import os
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource


class PMCSearcher(PaperSource):
    """Searcher for PubMed Central (PMC) papers"""
    BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        """Search PubMed Central for papers"""
        # Search for PMC IDs
        search_url = f"{self.BASE_URL}/esearch.fcgi"
        search_params = {
            'db': 'pmc',
            'term': query,
            'retmax': max_results,
            'retmode': 'json',
            'sort': 'relevance'
        }

        try:
            response = requests.get(search_url, params=search_params, timeout=30)
            response.raise_for_status()
            search_results = response.json()

            id_list = search_results.get('esearchresult', {}).get('idlist', [])
            if not id_list:
                return []

            # Fetch details for each PMC ID
            fetch_url = f"{self.BASE_URL}/esummary.fcgi"
            fetch_params = {
                'db': 'pmc',
                'id': ','.join(id_list),
                'retmode': 'json'
            }

            response = requests.get(fetch_url, params=fetch_params, timeout=30)
            response.raise_for_status()
            fetch_results = response.json()

            papers = []
            result_dict = fetch_results.get('result', {})

            for pmc_id in id_list:
                try:
                    article = result_dict.get(pmc_id, {})
                    if not article:
                        continue

                    # Extract author list
                    authors = []
                    author_list = article.get('authors', [])
                    for author in author_list:
                        if isinstance(author, dict):
                            name = author.get('name', '')
                            if name:
                                authors.append(name)

                    # Parse publication date
                    pub_date_str = article.get('pubdate', '')
                    try:
                        # Try different date formats
                        if pub_date_str:
                            for fmt in ['%Y %b %d', '%Y %b', '%Y']:
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

                    # Construct URLs
                    pmcid = article.get('pmcid', f"PMC{pmc_id}")
                    url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/"
                    pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/pdf/"

                    paper = Paper(
                        paper_id=pmcid,
                        title=article.get('title', ''),
                        authors=authors,
                        abstract='',  # PMC doesn't provide abstract in summary
                        doi=article.get('elocationid', '').replace('doi: ', ''),
                        published_date=published_date,
                        pdf_url=pdf_url,
                        url=url,
                        source='pmc',
                        categories=[],
                        keywords=[],
                        citations=0,
                        extra={
                            'journal': article.get('fulljournalname', ''),
                            'volume': article.get('volume', ''),
                            'issue': article.get('issue', ''),
                            'pages': article.get('pages', '')
                        }
                    )
                    papers.append(paper)

                except Exception as e:
                    logger.error(f"Error parsing PMC entry {pmc_id}: {e}")
                    continue

            return papers

        except Exception as e:
            logger.error(f"Error searching PMC: {e}")
            return []

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        """Download PDF from PubMed Central"""
        # Ensure paper_id has PMC prefix
        if not paper_id.startswith('PMC'):
            paper_id = f"PMC{paper_id}"

        pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{paper_id}/pdf/"

        try:
            os.makedirs(save_path, exist_ok=True)
            response = requests.get(pdf_url, timeout=60)
            response.raise_for_status()

            output_file = os.path.join(save_path, f"{paper_id}.pdf")
            with open(output_file, 'wb') as f:
                f.write(response.content)

            return output_file
        except Exception as e:
            logger.error(f"Error downloading PDF for {paper_id}: {e}")
            raise

    def read_paper(self, paper_id: str, save_path: str = "./downloads") -> str:
        """Read a paper and convert it to text format"""
        # Ensure paper_id has PMC prefix
        if not paper_id.startswith('PMC'):
            paper_id = f"PMC{paper_id}"

        pdf_path = os.path.join(save_path, f"{paper_id}.pdf")

        # Download if not exists
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
    # Test PMCSearcher
    searcher = PMCSearcher()

    # Test search
    print("Testing search functionality...")
    query = "cancer treatment"
    max_results = 5
    try:
        papers = searcher.search(query, max_results=max_results)
        print(f"Found {len(papers)} papers for query '{query}':")
        for i, paper in enumerate(papers, 1):
            print(f"{i}. {paper.title} (ID: {paper.paper_id})")
    except Exception as e:
        print(f"Error during search: {e}")

    # Test PDF download
    if papers:
        print("\nTesting PDF download functionality...")
        paper_id = papers[0].paper_id
        save_path = "./downloads"
        try:
            os.makedirs(save_path, exist_ok=True)
            pdf_path = searcher.download_pdf(paper_id, save_path)
            print(f"PDF downloaded successfully: {pdf_path}")
        except Exception as e:
            print(f"Error during PDF download: {e}")

    # Test paper reading
    if papers:
        print("\nTesting paper reading functionality...")
        paper_id = papers[0].paper_id
        try:
            text_content = searcher.read_paper(paper_id)
            print(f"\nFirst 500 characters of the paper content:")
            print(text_content[:500] + "...")
            print(f"\nTotal length of extracted text: {len(text_content)} characters")
        except Exception as e:
            print(f"Error during paper reading: {e}")
