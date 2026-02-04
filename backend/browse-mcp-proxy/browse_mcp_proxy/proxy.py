"""
MCP Proxy Server

This module implements a proxy server that bridges browser clients with MCP servers.
It handles:
- CORS for browser access
- Session ID management
- Transport type conversion (STDIO, SSE, HTTP)
- Authentication token management
"""

import asyncio
import os
import secrets
import subprocess
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, Literal, Optional
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse


# =============================================================================
# Types and Models
# =============================================================================


class ProxyConfig(BaseModel):
    """Configuration for the proxy server."""

    host: str = "127.0.0.1"
    port: int = 6277
    client_port: int = 6274
    auth_token: Optional[str] = None
    allow_origins: list[str] = field(default_factory=list)


class ConnectRequest(BaseModel):
    """Request body for /connect endpoint."""

    url: str
    transport_type: Literal["stdio", "sse", "streamable-http"] = "streamable-http"
    command: Optional[str] = None
    args: Optional[list[str]] = None
    env: Optional[dict[str, str]] = None
    headers: Optional[dict[str, str]] = None


@dataclass
class Session:
    """Represents an active proxy session."""

    id: str
    transport_type: str
    target_url: Optional[str] = None
    process: Optional[subprocess.Popen] = None
    client: Optional[httpx.AsyncClient] = None
    server_session_id: Optional[str] = None
    headers: dict[str, str] = field(default_factory=dict)


# =============================================================================
# Session Manager
# =============================================================================


