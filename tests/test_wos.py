# tests/test_wos.py
import unittest
import os
from academic_mcp.sources.wos import WOSSearcher


class TestWOSSearcher(unittest.TestCase):
    def test_search(self):
        """Test Web of Science search (requires institutional access)"""
        searcher = WOSSearcher()
        papers = searcher.search("machine learning", max_results=5)
        print("Web of Science requires institutional subscription")
        print("Please use institutional access at https://www.webofscience.com/")
        # Expected to return empty list without subscription
        self.assertEqual(len(papers), 0)


if __name__ == '__main__':
    unittest.main()
