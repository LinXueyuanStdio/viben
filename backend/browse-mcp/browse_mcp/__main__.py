import asyncio
import os
import time
import traceback
from typing import Any, Dict, List, Literal, Optional, cast

import httpx
from loguru import logger
from fastmcp import FastMCP
from pydantic import BaseModel, Field, field_validator, model_validator
import typer

from .types import Paper, PaperSource, paper2text
from .plugin import get_enabled_searchers, get_available_sources
from .api_logger import init_api_logger, get_api_logger

# Initialize MCP server
mcp = FastMCP("browse_mcp")

SAVE_PATH = os.getenv("BROWSE_MCP_DOWNLOAD_PATH", "./downloads")
os.makedirs(SAVE_PATH, exist_ok=True)

# Get enabled searchers from the plugin system
engine2searcher: Dict[str, PaperSource] = get_enabled_searchers()

# Initialize API logger at module load
_api_logger_instance = init_api_logger()
logger.info(
    f"Browse MCP API logging ready: run_id={_api_logger_instance.run_id}, "
    f"log_file={_api_logger_instance.log_file_path}, "
    f"enabled={_api_logger_instance.enabled}"
)


def _get_available_sources_str() -> str:
    """Get comma-separated list of available sources for descriptions."""
    return ", ".join(get_available_sources())


# region browse_search


class SearchQuery(BaseModel):
    """Query model for browse_search tool."""

    searcher: Optional[str] = Field(
        default=None,
        description="The content platform to search from. None means searching from all enabled platforms.",
    )
    query: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Search query string. Must be between 1 and 500 characters.",
    )
    max_results: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum number of results to return. Must be between 1 and 100.",
    )
    fetch_details: Optional[bool] = Field(
        default=True,
        description="""[Only applicable to searcher == 'iacr']
Whether to fetch detailed information for each paper.""",
    )
    year: Optional[str] = Field(
        default=None,
        pattern=r"^\d{4}(-\d{4})?|\d{4}-|-\d{4}$",
        description="""[Only applicable to searcher == 'semantic']
Year filter for Semantic Scholar search. Valid formats:
- Single year: '2019'
- Year range: '2016-2020'
- From year onwards: '2010-'
- Up to year: '-2015'""",
    )
    kwargs: Optional[Dict[str, Any]] = Field(
        default=None,
        description="""[Only applicable to searcher == 'crossref']
Additional search parameters:
- filter: CrossRef filter string (e.g., 'has-full-text:true,from-pub-date:2020')
- sort: Sort field ('relevance', 'published', 'updated', 'deposited', etc.)
- order: Sort order ('asc' or 'desc')""",
    )

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        """Validate and clean the query string."""
        v = v.strip()
        if not v:
            raise ValueError("Query cannot be empty or whitespace only")
        return v

    @model_validator(mode="after")
    def validate_searcher_specific_params(self) -> "SearchQuery":
        """Validate that searcher-specific parameters are only used with appropriate searchers."""
        # Validate searcher is in enabled list
        if self.searcher is not None and self.searcher not in engine2searcher:
            available = ", ".join(engine2searcher.keys())
            raise ValueError(
                f"Searcher '{self.searcher}' is not available. Available sources: {available}"
            )

        if self.year is not None and self.searcher not in [None, "semantic"]:
            raise ValueError(
                "'year' parameter is only applicable when searcher is 'semantic' or None"
            )
        if self.kwargs is not None and self.searcher not in [None, "crossref"]:
            raise ValueError(
                "'kwargs' parameter is only applicable when searcher is 'crossref' or None"
            )
        if (
            self.fetch_details is not None
            and self.fetch_details is not True
            and self.searcher not in [None, "iacr"]
        ):
            raise ValueError(
                "'fetch_details' parameter is only applicable when searcher is 'iacr' or None"
            )
        return self


# Asynchronous helper to adapt synchronous searchers
async def async_search(
    searcher: PaperSource, query: str, max_results: int, **kwargs
) -> List[Paper]:
    async with httpx.AsyncClient():
        # Assuming searchers use requests internally; we'll call synchronously for now
        if "year" in kwargs:
            papers = searcher.search(
                query, year=kwargs["year"], max_results=max_results
            )
        else:
            papers = searcher.search(query, max_results=max_results)
        return papers