class SessionManager:
    """Manages proxy sessions between browser clients and MCP servers."""

    def __init__(self):
        self._sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()

    async def create_session(
        self,
        transport_type: str,
        target_url: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Session:
        """Create a new session."""
        async with self._lock:
            session_id = str(uuid4())
            session = Session(
                id=session_id,
                transport_type=transport_type,
                target_url=target_url,
                headers=headers or {},
            )
            self._sessions[session_id] = session
            logger.info(f"Created session {session_id} for {transport_type} transport")
            return session

    async def get_session(self, session_id: str) -> Optional[Session]:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session and cleanup resources."""
        async with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                # Cleanup process if STDIO
                if session.process:
                    try:
                        session.process.terminate()
                        session.process.wait(timeout=5)
                    except Exception as e:
                        logger.warning(f"Error terminating process: {e}")
                        try:
                            session.process.kill()
                        except Exception:
                            pass

                # Cleanup HTTP client
                if session.client:
                    try:
                        await session.client.aclose()
                    except Exception as e:
                        logger.warning(f"Error closing HTTP client: {e}")

                logger.info(f"Deleted session {session_id}")
                return True
            return False

    async def update_session(
        self,
        session_id: str,
        server_session_id: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> Optional[Session]:
        """Update session properties."""
        session = self._sessions.get(session_id)
        if session:
            if server_session_id is not None:
                session.server_session_id = server_session_id
            if headers is not None:
                session.headers.update(headers)
        return session

    def list_sessions(self) -> list[dict[str, Any]]:
        """List all active sessions."""
        return [
            {
                "id": s.id,
                "transport_type": s.transport_type,
                "target_url": s.target_url,
                "has_process": s.process is not None,
                "server_session_id": s.server_session_id,
            }
            for s in self._sessions.values()
        ]


# =============================================================================
# Proxy Application
# =============================================================================


# Global session manager
session_manager = SessionManager()

# Auth token (generated at startup or from env)
_auth_token: str = ""


def get_auth_token() -> str:
    """Get the current auth token."""
    return _auth_token


def set_auth_token(token: str):
    """Set the auth token."""
    global _auth_token
    _auth_token = token


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("MCP Proxy server starting...")
    yield
    # Cleanup all sessions on shutdown
    for session_id in list(session_manager._sessions.keys()):
        await session_manager.delete_session(session_id)
    logger.info("MCP Proxy server stopped")


def create_app(
    client_port: int = 6274,
    auth_token: Optional[str] = None,
    allow_origins: Optional[list[str]] = None,
) -> FastAPI:
    """Create the FastAPI application."""
    app = FastAPI(
        title="MCP Proxy Server",
        description="Proxy server for browser-based MCP Inspector connections",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Set auth token
    token = auth_token or secrets.token_hex(32)
    set_auth_token(token)

    # Configure CORS
    origins = allow_origins or [
        f"http://localhost:{client_port}",
        f"http://127.0.0.1:{client_port}",
        "http://localhost:1420",  # Tauri dev server
        "http://127.0.0.1:1420",
        "tauri://localhost",  # Tauri production
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["mcp-session-id", "x-proxy-session-id"],
    )

    # Register routes
    register_routes(app)

    return app


def register_routes(app: FastAPI):
    """Register all API routes."""

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok"}

    @app.get("/config")
    async def get_config():
        """Get proxy configuration."""
        return {
            "auth_token": get_auth_token(),
            "sessions": session_manager.list_sessions(),
        }

    @app.get("/sessions")
    async def list_sessions():
        """List all active proxy sessions."""
        return {"sessions": session_manager.list_sessions()}

    @app.delete("/sessions/{session_id}")
    async def delete_session(session_id: str):
        """Delete a proxy session."""
        if await session_manager.delete_session(session_id):
            return {"status": "deleted", "session_id": session_id}
        raise HTTPException(status_code=404, detail="Session not found")

    # =========================================================================
    # STDIO Transport Proxy
    # =========================================================================

    @app.get("/stdio")
    async def stdio_proxy(
        request: Request,
        command: str = Query(..., description="Command to execute"),
        args: str = Query("", description="Comma-separated arguments"),
        env: str = Query("", description="Comma-separated KEY=VALUE pairs"),
    ):
        """
        STDIO transport proxy using SSE for bidirectional communication.

        The browser connects via SSE and sends messages as query parameters.
        The proxy spawns the MCP server process and relays messages.
        """
        # Verify auth
        _verify_auth(request)

        # Parse arguments
        cmd_args = [a.strip() for a in args.split(",") if a.strip()] if args else []

        # Parse environment variables
        cmd_env = {}
        if env:
            for pair in env.split(","):
                if "=" in pair:
                    key, value = pair.split("=", 1)
                    cmd_env[key.strip()] = value.strip()

        # Create session
        session = await session_manager.create_session(
            transport_type="stdio",
            target_url=f"stdio://{command}",
        )

        try:
            # Spawn process
            full_cmd = [command] + cmd_args
            process = subprocess.Popen(
                full_cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={**dict(os.environ), **cmd_env},
            )
            session.process = process

            async def event_generator():
                """Generate SSE events from process stdout."""
                try:
                    while True:
                        if process.poll() is not None:
                            break

                        # Read line from stdout
                        if process.stdout is None:
                            break
                        line = await asyncio.get_event_loop().run_in_executor(
                            None, process.stdout.readline
                        )

                        if line:
                            yield {
                                "event": "message",
                                "data": line.decode("utf-8").strip(),
                            }
                        else:
                            await asyncio.sleep(0.01)

                except Exception as e:
                    logger.error(f"STDIO proxy error: {e}")
                    yield {"event": "error", "data": str(e)}
                finally:
                    await session_manager.delete_session(session.id)

            return EventSourceResponse(
                event_generator(),
                headers={"x-proxy-session-id": session.id},
            )

        except Exception as e:
            await session_manager.delete_session(session.id)
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/stdio/{session_id}/message")
    async def stdio_send_message(session_id: str, request: Request):
        """Send a message to a STDIO session."""
        _verify_auth(request)

        session = await session_manager.get_session(session_id)
        if not session or not session.process:
            raise HTTPException(status_code=404, detail="Session not found")

        body = await request.body()
        try:
            if session.process.stdin is None:
                raise HTTPException(status_code=500, detail="Process stdin is not available")
            session.process.stdin.write(body + b"\n")
            session.process.stdin.flush()
            return {"status": "sent"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # =========================================================================
    # SSE Transport Proxy
    # =========================================================================

    @app.get("/sse")
    async def sse_proxy(
        request: Request,
        url: str = Query(..., description="Target MCP server URL"),
    ):
        """
        SSE transport proxy.

        Connects to the target MCP server via SSE and relays events to the browser.
        """
        _verify_auth(request)

        # Extract custom headers
        headers = _extract_custom_headers(request)

        # Create session
        session = await session_manager.create_session(
            transport_type="sse",
            target_url=url,
            headers=headers,
        )

        async def event_generator():
            """Generate SSE events from target server."""
            try:
                async with httpx.AsyncClient() as client:
                    session.client = client

                    async with client.stream(
                        "GET", url, headers=headers, timeout=None
                    ) as response:
                        async for line in response.aiter_lines():
                            if line:
                                # Parse SSE format
                                if line.startswith("data:"):
                                    data = line[5:].strip()
                                    yield {"event": "message", "data": data}
                                elif line.startswith("event:"):
                                    # Handle event type
                                    pass

            except Exception as e:
                logger.error(f"SSE proxy error: {e}")
                yield {"event": "error", "data": str(e)}
            finally:
                await session_manager.delete_session(session.id)

        return EventSourceResponse(
            event_generator(),
            headers={"x-proxy-session-id": session.id},
        )

    @app.post("/sse/{session_id}/message")
    async def sse_send_message(session_id: str, request: Request):
        """Send a message to an SSE session's message endpoint."""
        _verify_auth(request)

        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if not session.target_url:
            raise HTTPException(status_code=400, detail="Session has no target URL")

        # SSE uses a separate message endpoint
        message_url = session.target_url.replace("/sse", "/message")
        body = await request.json()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    message_url,
                    json=body,
                    headers=session.headers,
                )
                return response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # =========================================================================
    # Streamable HTTP Transport Proxy
    # =========================================================================

    @app.api_route("/mcp", methods=["GET", "POST", "DELETE"])
    async def http_proxy(
        request: Request,
        url: str = Query(..., description="Target MCP server URL"),
        transport_type: str = Query(
            "streamable-http", description="Transport type hint"
        ),
    ):
        """
        Streamable HTTP transport proxy.

        Handles all HTTP methods and manages session IDs between browser and server.
        """
        _verify_auth(request)

        # Get or create proxy session from header
        proxy_session_id = request.headers.get("x-proxy-session-id")

        # Extract custom headers (excluding proxy auth)
        headers = _extract_custom_headers(request)

        if request.method == "GET":
            # Initial connection or SSE stream request
            session = await session_manager.create_session(
                transport_type=transport_type,
                target_url=url,
                headers=headers,
            )

            # For GET, return SSE stream
            async def event_generator():
                try:
                    async with httpx.AsyncClient() as client:
                        async with client.stream(
                            "GET", url, headers=headers, timeout=None
                        ) as response:
                            # Capture server session ID
                            server_session = response.headers.get("mcp-session-id")
                            if server_session:
                                await session_manager.update_session(
                                    session.id, server_session_id=server_session
                                )
                                yield {
                                    "event": "session",
                                    "data": f'{{"proxy_session_id": "{session.id}", "server_session_id": "{server_session}"}}',
                                }

                            async for line in response.aiter_lines():
                                if line:
                                    yield {"event": "message", "data": line}

                except Exception as e:
                    logger.error(f"HTTP stream proxy error: {e}")
                    yield {"event": "error", "data": str(e)}
                finally:
                    await session_manager.delete_session(session.id)

            return EventSourceResponse(
                event_generator(),
                headers={"x-proxy-session-id": session.id},
            )

        elif request.method == "POST":
            # JSON-RPC request
            body = await request.json()

            # Get existing session or create new one
            session = None
            if proxy_session_id:
                session = await session_manager.get_session(proxy_session_id)

            if not session:
                session = await session_manager.create_session(
                    transport_type=transport_type,
                    target_url=url,
                    headers=headers,
                )

            # Add server session ID if we have one
            request_headers = {**headers}
            if session.server_session_id:
                request_headers["mcp-session-id"] = session.server_session_id

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        url,
                        json=body,
                        headers=request_headers,
                        timeout=30.0,
                    )

                    # Capture session ID from response
                    server_session = response.headers.get("mcp-session-id")
                    if server_session and server_session != session.server_session_id:
                        await session_manager.update_session(
                            session.id, server_session_id=server_session
                        )

                    # Check content type for streaming response
                    content_type = response.headers.get("content-type", "")

                    if "text/event-stream" in content_type:
                        # Streaming response - relay as SSE
                        async def stream_response():
                            async for line in response.aiter_lines():
                                if line:
                                    yield {"event": "message", "data": line}

                        return EventSourceResponse(
                            stream_response(),
                            headers={
                                "x-proxy-session-id": session.id,
                                "mcp-session-id": server_session or "",
                            },
                        )
                    else:
                        # Regular JSON response
                        return Response(
                            content=response.content,
                            status_code=response.status_code,
                            headers={
                                "x-proxy-session-id": session.id,
                                "mcp-session-id": server_session or "",
                                "content-type": content_type,
                            },
                        )

            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Request timeout")
            except Exception as e:
                logger.error(f"HTTP proxy error: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        elif request.method == "DELETE":
            # Session termination
            if proxy_session_id:
                session = await session_manager.get_session(proxy_session_id)
                if session and session.server_session_id:
                    # Send DELETE to server
                    try:
                        async with httpx.AsyncClient() as client:
                            await client.delete(
                                url,
                                headers={
                                    **headers,
                                    "mcp-session-id": session.server_session_id,
                                },
                            )
                    except Exception as e:
                        logger.warning(f"Error terminating server session: {e}")

                await session_manager.delete_session(proxy_session_id)

            return {"status": "terminated"}


def _verify_auth(request: Request):
    """Verify the proxy authentication token."""
    auth_header = request.headers.get("x-mcp-proxy-auth", "")
    expected = f"Bearer {get_auth_token()}"

    # Use constant-time comparison
    if not secrets.compare_digest(auth_header, expected):
        # Also check if auth is disabled (for development)
        if get_auth_token() != "":
            raise HTTPException(status_code=401, detail="Unauthorized")


def _extract_custom_headers(request: Request) -> dict[str, str]:
    """Extract custom headers to forward to the target server."""
    headers = {}

    # Standard headers to forward
    forward_prefixes = ["mcp-", "authorization", "content-type", "accept"]
    exclude_headers = ["x-mcp-proxy-auth", "x-proxy-session-id", "host"]

    for key, value in request.headers.items():
        key_lower = key.lower()

        # Skip excluded headers
        if key_lower in exclude_headers:
            continue

        # Forward if matches prefix or is in whitelist
        if any(key_lower.startswith(prefix) for prefix in forward_prefixes):
            headers[key] = value

    # Handle custom auth header passthrough
    custom_auth = request.headers.get("x-custom-auth-header")
    if custom_auth:
        # Extract the custom header name and value
        parts = custom_auth.split(":", 1)
        if len(parts) == 2:
            headers[parts[0].strip()] = parts[1].strip()

    return headers
