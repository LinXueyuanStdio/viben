import unittest
import asyncio
import os
from browse_mcp.__main__ import (
    # New names
    SearchQuery,
    DownloadQuery,
    async_search_per_query,
    async_download_per_query,
    # Backward compatibility aliases
    PaperQuery,
    PaperDownloadQuery,
)

class TestBrowseSearchServer(unittest.TestCase):
    """Tests for browse_search functionality (renamed from paper_search)."""

    def test_search_arxiv_with_search_query(self):
        """Test browse_search with SearchQuery model."""
        query = SearchQuery(searcher="arxiv", query="machine learning", max_results=10)
        result = asyncio.run(async_search_per_query(query))
        self.assertIsInstance(result, list, "Result should be a list")
        self.assertGreater(len(result), 0, "Should return at least 1 result")
        self.assertLessEqual(len(result), 10, "Should return at most 10 results")
        for paper in result:
            self.assertIsNotNone(paper.title, "Each result should contain a title")
            self.assertIsNotNone(paper.paper_id, "Each result should contain a paper_id")

    def test_search_arxiv_with_paper_query_alias(self):
        """Test backward compatibility with PaperQuery alias."""
        query = PaperQuery(searcher="arxiv", query="machine learning", max_results=5)
        result = asyncio.run(async_search_per_query(query))
        self.assertIsInstance(result, list, "Result should be a list")
        self.assertGreater(len(result), 0, "Should return at least 1 result")

    def test_download_with_content_id(self):
        """Test browse_download with content_id parameter."""
        # First search for results
        query = SearchQuery(searcher="arxiv", query="machine learning", max_results=1)
        search_results = asyncio.run(async_search_per_query(query))
        self.assertGreater(len(search_results), 0, "Search should return at least 1 result")

        # Download using content_id (new parameter name)
        save_path = "./downloads"
        os.makedirs(save_path, exist_ok=True)

        paper = search_results[0]
        download_query = DownloadQuery(searcher="arxiv", content_id=paper.paper_id)
        result = asyncio.run(async_download_per_query(download_query))
        self.assertIsInstance(result, str, f"Result should be a string")
        if not result.startswith("Error"):
            self.assertTrue(result.endswith(".pdf"), f"Result should be a PDF file path")
            self.assertTrue(os.path.exists(result), f"PDF file should exist on disk")

    def test_download_with_paper_id_alias(self):
        """Test backward compatibility with paper_id parameter."""
        # First search for results
        query = PaperQuery(searcher="arxiv", query="machine learning", max_results=1)
        search_results = asyncio.run(async_search_per_query(query))
        self.assertGreater(len(search_results), 0, "Search should return at least 1 result")

        # Download using paper_id (deprecated but supported)
        save_path = "./downloads"
        os.makedirs(save_path, exist_ok=True)

        paper = search_results[0]
        download_query = PaperDownloadQuery(searcher="arxiv", paper_id=paper.paper_id)
        result = asyncio.run(async_download_per_query(download_query))
        self.assertIsInstance(result, str, f"Result should be a string")
        if not result.startswith("Error"):
            self.assertTrue(result.endswith(".pdf"), f"Result should be a PDF file path")


class TestPaperSearchServer(unittest.TestCase):
    """Legacy tests for backward compatibility."""

    def test_search_arxiv(self):
        """Test the search_arxiv tool returns 10 results."""
        query = PaperQuery(searcher="arxiv", query="machine learning", max_results=10)
        result = asyncio.run(async_search_per_query(query))
        self.assertIsInstance(result, list, "Result should be a list")
        self.assertGreater(len(result), 0, "Should return at least 1 result")
        self.assertLessEqual(len(result), 10, "Should return at most 10 results")
        for paper in result:
            self.assertIsNotNone(paper.title, "Each result should contain a title")
            self.assertIsNotNone(paper.paper_id, "Each result should contain a paper_id")

    def test_download_arxiv_from_search(self):
        """Test downloading arXiv papers based on search results."""
        # First search for results
        query = PaperQuery(searcher="arxiv", query="machine learning", max_results=3)
        search_results = asyncio.run(async_search_per_query(query))
        self.assertGreater(len(search_results), 0, "Search should return at least 1 result")

        # Download directory
        save_path = "./downloads"
        os.makedirs(save_path, exist_ok=True)

        # Download each search result's PDF (limit to first 3)
        for paper in search_results[:3]:
            paper_id = paper.paper_id
            download_query = PaperDownloadQuery(searcher="arxiv", paper_id=paper_id)
            result = asyncio.run(async_download_per_query(download_query))
            self.assertIsInstance(result, str, f"Result for {paper_id} should be a string")
            if not result.startswith("Error"):
                self.assertTrue(result.endswith(".pdf"), f"Result for {paper_id} should be a PDF file path")
                self.assertTrue(os.path.exists(result), f"PDF file for {paper_id} should exist on disk")


if __name__ == "__main__":
    unittest.main()