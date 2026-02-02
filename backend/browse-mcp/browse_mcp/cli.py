"""CLI utilities for browse-mcp plugin management.

This module provides command-line tools for discovering, installing, and
managing browse-mcp plugins.

Usage:
    browse-mcp list          # List all installed sources
    browse-mcp show <name>   # Show details of a provider
    browse-mcp install <pkg> # Install a provider plugin
"""
import json
import subprocess
import sys

import typer

from .plugin import get_plugin_manager

# CLI app for plugin management
app = typer.Typer(
    name="browse-mcp",
    help="Browse MCP - Content source plugin management.",
    add_completion=False,
)

# Provider metadata for display and installation
PROVIDER_METADATA = {
    "academic": {
        "name": "Academic Sources",
        "description": "Free academic databases and preprint servers (arXiv, PubMed, etc.)",
        "package": None,  # Built-in
    },
    "publisher": {
        "name": "Publisher Sources",
        "description": "Commercial publisher APIs - requires API keys (IEEE, Springer, etc.)",
        "package": None,  # Built-in
    },
    "institutional": {
        "name": "Institutional Sources",
        "description": "Institutional and research databases (JSTOR, Web of Science, etc.)",
        "package": None,  # Built-in
    },
    "web": {
        "name": "Web Sources",
        "description": "Web-based search engines (Google Scholar)",
        "package": None,  # Built-in
    },
    "social": {
        "name": "Social Media Sources",
        "description": "Social media platforms (Zhihu, GitHub, Twitter, Xiaohongshu)",
        "package": "browse-mcp-plugin-social-media",
    },
    "docs": {
        "name": "Documentation Sources",
        "description": "Documentation and knowledge bases (Context7)",
        "package": None,  # Built-in or separate
    },
    "other": {
        "name": "Other Sources",
        "description": "Miscellaneous content sources",
        "package": None,
    },
}


@app.command(name="list")
def list_sources(
    json_output: bool = typer.Option(
        True, "--json/--text", help="Output format: JSON (default) or plain text."
    ),
    all_sources: bool = typer.Option(
        False, "--all", "-a", help="Include disabled sources."
    ),
) -> None:
    """List all available content sources.

    Outputs installed plugins/searchers grouped by provider.
    JSON format is suitable for desktop applications.

    Examples:
        browse-mcp list
        browse-mcp list --text
        browse-mcp list --all
    """
    pm = get_plugin_manager()
    sources_by_provider = pm.sources_by_provider
    enabled_sources = set(pm.available_sources)
    all_searchers = pm.all_searchers if all_sources else pm.enabled_searchers

    # Build provider info
    providers_output = {}
    for provider, sources in sources_by_provider.items():
        meta = PROVIDER_METADATA.get(provider, {})
        providers_output[provider] = {
            "name": meta.get("name", provider.title()),
            "description": meta.get("description", ""),
            "package": meta.get("package"),
            "sources": sorted(sources),
            "count": len(sources),
        }

    # Build flat sources list
    sources_list = []
    for name in sorted(all_searchers.keys()):
        provider = pm.get_provider(name)
        sources_list.append({
            "name": name,
            "provider": provider,
            "enabled": name in enabled_sources,
        })

    output = {
        "providers": providers_output,
        "sources": sources_list,
        "total": len(pm.all_searchers),
        "enabled": len(enabled_sources),
    }

    if json_output:
        print(json.dumps(output, indent=2))
    else:
        # Plain text output
        print(f"Browse MCP Sources ({len(enabled_sources)} enabled / {len(pm.all_searchers)} total)\n")
        for provider, info in sorted(providers_output.items()):
            print(f"{info['name']} ({info['count']} sources):")
            if info.get("description"):
                print(f"  {info['description']}")
            for source in info["sources"]:
                status = "✓" if source in enabled_sources else "✗"
                print(f"    {status} {source}")
            print()


@app.command(name="show")
def show_provider(
    provider: str = typer.Argument(
        ..., help="Provider name (e.g., 'academic', 'social')"
    ),
    json_output: bool = typer.Option(
        True, "--json/--text", help="Output format: JSON (default) or plain text."
    ),
) -> None:
    """Show details of a specific provider.

    Displays provider metadata, available sources, and installation status.

    Examples:
        browse-mcp show academic
        browse-mcp show social --text
    """
    pm = get_plugin_manager()
    sources_by_provider = pm.sources_by_provider

    # Check if provider exists in metadata or loaded sources
    all_providers = set(PROVIDER_METADATA.keys()) | set(sources_by_provider.keys())
    if provider not in all_providers:
        typer.echo(f"Error: Unknown provider '{provider}'", err=True)
        typer.echo(f"Available providers: {', '.join(sorted(all_providers))}", err=True)
        raise typer.Exit(1)

    meta = PROVIDER_METADATA.get(provider, {})
    sources = sources_by_provider.get(provider, [])
    enabled_sources = set(pm.available_sources)

    output = {
        "provider": provider,
        "name": meta.get("name", provider.title()),
        "description": meta.get("description", ""),
        "package": meta.get("package"),
        "installed": len(sources) > 0,
        "sources": [
            {"name": s, "enabled": s in enabled_sources} for s in sorted(sources)
        ],
        "count": len(sources),
    }

    if json_output:
        print(json.dumps(output, indent=2))
    else:
        print(f"Provider: {output['name']}")
        print(f"ID: {provider}")
        if output["description"]:
            print(f"Description: {output['description']}")
        if output["package"]:
            print(f"Package: {output['package']}")
        print(f"Installed: {'Yes' if output['installed'] else 'No'}")
        if output["sources"]:
            print(f"Sources ({output['count']}):")
            for s in output["sources"]:
                status = "✓" if s["enabled"] else "✗"
                print(f"  {status} {s['name']}")
        else:
            print("Sources: None installed")
            if output["package"]:
                print(f"\nTo install: browse-mcp install {provider}")


@app.command(name="install")
def install_provider(
    provider: str = typer.Argument(
        ..., help="Provider name to install (e.g., 'social')"
    ),
    upgrade: bool = typer.Option(
        False, "--upgrade", "-U", help="Upgrade if already installed."
    ),
) -> None:
    """Install a provider plugin package.

    Installs the pip package for a provider plugin.
    Built-in providers (academic, publisher, etc.) don't need installation.

    Examples:
        browse-mcp install social
        browse-mcp install social --upgrade
    """
    if provider not in PROVIDER_METADATA:
        typer.echo(f"Error: Unknown provider '{provider}'", err=True)
        typer.echo(
            f"Available providers: {', '.join(sorted(PROVIDER_METADATA.keys()))}",
            err=True,
        )
        raise typer.Exit(1)

    meta = PROVIDER_METADATA[provider]
    package = meta.get("package")

    if not package:
        typer.echo(f"Provider '{provider}' is built-in and doesn't need installation.")
        raise typer.Exit(0)

    typer.echo(f"Installing {meta['name']}...")
    typer.echo(f"Package: {package}")

    cmd = [sys.executable, "-m", "pip", "install"]
    if upgrade:
        cmd.append("--upgrade")
    cmd.append(package)

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        if result.stdout:
            typer.echo(result.stdout)
        typer.echo(f"Successfully installed {package}")
        typer.echo("\nRestart browse-mcp to load the new sources.")
    except subprocess.CalledProcessError as e:
        typer.echo(f"Error installing {package}:", err=True)
        if e.stderr:
            typer.echo(e.stderr, err=True)
        raise typer.Exit(1)


def main() -> None:
    """CLI entrypoint for plugin management."""
    app()


if __name__ == "__main__":
    main()