def expand_query(query_list: list[SearchQuery]) -> list[SearchQuery]:
    expanded_queries = []
    for query in query_list:
        if query.searcher:
            expanded_queries.append(query)
        else:
            # Expand to all available platforms
            for engine in engine2searcher.keys():
                expanded_query = query.model_copy(update={"searcher": engine})
                expanded_queries.append(expanded_query)
    return expanded_queries


async def async_search_per_query(query: SearchQuery) -> List[Paper]:
    if query.searcher is None:
        return []
    searcher = engine2searcher.get(query.searcher)
    if not searcher:
        return []
    papers: List[Paper] = []
    if query.searcher == "iacr" and "iacr" in engine2searcher:
        papers = searcher.search(
            query.query,
            max_results=query.max_results,
            fetch_details=query.fetch_details,
        )
    elif query.searcher == "semantic" and "semantic" in engine2searcher:
        papers = searcher.search(
            query.query, year=query.year, max_results=query.max_results
        )
    elif query.searcher == "crossref" and "crossref" in engine2searcher:
        kwargs = query.kwargs if query.kwargs else {}
        papers = searcher.search(query.query, max_results=query.max_results, **kwargs)
    else:
        papers = await async_search(searcher, query.query, query.max_results)
    return papers


async def async_search_per_query_list(query_list: List[SearchQuery]) -> List[Paper]:
    all_papers = await asyncio.gather(
        *[async_search_per_query(query) for query in query_list]
    )
    papers = sum(all_papers, [])
    return papers


def _build_browse_search_description() -> str:
    """Build the browse_search tool description dynamically."""
    sources = _get_available_sources_str()
    return f"""Search content from multiple sources.

## Available sources: {sources}

## Input Constraints:
- query: 1-500 characters, required, cannot be empty
- max_results: 1-100, default is 10
- year: Valid formats: '2019', '2016-2020', '2010-', '-2015' (only for semantic)
- fetch_details: boolean (only for iacr)
- kwargs: dict (only for crossref)

## Example:
browse_search([
    {{"searcher": "arxiv", "query": "machine learning", "max_results": 5}},
    {{"searcher": "pubmed", "query": "cancer immunotherapy", "max_results": 3}},
    {{"searcher": "iacr", "query": "cryptography", "max_results": 3, "fetch_details": true}},
    {{"searcher": "semantic", "query": "climate change", "max_results": 4, "year": "2015-2020"}},
    {{"searcher": "crossref", "query": "deep learning", "max_results": 2, "kwargs": {{"filter": "from-pub-date:2020,has-full-text:true"}}}},
    {{"query": "deep learning", "max_results": 2}}
])
"""


@mcp.tool(
    name="browse_search",
    description=_build_browse_search_description(),
)
async def browse_search(query_list: List[SearchQuery]) -> str:
    """Search content from multiple sources."""
    api_logger = get_api_logger()
    start_time = time.perf_counter()
    error_msg = None
    status = "success"
    result_count = 0

    try:
        async with httpx.AsyncClient():
            expanded_queries = expand_query(query_list)
            papers = await async_search_per_query_list(expanded_queries)
            texts = []
            for paper in papers:
                if isinstance(paper, dict) and "error" in paper:
                    pass
                else:
                    # Support both Paper and custom content types with to_text() method
                    if hasattr(paper, "to_text"):
                        texts.append(paper.to_text())
                    else:
                        # Fallback for backward compatibility
                        texts.append(paper2text(cast(Paper, paper)))
            result_count = len(texts)
            content = "\n\n".join(texts) if texts else "No content found."
            return content
    except Exception as e:
        status = "error"
        error_msg = str(e)
        logger.error(f"Error in browse_search: {e}\n{traceback.format_exc()}")
        return f"Error searching content: {e}"
    finally:
        latency_ms = (time.perf_counter() - start_time) * 1000
        # Log each query in the list
        for query in query_list:
            api_logger.log_request(
                provider="browse",
                source=query.searcher or "all",
                method="search",
                request={"query": query.query, "max_results": query.max_results},
                response={"count": result_count},
                latency_ms=latency_ms,
                status=status,
                error=error_msg,
            )


