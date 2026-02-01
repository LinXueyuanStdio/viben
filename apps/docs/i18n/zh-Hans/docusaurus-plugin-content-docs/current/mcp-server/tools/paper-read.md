---
sidebar_position: 3
title: "paper_read"
description: "Extract and read text content from academic papers"
---

# paper_read

The `paper_read` tool extracts and reads text content from academic papers. It automatically downloads the paper if not already present, then extracts the text content from the PDF.

## Basic Usage

```python
paper_read(searcher="arxiv", paper_id="2303.08774")
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searcher` | string | Yes | Platform to read from |
| `paper_id` | string | Yes | Paper identifier (1-200 characters) |

## Paper ID Formats

Each platform uses a different identifier format. See the [paper_download](./paper-download#paper-id-formats) reference for complete format details.

| Searcher | Example |
|----------|---------|
| `arxiv` | `2303.08774` |
| `pubmed` | `32790614` |
| `pmc` | `PMC7419405` |
| `biorxiv` | `10.1101/2020.01.01.123456` |
| `medrxiv` | `10.1101/2020.01.01.123456` |
| `iacr` | `2009/101` |
| `crossref` | `10.1038/s41586-020-2649-2` |
| `semantic` | `DOI:10.18653/v1/N18-3011` |
| `core` | `123456789` |

## Read Examples

### Read from Different Sources

```python
# Read from arXiv
paper_read(searcher="arxiv", paper_id="2106.12345")

# Read from PubMed
paper_read(searcher="pubmed", paper_id="32790614")

# Read from PubMed Central
paper_read(searcher="pmc", paper_id="PMC7419405")

# Read from bioRxiv
paper_read(searcher="biorxiv", paper_id="10.1101/2020.01.01.123456")

# Read from medRxiv
paper_read(searcher="medrxiv", paper_id="10.1101/2020.01.01.123456")

# Read from IACR
paper_read(searcher="iacr", paper_id="2009/101")

# Read from Semantic Scholar
paper_read(searcher="semantic", paper_id="DOI:10.18653/v1/N18-3011")

# Read from CrossRef
paper_read(searcher="crossref", paper_id="10.1038/s41586-020-2649-2")

# Read from CORE
paper_read(searcher="core", paper_id="123456789")
```

## How It Works

1. **Check local cache**: The tool first checks if the PDF is already downloaded
2. **Download if needed**: If not found locally, it downloads the PDF automatically
3. **Extract text**: Uses PDF parsing to extract text content from the document
4. **Return content**: Returns the extracted text as a string

```
paper_read(searcher, paper_id)
        |
        v
+------------------+
| Check local file |
+------------------+
        |
   Found? No -----> Download PDF
        |               |
       Yes              v
        |          Save to disk
        |               |
        v               v
+------------------+
| Extract text     |
| from PDF         |
+------------------+
        |
        v
  Return text content
```

## Response Format

The tool returns the extracted text content from the paper:

```
Title: GPT-4 Technical Report

Abstract
We report the development of GPT-4, a large-scale, multimodal
model which can accept image and text inputs and produce text
outputs. While less capable than humans in many real-world
scenarios, GPT-4 exhibits human-level performance on various
professional and academic benchmarks...

1 Introduction
This technical report presents GPT-4, a large multimodal model
capable of processing image and text inputs and producing text
outputs...

[Full paper text continues...]
```

## Input Validation

- **searcher**: Must be one of the enabled sources
- **paper_id**: Must be 1-200 characters, cannot be empty or whitespace only

## Error Handling

Common errors and their meanings:

| Error | Cause | Solution |
|-------|-------|----------|
| Searcher not available | Source not enabled | Enable the source in configuration |
| Paper ID cannot be empty | Empty or whitespace ID | Provide a valid paper ID |
| Paper not found | Invalid paper ID | Verify the paper ID format |
| Error converting paper to text | PDF parsing failed | Try re-downloading or use a different source |

## Tips

:::tip Workflow
For best results, use `paper_search` first to find papers, then use the returned paper IDs with `paper_read` to extract content.
:::

- The tool automatically downloads papers, so you do not need to call `paper_download` first
- Already downloaded papers are cached, so subsequent reads are faster
- Text extraction quality depends on the PDF structure (some scanned PDFs may not extract well)

## Use Cases

### Research Summary

Ask your AI assistant:
> "Read the paper 2303.08774 from arXiv and summarize the key findings"

### Literature Review

After searching:
> "Search for papers about transformer architecture on arXiv, then read and compare the top 3 results"

### Citation Extraction

> "Read this paper and list all the papers it references"

## Next Steps

- [paper_search](./paper-search) - Find papers to read
- [paper_download](./paper-download) - Download papers for offline access
- [Configuration](../configuration) - Configure download path
