# tests/test_researchgate.py
import unittest
from academic_mcp.sources.researchgate import ResearchGateSearcher


class TestResearchGateSearcher(unittest.TestCase):
    def test_search(self):
        """Test ResearchGate search (no official API)"""
        searcher = ResearchGateSearcher()
        papers = searcher.search("machine learning", max_results=5)
        print("ResearchGate does not provide an official public API")
        print("Please use manual search at https://www.researchgate.net/")
        # Expected to return empty list
        self.assertEqual(len(papers), 0)


if __name__ == '__main__':
    unittest.main()
