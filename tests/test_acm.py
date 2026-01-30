# tests/test_acm.py
import unittest
from academic_mcp.sources.acm import ACMSearcher


class TestACMSearcher(unittest.TestCase):
    def test_search(self):
        """Test ACM search (expects empty results due to no API)"""
        searcher = ACMSearcher()
        papers = searcher.search("machine learning", max_results=5)
        print("ACM Digital Library does not provide a free public API")
        print("Manual search required at https://dl.acm.org/")
        # Expected to return empty list
        self.assertEqual(len(papers), 0)


if __name__ == '__main__':
    unittest.main()
