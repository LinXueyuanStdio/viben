"""Plugin management for browse-mcp searchers using stevedore.

This module provides a plugin system for dynamically discovering and loading
searcher implementations. Third-party packages can define their own searchers
by registering entry points in the 'browse_mcp.searchers' namespace.

Hierarchical Naming:
    Sources use hierarchical names in the format '{provider}/{source_name}'.
    For example: 'academic/arxiv', 'publisher/sciencedirect'.

    For backward compatibility, flat names (e.g., 'arxiv') are also supported
    and will be automatically mapped to their hierarchical equivalents.

Plugin Configuration (Poetry format - Recommended):
    Create a plugin package with pyproject.toml:

    ```toml
    [tool.poetry]
    name = "browse-mcp-custom-searcher"
    version = "0.1.0"
    description = "Custom searcher plugin for browse-mcp"
    packages = [{ include = "my_searcher" }]

    [tool.poetry.dependencies]
    python = ">=3.10"
    browse-mcp = "*"
    stevedore = ">=5.0.0"

    # Register your searchers as plugins
    [tool.poetry.plugins."browse_mcp.searchers"]
    my_searcher = "my_searcher:MySearcher"
    another_searcher = "my_searcher:AnotherSearcher"

    [build-system]
    requires = ["poetry-core>=1.9.0"]
    build-backend = "poetry.core.masonry.api"
    ```

Plugin Implementation:
    Your searcher must inherit from ContentSource[T] or PaperSource:

    ```python
    from dataclasses import dataclass
    from typing import List
    from browse_mcp.types import ContentSource

    @dataclass
    class MyContent:
        content_id: str
        title: str
        body: str

        def to_text(self) -> str:
            return f"Title: {self.title}\\nBody: {self.body}"

    class MySearcher(ContentSource[MyContent]):
        def search(self, query: str, **kwargs) -> List[MyContent]:
            # Your implementation
            pass

        def download(self, content_id: str, save_path: str) -> str:
            # Your implementation
            pass

        def read(self, content_id: str, save_path: str) -> str:
            # Your implementation
            pass
    ```

Installation:
    After installing your plugin package:
    ```bash
    pip install browse-mcp-custom-searcher
    ```

    Your searchers will be automatically discovered and loaded by browse-mcp.

Environment Variables:
    BROWSE_MCP_ENABLED_SOURCES: Comma-separated list of enabled sources
    BROWSE_MCP_DISABLED_SOURCES: Comma-separated list of disabled sources
"""
import os
from typing import Dict, List, Optional, Tuple

from loguru import logger
from stevedore import ExtensionManager
from stevedore.exception import NoMatches

from .types import PaperSource


# Namespace for searcher plugins
SEARCHER_NAMESPACE = "browse_mcp.searchers"

# Provider mapping for hierarchical naming
# Maps flat source names to their provider category
SOURCE_TO_PROVIDER: Dict[str, str] = {
    # Academic sources
    "arxiv": "academic",
    "pubmed": "academic",
    "pmc": "academic",
    "biorxiv": "academic",
    "medrxiv": "academic",
    "semantic": "academic",
    "core": "academic",
    "crossref": "academic",
    "iacr": "academic",
    "acm": "academic",
    # Publisher sources
    "sciencedirect": "publisher",
    "springer": "publisher",
    "ieee": "publisher",
    "scopus": "publisher",
    # Institutional sources
    "wos": "institutional",
    "jstor": "institutional",
    "researchgate": "institutional",
    # Web sources
    "google_scholar": "web",
    # Documentation sources
    "context7": "docs",
}


def get_hierarchical_name(flat_name: str) -> str:
    """Convert a flat source name to hierarchical format.

    Args:
        flat_name: The flat source name (e.g., 'arxiv')

    Returns:
        The hierarchical name (e.g., 'academic/arxiv')
    """
    if "/" in flat_name:
        # Already hierarchical
        return flat_name
    provider = SOURCE_TO_PROVIDER.get(flat_name, "other")
    return f"{provider}/{flat_name}"


def parse_hierarchical_name(name: str) -> Tuple[str, str]:
    """Parse a hierarchical name into provider and source.

    Args:
        name: The name to parse (e.g., 'academic/arxiv' or 'arxiv')

    Returns:
        Tuple of (provider, source_name)
    """
    if "/" in name:
        parts = name.split("/", 1)
        return parts[0], parts[1]
    else:
        provider = SOURCE_TO_PROVIDER.get(name, "other")
        return provider, name


