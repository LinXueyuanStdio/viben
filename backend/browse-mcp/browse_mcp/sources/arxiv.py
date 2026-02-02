from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import requests
import os
import time

import feedparser
from PyPDF2 import PdfReader
from loguru import logger

from ..types import Paper, PaperSource, extract_pdf_pages


class ArxivSearcher(PaperSource):
    """Searcher for arXiv papers"""
    BASE_URL = "http://export.arxiv.org/api/query"

    def search(self, query: str, max_results: int = 10) -> List[Paper]:
        params = {
            'search_query': query,
            'max_results': max_results,
            'sortBy': 'submittedDate',
            'sortOrder': 'descending'
        }
        response = requests.get(self.BASE_URL, params=params)
        feed = feedparser.parse(response.content)
        papers = []
        for entry in feed.entries:
            try:
                authors = [author.name for author in entry.authors]
                published = datetime.strptime(entry.published, '%Y-%m-%dT%H:%M:%SZ')
                updated = datetime.strptime(entry.updated, '%Y-%m-%dT%H:%M:%SZ')
                pdf_url = next((link.href for link in entry.links if link.type == 'application/pdf'), '')
                papers.append(Paper(
                    paper_id=entry.id.split('/')[-1],
                    title=entry.title,
                    authors=authors,
                    abstract=entry.summary,
                    url=entry.id,
                    pdf_url=pdf_url,
                    published_date=published,
                    updated_date=updated,
                    source='arxiv',
                    categories=[tag.term for tag in entry.tags],
                    keywords=[],
                    doi=entry.get('doi', '')
                ))
            except Exception as e:
                print(f"Error parsing arXiv entry: {e}")
        return papers

    def download_pdf(self, paper_id: str, save_path: str) -> str:
        pdf_url = f"https://arxiv.org/pdf/{paper_id}.pdf"
        response = requests.get(pdf_url)
        output_file = f"{save_path}/{paper_id}.pdf"
        with open(output_file, 'wb') as f:
            f.write(response.content)
        return output_file

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
            paper_id: arXiv paper ID
            save_path: Directory where the PDF is/will be saved
            page: Specific page number to read (1-indexed)
            start_page: Start page for range extraction (1-indexed)
            end_page: End page for range extraction (1-indexed)

        Returns:
            str: The extracted text content of the paper
        """
        # First ensure we have the PDF
        pdf_path = f"{save_path}/{paper_id}.pdf"
        if not os.path.exists(pdf_path):
            pdf_path = self.download_pdf(paper_id, save_path)

        # Read the PDF with pagination support
        try:
            text = extract_pdf_pages(pdf_path, page=page, start_page=start_page, end_page=end_page)
            return text.strip() if text else ""
        except Exception as e:
            print(f"Error reading PDF for paper {paper_id}: {e}")
            return ""

if __name__ == "__main__":
    # Test ArxivSearcher functionality
    searcher = ArxivSearcher()

    # Test search functionality
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

    # Test PDF download functionality
    if papers:
        print("\nTesting PDF download functionality...")
        paper_id = papers[0].paper_id
        save_path = "./downloads"  # Ensure this directory exists
        try:
            os.makedirs(save_path, exist_ok=True)
            pdf_path = searcher.download_pdf(paper_id, save_path)
            print(f"PDF downloaded successfully: {pdf_path}")
        except Exception as e:
            print(f"Error during PDF download: {e}")

    # Test paper reading functionality
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

    # Test pagination functionality
    if papers:
        print("\nTesting pagination functionality...")
        paper_id = papers[0].paper_id
        try:
            # Test single page
            page_1 = searcher.read_paper(paper_id, page=1)
            print(f"Page 1 length: {len(page_1)} characters")

            # Test page range
            pages_1_2 = searcher.read_paper(paper_id, start_page=1, end_page=2)
            print(f"Pages 1-2 length: {len(pages_1_2)} characters")
        except Exception as e:
            print(f"Error during pagination test: {e}")
