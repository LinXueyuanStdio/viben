"""Plugin management for browse-mcp searchers using stevedore.

This module provides a plugin system for dynamically discovering and loading
searcher implementations. Third-party packages can define their own searchers
by registering entry points in the 'browse_mcp.searchers' namespace.

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
from typing import Dict, List, Optional

from loguru import logger
from stevedore import ExtensionManager
from stevedore.exception import NoMatches

from .types import PaperSource, ContentSource


# Namespace for searcher plugins
SEARCHER_NAMESPACE = "browse_mcp.searchers"


class SearcherPluginManager:
    """Manager for searcher plugins using stevedore.

    This class handles the discovery, loading, and filtering of searcher plugins.
    It supports environment variable-based filtering for enabling/disabling sources.
    """

    def __init__(self) -> None:
        """Initialize the plugin manager and load all available searchers."""
        self._all_searchers: Dict[str, PaperSource] = {}
        self._enabled_searchers: Dict[str, PaperSource] = {}
        self._load_errors: Dict[str, str] = {}
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
                    logger.debug(f"Loaded searcher plugin: {name}")
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
            logger.warning(f"No searcher plugins found in namespace: {SEARCHER_NAMESPACE}")

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
            enabled_list = {s.strip().lower() for s in enabled_str.split(",") if s.strip()}
            self._enabled_searchers = {
                k: v for k, v in self._all_searchers.items() if k in enabled_list
            }
            logger.info(f"Enabled sources (via BROWSE_MCP_ENABLED_SOURCES): {', '.join(sorted(self._enabled_searchers.keys()))}")

            # Warn about requested but unavailable sources
            unavailable = enabled_list - set(self._all_searchers.keys())
            if unavailable:
                logger.warning(f"Requested sources not available: {', '.join(sorted(unavailable))}")

        elif disabled_str:
            # Disable specified sources
            disabled_list = {s.strip().lower() for s in disabled_str.split(",") if s.strip()}
            self._enabled_searchers = {
                k: v for k, v in self._all_searchers.items() if k not in disabled_list
            }
            logger.info(f"Disabled sources (via BROWSE_MCP_DISABLED_SOURCES): {', '.join(sorted(disabled_list))}")
            logger.info(f"Enabled sources: {', '.join(sorted(self._enabled_searchers.keys()))}")

        else:
            # All sources enabled
            self._enabled_searchers = self._all_searchers.copy()
            logger.info(f"All sources enabled: {', '.join(sorted(self._enabled_searchers.keys()))}")

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

        Args:
            name: The searcher name (e.g., 'arxiv', 'pubmed').

        Returns:
            The searcher instance if found and enabled, None otherwise.
        """
        return self._enabled_searchers.get(name)

    def is_enabled(self, name: str) -> bool:
        """Check if a searcher is enabled.

        Args:
            name: The searcher name.

        Returns:
            True if the searcher is loaded and enabled.
        """
        return name in self._enabled_searchers

    def is_loaded(self, name: str) -> bool:
        """Check if a searcher is loaded (may or may not be enabled).

        Args:
            name: The searcher name.

        Returns:
            True if the searcher was successfully loaded.
        """
        return name in self._all_searchers


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
