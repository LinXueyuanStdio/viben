---
sidebar_position: 2
title: "browse_download"
description: "Download paper PDFs from academic databases"
---

# browse_download

The `browse_download` tool downloads paper PDFs from academic databases using paper identifiers. It supports batch downloads and returns the paths to downloaded files.

## Basic Usage

Download a single paper:

```python
browse_download([
    {"searcher": "arxiv", "paper_id": "2303.08774"}
])
```

Download multiple papers:

```python
browse_download([
    {"searcher": "arxiv", "paper_id": "2303.08774"},
    {"searcher": "pubmed", "paper_id": "32790614"},
    {"searcher": "pmc", "paper_id": "PMC7419405"}
])
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searcher` | string | Yes | Platform to download from |
| `paper_id` | string | Yes | Paper identifier (1-200 characters) |

## Paper ID Formats

Each platform uses a different identifier format:

| Searcher | ID Format | Example |
|----------|-----------|---------|
| `arxiv` | arXiv ID | `2303.08774` |
| `pubmed` | PubMed ID (PMID) | `32790614` |
| `pmc` | PMC ID | `PMC7419405` |
| `biorxiv` | bioRxiv DOI | `10.1101/2020.01.01.123456` |
| `medrxiv` | medRxiv DOI | `10.1101/2020.01.01.123456` |
| `iacr` | IACR paper ID | `2009/101` |
| `crossref` | DOI | `10.1038/s41586-020-2649-2` |
| `core` | CORE ID | `123456789` |
| `semantic` | Semantic Scholar ID | See formats below |

### Semantic Scholar ID Formats

Semantic Scholar accepts multiple identifier formats:

| Format | Example |
|--------|---------|
| Semantic Scholar ID | `649def34f8be52c8b66281af98ae884c09aef38b` |
| DOI prefix | `DOI:10.18653/v1/N18-3011` |
| arXiv prefix | `ARXIV:2106.15928` |
| MAG prefix | `MAG:112218234` |
| ACL prefix | `ACL:W12-3903` |
| PMID prefix | `PMID:19872477` |
| PMCID prefix | `PMCID:2323736` |
| URL prefix | `URL:https://arxiv.org/abs/2106.15928v1` |

## Download Examples

### Free Sources

```python
# Download from arXiv
browse_download([
    {"searcher": "arxiv", "paper_id": "2106.12345"}
])

# Download from PubMed
browse_download([
    {"searcher": "pubmed", "paper_id": "32790614"}
])

# Download from PubMed Central
browse_download([
    {"searcher": "pmc", "paper_id": "PMC7419405"}
])

# Download from bioRxiv
browse_download([
    {"searcher": "biorxiv", "paper_id": "10.1101/2020.01.01.123456"}
])

# Download from Semantic Scholar
browse_download([
    {"searcher": "semantic", "paper_id": "DOI:10.18653/v1/N18-3011"}
])

# Download from CORE
browse_download([
    {"searcher": "core", "paper_id": "123456789"}
])
```

### Batch Download

```python
browse_download([
    {"searcher": "arxiv", "paper_id": "2106.12345"},
    {"searcher": "pubmed", "paper_id": "32790614"},
    {"searcher": "pmc", "paper_id": "PMC7419405"},
    {"searcher": "biorxiv", "paper_id": "10.1101/2020.01.01.123456"},
    {"searcher": "semantic", "paper_id": "DOI:10.18653/v1/N18-3011"}
])
```

## Response Format

The tool returns a list of file paths for successfully downloaded papers:

```
[
  "./downloads/arxiv_2106.12345.pdf",
  "./downloads/pubmed_32790614.pdf",
  "./downloads/pmc_PMC7419405.pdf"
]
```

For failed downloads, error messages are included:

```
[
  "./downloads/arxiv_2106.12345.pdf",
  "Error downloading paper 99999999 from pubmed: Paper not found"
]
```

## Download Path

PDFs are saved to the directory specified by `BROWSE_MCP_DOWNLOAD_PATH` environment variable. Default is `./downloads`.

To change the download path:

```json
{
  "env": {
    "BROWSE_MCP_DOWNLOAD_PATH": "/path/to/your/downloads"
  }
}
```

## Input Validation

- **searcher**: Must be one of the enabled sources
- **paper_id**: Must be 1-200 characters, cannot be empty

:::caution Premium Sources
Premium sources (IEEE, Springer, Science Direct, Scopus) require institutional access or subscriptions for PDF downloads. Even with API keys, PDF access depends on your subscription level.
:::

## Error Handling

Common errors:

| Error | Cause | Solution |
|-------|-------|----------|
| Paper not found | Invalid paper ID | Verify the paper ID format |
| Access denied | No subscription | Use free sources or check subscription |
| Network error | Connection failed | Retry the download |
| Searcher not available | Source not enabled | Enable the source in configuration |

## Tips

- Use paper IDs from `browse_search` results for accurate downloads
- Batch downloads are processed concurrently for faster results
- Check the download path if files appear missing

## Next Steps

- [browse_read](./paper-read) - Extract text from downloaded papers
- [browse_search](./paper-search) - Find papers to download
- [Configuration](../configuration) - Configure download path
