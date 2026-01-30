# tests/test_pmc.py
import unittest
from academic_mcp.sources.pmc import PMCSearcher


class TestPMCSearcher(unittest.TestCase):
    def test_search(self):
        searcher = PMCSearcher()
        papers = searcher.search("cancer treatment", max_results=10)
        print(f"Found {len(papers)} papers for query 'cancer treatment':")
        for i, paper in enumerate(papers, 1):
            print(f"{i}. {paper.title} (ID: {paper.paper_id})")
        self.assertGreater(len(papers), 0)
        if papers:
            self.assertTrue(papers[0].title)
            self.assertTrue(papers[0].paper_id)


if __name__ == '__main__':
    unittest.main()
