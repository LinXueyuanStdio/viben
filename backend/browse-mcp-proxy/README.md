# Browse MCP Proxy

A proxy server that enables browser-based applications to connect to MCP (Model Context Protocol) servers. This proxy handles CORS, session management, and transport type conversion.

## Why This Proxy?

Browser-based applications face several challenges when connecting to MCP servers:

1. **CORS Restrictions**: Browsers enforce Same-Origin Policy, preventing direct connections to MCP servers on different origins.

2. **Session Management**: MCP's Streamable HTTP transport requires session IDs that browsers can't automatically manage across requests.

3. **STDIO Transport**: Browser JavaScript cannot spawn local processes, but this proxy can bridge that gap.

## Architecture

```
┌─────────────────┐
│  Browser/Tauri  │  (Inspector UI)
│  Frontend App   │
└────────┬────────┘
         │ 1. HTTP requests (same-origin or CORS-allowed)
         │ 2. X-MCP-Proxy-Auth header for security
         ↓
┌─────────────────┐
│  MCP Proxy      │  (this server)
│  Server         │  ┌──────────────────────┐
│                 │  │ Session Management   │
│  • CORS enabled │  │ proxy_id → server_id │
│  • Auth token   │←→│ • Target URL         │
│  • Transports   │  │ • Custom headers     │
│                 │  └──────────────────────┘
└────────┬────────┘
         │ 3. Forwards requests with proper session handling
         │ 4. Supports STDIO, SSE, and HTTP transports
         ↓
┌─────────────────┐
│  Target MCP     │  (any MCP server)
│  Server         │
└─────────────────┘
```

## Installation

```bash
# Using pip
pip install browse-mcp-proxy

# Using poetry
poetry add browse-mcp-proxy

# From source
cd backend/browse-mcp-proxy
poetry install
```

## Usage

### Start the Proxy Server

```bash
# Basic usage
browse-mcp-proxy serve

# Custom port
browse-mcp-proxy serve --port 6277

# With auto-generated auth token and browser opening
browse-mcp-proxy serve --open

# Disable auth (development only!)
browse-mcp-proxy serve --no-auth

# With custom auth token
browse-mcp-proxy serve --auth-token YOUR_SECRET_TOKEN
```

### Generate Auth Token

```bash
browse-mcp-proxy token
```

## API Endpoints

### Health Check

```
GET /health
Response: {"status": "ok"}
```

### Configuration

```
GET /config
Response: {
  "auth_token": "...",
  "sessions": [...]
}
```

### Sessions

```
GET /sessions
DELETE /sessions/{session_id}
```

### STDIO Transport

```
GET /stdio?command=python&args=-m,browse_mcp&env=KEY=VALUE
POST /stdio/{session_id}/message
```

### SSE Transport

```
GET /sse?url=http://localhost:8000/sse
POST /sse/{session_id}/message
```

### Streamable HTTP Transport

```
GET /mcp?url=http://localhost:8000/mcp
POST /mcp?url=http://localhost:8000/mcp
DELETE /mcp?url=http://localhost:8000/mcp
```

## Headers

### Authentication

All requests must include:
```
X-MCP-Proxy-Auth: Bearer YOUR_AUTH_TOKEN
```

### Session Tracking

The proxy returns a session ID that should be included in subsequent requests:
```
X-Proxy-Session-Id: uuid-string
```

### Custom Headers

To pass custom headers to the target server:
```
X-Custom-Auth-Header: Header-Name: Header-Value
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_PROXY_AUTH_TOKEN` | Authentication token | Random 32-byte hex |

## Integration with Desktop App

In the Tauri desktop app, the proxy can be started alongside the MCP server:

```typescript
// Start proxy
await invoke("start_mcp_proxy", { port: 6277 });

// Connect Inspector to proxy
const proxyUrl = "http://localhost:6277/mcp";
const targetUrl = "http://localhost:8000/mcp";

fetch(`${proxyUrl}?url=${encodeURIComponent(targetUrl)}`, {
  headers: {
    "X-MCP-Proxy-Auth": `Bearer ${authToken}`,
  },
});
```

## Security

- **Auth Token**: Required by default. Disable with `--no-auth` (not recommended for production).
- **CORS**: Configured to allow specific origins (localhost ports by default).
- **Origin Validation**: Prevents DNS rebinding attacks.

## Development

```bash
# Install dependencies
poetry install

# Run with auto-reload
browse-mcp-proxy serve --reload --log-level debug
```

## License

MIT License
