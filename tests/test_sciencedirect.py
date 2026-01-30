# tests/test_sciencedirect.py
import unittest
import os
from academic_mcp.sources.sciencedirect import ScienceDirectSearcher


class TestScienceDirectSearcher(unittest.TestCase):
    def test_search(self):
        api_key = os.environ.get('SCIENCEDIRECT_API_KEY')
        if not api_key:
            self.skipTest("SCIENCEDIRECT_API_KEY not set")

        searcher = ScienceDirectSearcher()
        papers = searcher.search("machine learning", max_results=5)
        print(f"Found {len(papers)} papers for query 'machine learning':")
        for i, paper in enumerate(papers, 1):
            print(f"{i}. {paper.title} (ID: {paper.paper_id})")

        if papers:
            self.assertTrue(papers[0].title)
            self.assertTrue(papers[0].paper_id)


if __name__ == '__main__':
    unittest.main()