# endregion browse_search


# region browse_download
class DownloadQuery(BaseModel):
    """Query model for browse_download tool."""

    searcher: str = Field(description="The content platform to download from.")
    content_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="""The unique identifier of the content to download. Format depends on the searcher:
- arxiv: arXiv ID (e.g., '2106.12345')
- pubmed: PubMed ID/PMID (e.g., '32790614')
- biorxiv: bioRxiv DOI (e.g., '10.1101/2020.01.01.123456')
- medrxiv: medRxiv DOI (e.g., '10.1101/2020.01.01.123456')
- iacr: IACR paper ID (e.g., '2009/101')
- semantic: Semantic Scholar ID or prefixed ID (e.g., 'DOI:10.18653/v1/N18-3011', 'ARXIV:2106.15928')
- crossref: DOI (e.g., '10.1038/s41586-020-2649-2')""",
    )

    @field_validator("searcher")
    @classmethod
    def validate_searcher(cls, v: str) -> str:
        """Validate searcher is enabled."""
        if v not in engine2searcher:
            available = ", ".join(engine2searcher.keys())
            raise ValueError(
                f"Searcher '{v}' is not available. Available sources: {available}"
            )
        return v

    @field_validator("content_id")
    @classmethod
    def validate_content_id(cls, v: str) -> str:
        """Validate and clean the content_id string."""
        v = v.strip()
        if not v:
            raise ValueError("content_id cannot be empty or whitespace only")
        return v


async def async_download_per_query(query: DownloadQuery) -> str:
    searcher = engine2searcher.get(query.searcher)
    if not searcher:
        return f"Searcher '{query.searcher}' not found."
    try:
        content_id = query.content_id.strip()
        pdf_path = searcher.download_pdf(content_id, SAVE_PATH)
        return pdf_path
    except Exception as e:
        content_id = query.content_id.strip()
        logger.error(
            f"Error downloading content {content_id} from {query.searcher}: {e}\n{traceback.format_exc()}"
        )
        return f"Error downloading content {content_id} from {query.searcher}: {e}"


def _build_browse_download_description() -> str:
    """Build the browse_download tool description dynamically."""
    sources = _get_available_sources_str()
    return f"""Download content (e.g., PDFs) from multiple sources.

## Available sources: {sources}

## Input Constraints:
- searcher: Required, must be one of the supported platforms
- content_id: Required, 1-200 characters, cannot be empty

## Content ID formats:
- arXiv: Use the arXiv ID (e.g., "2106.12345").
- PubMed: Use the PubMed ID (PMID) (e.g., "32790614").
- bioRxiv: Use the bioRxiv DOI (e.g., "10.1101/2020.01.01.123456").
- medRxiv: Use the medRxiv DOI (e.g., "10.1101/2020.01.01.123456").
- Google Scholar: Direct PDF download is not supported; please use the paper URL to access the publisher's website.
- IACR: Use the IACR paper ID (e.g., "2009/101").
- Semantic Scholar: Use the Semantic Scholar paper ID, Paper identifier in one of the following formats:
    - Semantic Scholar ID (e.g., "649def34f8be52c8b66281af98ae884c09aef38b")
    - DOI:<doi> (e.g., "DOI:10.18653/v1/N18-3011")
    - ARXIV:<id> (e.g., "ARXIV:2106.15928")
    - MAG:<id> (e.g., "MAG:112218234")
    - ACL:<id> (e.g., "ACL:W12-3903")
    - PMID:<id> (e.g., "PMID:19872477")
    - PMCID:<id> (e.g., "PMCID:2323736")
    - URL:<url> (e.g., "URL:https://arxiv.org/abs/2106.15928v1")

## Returns:
List of paths to the downloaded files.

## Example:
browse_download([
    {{"searcher": "arxiv", "content_id": "2106.12345"}},
    {{"searcher": "pubmed", "content_id": "32790614"}},
    {{"searcher": "biorxiv", "content_id": "10.1101/2020.01.01.123456"}},
    {{"searcher": "semantic", "content_id": "DOI:10.18653/v1/N18-3011"}}
])
"""


