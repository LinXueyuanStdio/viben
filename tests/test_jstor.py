# tests/test_jstor.py
import unittest
from academic_mcp.sources.jstor import JSTORSearcher


class TestJSTORSearcher(unittest.TestCase):
    def test_search(self):
        """Test JSTOR search (no free API available)"""
        searcher = JSTORSearcher()
        papers = searcher.search("machine learning", max_results=5)
        print("JSTOR does not provide a free public API")
        print("Please use institutional access at https://www.jstor.org/")
        # Expected to return empty list
        self.assertEqual(len(papers), 0)


if __name__ == '__main__':
    unittest.main()