def normalize_source_name(name: str) -> str:
    """Normalize a source name to flat format for internal use.

    Args:
        name: The source name (hierarchical or flat)

    Returns:
        The flat source name
    """
    if "/" in name:
        return name.split("/", 1)[1]
    return name


class SearcherPluginManager:
    """Manager for searcher plugins using stevedore.

    This class handles the discovery, loading, and filtering of searcher plugins.
    It supports environment variable-based filtering for enabling/disabling sources.

    The plugin manager supports both flat names (e.g., 'arxiv') and hierarchical
    names (e.g., 'academic/arxiv') for backward compatibility.
    """

    def __init__(self) -> None:
        """Initialize the plugin manager and load all available searchers."""
        self._all_searchers: Dict[str, PaperSource] = {}
        self._enabled_searchers: Dict[str, PaperSource] = {}
        self._load_errors: Dict[str, str] = {}
        # Maps hierarchical names to flat names
        self._hierarchical_to_flat: Dict[str, str] = {}
        self._load_plugins()
        self._apply_filters()

    def _load_plugins(self) -> None:
        """Load all available searcher plugins from entry points.

        This method uses stevedore's ExtensionManager to discover and load
        all registered searcher plugins. Individual plugin failures are logged
        but do not prevent other plugins from loading.
        """
        logger.info(f"Loading searcher plugins from namespace: {SEARCHER_NAMESPACE}")

        def on_load_failure(manager: ExtensionManager, ep: str, err: Exception) -> None:
            """Callback for handling plugin load failures."""
            error_msg = f"Failed to load searcher '{ep}': {err}"
            logger.warning(error_msg)
            self._load_errors[ep] = str(err)

        try:
            mgr = ExtensionManager(
                namespace=SEARCHER_NAMESPACE,
                invoke_on_load=False,
                on_load_failure_callback=on_load_failure,
            )

            for ext in mgr:
                name = ext.name
                try:
                    # Instantiate the searcher class
                    searcher_instance = ext.plugin()
                    self._all_searchers[name] = searcher_instance

                    # Build hierarchical name mapping
                    hierarchical = get_hierarchical_name(name)
                    self._hierarchical_to_flat[hierarchical] = name

                    logger.debug(f"Loaded searcher plugin: {name} ({hierarchical})")
                except Exception as e:
                    error_msg = f"Failed to instantiate searcher '{name}': {e}"
                    logger.warning(error_msg)
                    self._load_errors[name] = str(e)

            logger.info(
                f"Successfully loaded {len(self._all_searchers)} searcher plugins: "
                f"{', '.join(sorted(self._all_searchers.keys()))}"
            )

            if self._load_errors:
                logger.warning(
                    f"Failed to load {len(self._load_errors)} plugins: "
                    f"{', '.join(sorted(self._load_errors.keys()))}"
                )

        except NoMatches:
            logger.warning(
                f"No searcher plugins found in namespace: {SEARCHER_NAMESPACE}"
            )

    def _apply_filters(self) -> None:
        """Apply environment variable filters to determine enabled searchers.

        Environment variables:
        - BROWSE_MCP_ENABLED_SOURCES: Comma-separated list of enabled sources
        - BROWSE_MCP_DISABLED_SOURCES: Comma-separated list of disabled sources

        If ENABLED_SOURCES is set, only those sources will be enabled.
        If DISABLED_SOURCES is set, all sources except those will be enabled.
        If both are set, ENABLED_SOURCES takes precedence.
        If neither is set, all sources are enabled.
        """
        enabled_str = os.getenv("BROWSE_MCP_ENABLED_SOURCES", "").strip()
        disabled_str = os.getenv("BROWSE_MCP_DISABLED_SOURCES", "").strip()

        if enabled_str:
            # Only enable specified sources
            enabled_list = {
                s.strip().lower() for s in enabled_str.split(",") if s.strip()
            }
            self._enabled_searchers = {
                k: v for k, v in self._all_searchers.items() if k in enabled_list
            }
            logger.info(
                f"Enabled sources (via BROWSE_MCP_ENABLED_SOURCES): {', '.join(sorted(self._enabled_searchers.keys()))}"
            )

            # Warn about requested but unavailable sources
            unavailable = enabled_list - set(self._all_searchers.keys())
            if unavailable:
                logger.warning(
                    f"Requested sources not available: {', '.join(sorted(unavailable))}"
                )

        elif disabled_str:
            # Disable specified sources
            disabled_list = {
                s.strip().lower() for s in disabled_str.split(",") if s.strip()
            }
            self._enabled_searchers = {
                k: v for k, v in self._all_searchers.items() if k not in disabled_list
            }
            logger.info(
                f"Disabled sources (via BROWSE_MCP_DISABLED_SOURCES): {', '.join(sorted(disabled_list))}"
            )
            logger.info(
                f"Enabled sources: {', '.join(sorted(self._enabled_searchers.keys()))}"
            )

        else:
            # All sources enabled
            self._enabled_searchers = self._all_searchers.copy()
            logger.info(
                f"All sources enabled: {', '.join(sorted(self._enabled_searchers.keys()))}"
            )

    @property
    def all_searchers(self) -> Dict[str, PaperSource]:
        """Get all loaded searchers (regardless of filter settings).

        Returns:
            Dict mapping searcher names to their instances.
        """
        return self._all_searchers.copy()

    @property
    def enabled_searchers(self) -> Dict[str, PaperSource]:
        """Get only the enabled searchers (after applying filters).

        Returns:
            Dict mapping searcher names to their instances.
        """
        return self._enabled_searchers.copy()

    @property
    def available_sources(self) -> List[str]:
        """Get list of all available source names (enabled only).

        Returns:
            Sorted list of enabled searcher names.
        """
        return sorted(self._enabled_searchers.keys())

    @property
    def load_errors(self) -> Dict[str, str]:
        """Get any errors that occurred during plugin loading.

        Returns:
            Dict mapping plugin names to error messages.
        """
        return self._load_errors.copy()

    def get_searcher(self, name: str) -> Optional[PaperSource]:
        """Get a specific searcher by name.

        Supports both flat names (e.g., 'arxiv') and hierarchical names
        (e.g., 'academic/arxiv').

        Args:
            name: The searcher name (flat or hierarchical).

        Returns:
            The searcher instance if found and enabled, None otherwise.
        """
        # Normalize the name to flat format
        flat_name = normalize_source_name(name)
        return self._enabled_searchers.get(flat_name)

    def is_enabled(self, name: str) -> bool:
        """Check if a searcher is enabled.

        Args:
            name: The searcher name (flat or hierarchical).

        Returns:
            True if the searcher is loaded and enabled.
        """
        flat_name = normalize_source_name(name)
        return flat_name in self._enabled_searchers

    def is_loaded(self, name: str) -> bool:
        """Check if a searcher is loaded (may or may not be enabled).

        Args:
            name: The searcher name (flat or hierarchical).

        Returns:
            True if the searcher was successfully loaded.
        """
        flat_name = normalize_source_name(name)
        return flat_name in self._all_searchers

    def get_provider(self, name: str) -> str:
        """Get the provider category for a source.

        Args:
            name: The source name (flat or hierarchical).

        Returns:
            The provider category (e.g., 'academic', 'publisher').
        """
        provider, _ = parse_hierarchical_name(name)
        return provider

    @property
    def hierarchical_sources(self) -> Dict[str, str]:
        """Get mapping of hierarchical names to flat names.

        Returns:
            Dict mapping hierarchical names to flat names.
        """
        return self._hierarchical_to_flat.copy()

    @property
    def sources_by_provider(self) -> Dict[str, List[str]]:
        """Get sources grouped by provider.

        Returns:
            Dict mapping provider names to lists of source names.
        """
        result: Dict[str, List[str]] = {}
        for flat_name in self._enabled_searchers.keys():
            provider = SOURCE_TO_PROVIDER.get(flat_name, "other")
            if provider not in result:
                result[provider] = []
            result[provider].append(flat_name)
        return result


# Global singleton instance
_plugin_manager: Optional[SearcherPluginManager] = None


def get_plugin_manager() -> SearcherPluginManager:
    """Get or create the global plugin manager instance.

    Returns:
        The singleton SearcherPluginManager instance.
    """
    global _plugin_manager
    if _plugin_manager is None:
        _plugin_manager = SearcherPluginManager()
    return _plugin_manager


def get_enabled_searchers() -> Dict[str, PaperSource]:
    """Get all enabled searchers.

    This is a convenience function for backward compatibility.

    Returns:
        Dict mapping searcher names to their instances.
    """
    return get_plugin_manager().enabled_searchers


def get_available_sources() -> List[str]:
    """Get list of available source names.

    Returns:
        Sorted list of enabled searcher names.
    """
    return get_plugin_manager().available_sources


def reset_plugin_manager() -> None:
    """Reset the plugin manager singleton.

    This is primarily useful for testing to reload plugins.
    """
    global _plugin_manager
    _plugin_manager = None