@mcp.tool(
    name="browse_download",
    description=_build_browse_download_description(),
)
async def browse_download(query_list: List[DownloadQuery]) -> List[str]:
    """Download content from multiple sources."""
    api_logger = get_api_logger()
    start_time = time.perf_counter()
    error_msg = None
    status = "success"
    pdf_paths: List[str] = []

    try:
        async with httpx.AsyncClient():
            pdf_paths = list(
                await asyncio.gather(*[async_download_per_query(q) for q in query_list])
            )
            return pdf_paths
    except Exception as e:
        status = "error"
        error_msg = str(e)
        logger.error(f"Error in browse_download: {e}\n{traceback.format_exc()}")
        return []
    finally:
        latency_ms = (time.perf_counter() - start_time) * 1000
        # Log each download query
        for query in query_list:
            api_logger.log_request(
                provider="browse",
                source=query.searcher,
                method="download",
                request={"content_id": query.content_id},
                response={"paths": pdf_paths},
                latency_ms=latency_ms,
                status=status,
                error=error_msg,
            )


# endregion browse_download


# region browse_read
def _build_browse_read_description() -> str:
    """Build the browse_read tool description dynamically."""
    sources = _get_available_sources_str()
    return f"""Read and extract text content from sources with optional pagination support.

## Available sources: {sources}

## Input Constraints:
- searcher: Required, must be one of the available sources
- content_id: Required, 1-200 characters, cannot be empty
- page: Optional, specific page number to read (1-indexed)
- start_page: Optional, start page for range extraction (1-indexed)
- end_page: Optional, end page for range extraction (1-indexed)

## Pagination behavior:
- No pagination params: Return all content
- page=3: Return only page 3
- start_page=1, end_page=5: Return pages 1-5
- start_page=10: Return from page 10 to end
- end_page=5: Return pages 1-5

## Example:

### Read all content
browse_read(searcher="arxiv", content_id="2106.12345")

### Read specific page
browse_read(searcher="arxiv", content_id="2106.12345", page=3)

### Read page range
browse_read(searcher="arxiv", content_id="2106.12345", start_page=1, end_page=5)

### arXiv
browse_read(searcher="arxiv", content_id="2106.12345")  # content_id is arXiv ID.

### PubMed
browse_read(searcher="pubmed", content_id="32790614")  # content_id is PubMed ID (PMID).

### bioRxiv
browse_read(searcher="biorxiv", content_id="10.1101/2020.01.01.123456")  # content_id is bioRxiv DOI.

### medRxiv
browse_read(searcher="medrxiv", content_id="10.1101/2020.01.01.123456")  # content_id is medRxiv DOI.

### IACR
browse_read(searcher="iacr", content_id="2009/101")  # content_id is IACR paper ID.

### Semantic Scholar
browse_read(searcher="semantic", content_id="DOI:10.18653/v1/N18-3011")
where content_id: Semantic Scholar paper ID, Paper identifier in one of the following formats:
    - Semantic Scholar ID (e.g., "649def34f8be52c8b66281af98ae884c09aef38b")
    - DOI:<doi> (e.g., "DOI:10.18653/v1/N18-3011")
    - ARXIV:<id> (e.g., "ARXIV:2106.15928")
    - MAG:<id> (e.g., "MAG:112218234")
    - ACL:<id> (e.g., "ACL:W12-3903")
    - PMID:<id> (e.g., "PMID:19872477")
    - PMCID:<id> (e.g., "PMCID:2323736")
    - URL:<url> (e.g., "URL:https://arxiv.org/abs/2106.15928v1")

### CrossRef
browse_read(searcher="crossref", content_id="10.1038/s41586-020-2649-2")  # content_id is DOI.
"""


