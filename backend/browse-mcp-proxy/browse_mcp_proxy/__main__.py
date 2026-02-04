"""
Browse MCP Proxy - CLI Entry Point

A proxy server that enables browser-based MCP Inspector connections.
Bridges CORS, session management, and transport types.
"""

import secrets
import sys
import webbrowser
from typing import Optional

import typer
import uvicorn
from loguru import logger

from .proxy import create_app

app = typer.Typer(
    name="browse-mcp-proxy",
    help="MCP Proxy Server for browser-based Inspector connections.",
    add_completion=False,
)


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host to bind to"),
    port: int = typer.Option(6277, "--port", "-p", help="Port to bind to"),
    client_port: int = typer.Option(
        6274, "--client-port", "-c", help="Client port for CORS"
    ),
    auth_token: Optional[str] = typer.Option(
        None, "--auth-token", "-t", envvar="MCP_PROXY_AUTH_TOKEN", help="Auth token"
    ),
    no_auth: bool = typer.Option(
        False, "--no-auth", help="Disable authentication (DANGEROUS)"
    ),
    open_browser: bool = typer.Option(
        False, "--open", "-o", help="Open browser with auth token"
    ),
    log_level: str = typer.Option("info", "--log-level", "-l", help="Log level"),
    reload: bool = typer.Option(False, "--reload", help="Enable auto-reload"),
):
    """
    Start the MCP proxy server.

    This proxy enables browser-based applications to connect to MCP servers
    by handling CORS, session management, and transport type conversion.

    Example usage:
        browse-mcp-proxy serve --port 6277 --open
    """
    # Configure logging
    logger.remove()
    logger.add(
        sys.stderr,
        level=log_level.upper(),
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    )

    # Generate or use provided auth token
    token = "" if no_auth else (auth_token or secrets.token_hex(32))
    if no_auth:
        logger.warning("Authentication is DISABLED - this is not recommended!")

    # Create FastAPI app
    fastapi_app = create_app(
        client_port=client_port,
        auth_token=token,
    )

    # Log startup info
    logger.info(f"Starting MCP Proxy Server on http://{host}:{port}")
    if token:
        logger.info(f"Auth token: {token}")

    # Open browser if requested
    if open_browser and token:
        browser_url = f"http://localhost:{client_port}/?MCP_PROXY_AUTH_TOKEN={token}&MCP_PROXY_ADDRESS=http://localhost:{port}"
        logger.info(f"Opening browser: {browser_url}")
        webbrowser.open(browser_url)

    # Run server
    uvicorn.run(
        fastapi_app,
        host=host,
        port=port,
        log_level=log_level.lower(),
        reload=reload,
    )


@app.command()
def token():
    """Generate a new authentication token."""
    new_token = secrets.token_hex(32)
    print(new_token)


@app.command()
def version():
    """Show version information."""
    from . import __version__

    print(f"browse-mcp-proxy version {__version__}")


def main():
    """CLI entry point."""
    app()


if __name__ == "__main__":
    main()
