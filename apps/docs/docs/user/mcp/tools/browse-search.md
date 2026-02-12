---
sidebar_position: 1
title: "browse_search"
description: "Search academic papers across multiple databases"
---

# browse_search

The `browse_search` tool searches for academic papers across multiple platforms simultaneously. It supports querying 19+ academic databases with flexible filtering options.

## Basic Usage

Search a single platform:

```python
browse_search([
    {"searcher": "arxiv", "query": "machine learning", "max_results": 5}
])
```

Search multiple platforms at once:

```python
browse_search([
    {"searcher": "arxiv", "query": "deep learning", "max_results": 5},
    {"searcher": "pubmed", "query": "cancer immunotherapy", "max_results": 3},
    {"searcher": "semantic", "query": "climate change", "max_results": 4}
])
```

Search all enabled platforms:

```python
browse_search([
    {"query": "quantum computing", "max_results": 10}
])
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query (1-500 characters) |
| `searcher` | string | No | all | Platform to search (omit for all platforms) |
| `max_results` | integer | No | 10 | Number of results (1-100) |
| `year` | string | No | - | Year filter (Semantic Scholar only) |
| `fetch_details` | boolean | No | true | Fetch paper details (IACR only) |
| `kwargs` | object | No | - | Additional parameters (CrossRef only) |

## Available Searchers

### Free Sources (No API Key Required)

| Searcher | Description |
|----------|-------------|
| `arxiv` | Pre-print repository for physics, mathematics, CS |
| `pubmed` | Biomedical literature from MEDLINE |
| `pmc` | PubMed Central full-text archive |
| `biorxiv` | Pre-print server for biology |
| `medrxiv` | Pre-print server for health sciences |
| `semantic` | Semantic Scholar AI-powered search |
| `crossref` | CrossRef DOI metadata |
| `google_scholar` | Google Scholar search |
| `core` | CORE open access aggregator |
| `iacr` | IACR cryptology pre-prints |

### Premium Sources (API Key Required)

| Searcher | API Key Variable |
|----------|-----------------|
| `ieee` | `IEEE_API_KEY` |
| `scopus` | `SCOPUS_API_KEY` |
| `springer` | `SPRINGER_API_KEY` |
| `sciencedirect` | `SCIENCEDIRECT_API_KEY` |

## Search Examples

### Single Platform Search

```python
# Search arXiv for machine learning papers
browse_search([
    {"searcher": "arxiv", "query": "machine learning", "max_results": 5}
])

# Search PubMed Central for biomedical papers
browse_search([
    {"searcher": "pmc", "query": "cancer treatment", "max_results": 5}
])

# Search CORE for open access papers
browse_search([
    {"searcher": "core", "query": "climate change", "max_results": 5}
])
```

### Multi-Platform Search

```python
# Search multiple platforms simultaneously
browse_search([
    {"searcher": "arxiv", "query": "deep learning", "max_results": 5},
    {"searcher": "pubmed", "query": "cancer immunotherapy", "max_results": 3},
    {"searcher": "pmc", "query": "diabetes treatment", "max_results": 3}
])
```

### Platform-Specific Parameters

**Semantic Scholar with year filter:**

```python
browse_search([
    {"searcher": "semantic", "query": "climate change", "max_results": 4, "year": "2020-2023"}
])
```

Year filter formats:
- Single year: `"2019"`
- Year range: `"2016-2020"`
- From year onwards: `"2010-"`
- Up to year: `"-2015"`

**CrossRef with additional filters:**

```python
browse_search([
    {
        "searcher": "crossref",
        "query": "deep learning",
        "max_results": 5,
        "kwargs": {
            "filter": "from-pub-date:2020,has-full-text:true",
            "sort": "relevance",
            "order": "desc"
        }
    }
])
```

**IACR without fetching details:**

```python
browse_search([
    {"searcher": "iacr", "query": "cryptography", "max_results": 10, "fetch_details": false}
])
```

### Premium Sources

```python
# Search IEEE Xplore (requires IEEE_API_KEY)
browse_search([
    {"searcher": "ieee", "query": "neural networks", "max_results": 5}
])

# Search Springer Link (requires SPRINGER_API_KEY)
browse_search([
    {"searcher": "springer", "query": "quantum computing", "max_results": 5}
])

# Search Scopus (requires SCOPUS_API_KEY)
browse_search([
    {"searcher": "scopus", "query": "artificial intelligence", "max_results": 5}
])
```

## Response Format

Results are returned as formatted text for each paper:

```
Source: 'arxiv'
Paper ID: '2303.08774'
Title: GPT-4 Technical Report
Authors: OpenAI
Abstract: We report the development of GPT-4, a large-scale...
Published Date: 2023-03-15
URL: https://arxiv.org/abs/2303.08774
DOI: 10.48550/arXiv.2303.08774
Categories: cs.CL; cs.AI
```

## Input Validation

The tool validates inputs before searching:

- **query**: Must be 1-500 characters, cannot be empty or whitespace only
- **max_results**: Must be between 1 and 100
- **searcher**: Must be one of the enabled sources (if specified)
- **year**: Must match format `YYYY`, `YYYY-YYYY`, `YYYY-`, or `-YYYY`

:::tip Best Practice
Specify the `searcher` parameter to target specific platforms. Omitting it searches all enabled platforms, which can be slower and may return more results than needed.
:::

## Error Handling

If a search fails, the tool continues with other searches and returns partial results. Common errors:

- **Invalid searcher**: Returns available searchers list
- **Empty query**: Returns validation error
- **API rate limit**: Returns error for that source, continues with others
- **Network timeout**: Returns error for that source, continues with others

## Next Steps

- [browse_download](./browse-download) - Download paper PDFs
- [browse_read](./browse-read) - Extract text from papers
- [Configuration](../configuration) - Configure sources and API keys