@mcp.tool(
    name="browse_read",
    description=_build_browse_read_description(),
)
async def browse_read(
    searcher: str = Field(..., description="The content platform to read from."),
    content_id: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="The unique identifier of the content to read (format depends on searcher)",
    ),
    page: Optional[int] = Field(
        default=None,
        ge=1,
        description="Specific page number to read (1-indexed). Returns only this page.",
    ),
    start_page: Optional[int] = Field(
        default=None,
        ge=1,
        description="Start page for range extraction (1-indexed, inclusive).",
    ),
    end_page: Optional[int] = Field(
        default=None,
        ge=1,
        description="End page for range extraction (1-indexed, inclusive).",
    ),
) -> str:
    """Read and extract text content with optional pagination."""
    api_logger = get_api_logger()
    start_time = time.perf_counter()
    error_msg = None
    status = "success"
    result_length = 0

    try:
        # Validate searcher
        if searcher not in engine2searcher:
            available = ", ".join(engine2searcher.keys())
            return f"Error: Searcher '{searcher}' is not available. Available sources: {available}"

        # Validate content_id
        content_id = content_id.strip()
        if not content_id:
            return "Error: content_id cannot be empty or whitespace only"

        searcher_instance = engine2searcher.get(searcher)
        if not searcher_instance:
            return f"Searcher '{searcher}' not found or not supported."

        # Call read_paper with pagination parameters
        text = searcher_instance.read_paper(
            content_id,
            SAVE_PATH,
            page=page,
            start_page=start_page,
            end_page=end_page,
        )
        result_length = len(text) if text else 0
        return text
    except Exception as e:
        status = "error"
        error_msg = str(e)
        logger.error(f"Error reading content: {e}\n{traceback.format_exc()}")
        return f"Error reading content: {e}"
    finally:
        latency_ms = (time.perf_counter() - start_time) * 1000
        api_logger.log_request(
            provider="browse",
            source=searcher,
            method="read",
            request={
                "content_id": content_id,
                "page": page,
                "start_page": start_page,
                "end_page": end_page,
            },
            response={"length": result_length},
            latency_ms=latency_ms,
            status=status,
            error=error_msg,
        )


# endregion browse_read


app = typer.Typer(
    add_completion=False,
    help="Browse MCP Server - Start the MCP server for content browsing.",
)


@app.command(name="serve")
def serve(
    host: str = typer.Option("127.0.0.1", help="Bind host (SSE/HTTP only)."),
    port: int = typer.Option(8000, min=1, max=65535, help="Bind port (SSE/HTTP only)."),
    debug: bool = typer.Option(False, help="Enable debug logging."),
    transport: Optional[
        Literal["stdio", "sse", "streamable-http", "http"]
    ] = typer.Option(
        None,
        "--transport",
        "-t",
        help="Transport method. One of: stdio, sse, streamable-http, http. Default is stdio; if host/port are set, defaults to sse.",
    ),
) -> None:
    """Start the Browse MCP server.

    Defaults to stdio transport (for MCP clients). For network services (SSE/HTTP),
    set environment variables:
    - `BROWSE_MCP_TRANSPORT=sse` or `BROWSE_MCP_TRANSPORT=streamable-http`
    """
    log_level = "debug" if debug else "info"

    if not transport or transport == "stdio":
        logger.info("Starting Browse MCP server with stdio transport")
        mcp.run(transport="stdio", log_level=log_level)
        return

    logger.info(
        f"Starting Browse MCP server on {host}:{port} with transport '{transport}'"
    )
    mcp.run(transport=transport, host=host, port=port, log_level=log_level)


@app.callback(invoke_without_command=True)
def main_callback(
    ctx: typer.Context,
) -> None:
    """Browse MCP - Search, download, and read content from multiple sources.

    Commands:
      serve    Start the MCP server (default)
      list     List available sources
      show     Show provider details
      install  Install a provider plugin
    """
    # If no subcommand is given, default to 'serve' for backward compatibility
    if ctx.invoked_subcommand is None:
        # Default to serve with stdio transport
        serve()


def main() -> None:
    """Console script entrypoint."""
    app()


if __name__ == "__main__":
    main()
