/**
 * MCP Inspector Proxy routes
 *
 * Provides HTTP API for proxying connections to MCP servers.
 * Supports stdio, sse, and streamable-http transport types.
 *
 * Based on: https://github.com/modelcontextprotocol/inspector
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { parse as shellParseArgs } from "shell-quote";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { logger as globalLogger } from "../../telemetry";

// Module-level logger
const log = globalLogger.child({ module: "mcp-inspector" });

// MCP SDK imports
import {
  SSEClientTransport,
  SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isJSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import { whichSync } from "../../executors/utils";
import {
  validateOrigin,
  setSecurityHeaders,
} from "../middleware/origin-validation";

// ============================================================================
// Types
// ============================================================================

interface InspectorConfig {
  defaultEnvironment: Record<string, string>;
  defaultCommand: string;
  defaultArgs: string;
  defaultTransport: string;
  defaultServerUrl: string;
}

interface SessionInfo {
  session_id: string;
  transport_type: string;
  created_at: Date;
  server_connected: boolean;
}

// ============================================================================
// State
// ============================================================================

// Web app transports by web app sessionId
const webAppTransports = new Map<string, Transport>();
// Server Transports by web app sessionId
const serverTransports = new Map<string, Transport>();
// For dynamic header updates
const sessionHeaderHolders = new Map<string, { headers: Record<string, string> }>();
// Session metadata
const sessionMetadata = new Map<string, SessionInfo>();

// Auth token - use env var or generate
const sessionToken =
  process.env.MCP_PROXY_AUTH_TOKEN || randomBytes(32).toString("hex");
const authDisabled = !!process.env.DANGEROUSLY_OMIT_AUTH;

// Default environment for stdio transport
const defaultEnvironment: Record<string, string> = {
  ...getDefaultEnvironment(),
  ...(process.env.MCP_ENV_VARS ? JSON.parse(process.env.MCP_ENV_VARS) : {}),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Error handlers for proxy connections
 */
function onClientError(error: Error) {
  log.error({ err: error }, "Error from inspector client");
}

function onServerError(error: Error) {
  const errorCause = (error as any)?.cause;
  if (errorCause && JSON.stringify(errorCause).includes("ECONNREFUSED")) {
    log.error("Connection refused. Is the MCP server running?");
  } else if (error.message && error.message.includes("404")) {
    log.error("Error accessing endpoint (HTTP 404)");
  } else {
    log.error({ err: error }, "Error from MCP server");
  }
}

/**
 * Bidirectional message proxy between client and server
 */
function mcpProxy({
  transportToClient,
  transportToServer,
}: {
  transportToClient: Transport;
  transportToServer: Transport;
}) {
  let transportToClientClosed = false;
  let transportToServerClosed = false;
  let reportedServerSession = false;

  transportToClient.onmessage = (message) => {
    log.debug({ message: JSON.stringify(message).slice(0, 200) }, "Client -> Server message");
    transportToServer.send(message).catch((error) => {
      log.error({ err: error }, "Error sending to server");
      // Send error response back to client if it was a request (has id) and connection is still open
      if (isJSONRPCRequest(message) && !transportToClientClosed) {
        const errorCause = (error as any)?.cause;
        const errorResponse = {
          jsonrpc: "2.0" as const,
          id: message.id,
          error: {
            code: -32001,
            message: errorCause
              ? `${error.message} (cause: ${errorCause})`
              : error.message,
            data: error,
          },
        };
        transportToClient.send(errorResponse).catch(onClientError);
      }
    });
  };

  transportToServer.onmessage = (message) => {
    log.debug({ message: JSON.stringify(message).slice(0, 200) }, "Server -> Client message");
    if (!reportedServerSession) {
      if (transportToServer.sessionId) {
        // Can only report for StreamableHttp
        log.info({ sessionId: transportToServer.sessionId }, "Proxy <-> Server sessionId");
      }
      reportedServerSession = true;
    }
    transportToClient.send(message).catch(onClientError);
  };

  transportToClient.onclose = () => {
    if (transportToServerClosed) {
      return;
    }
    transportToClientClosed = true;
    transportToServer.close().catch(onServerError);
  };

  transportToServer.onclose = () => {
    if (transportToClientClosed) {
      return;
    }
    transportToServerClosed = true;
    transportToClient.close().catch(onClientError);
  };

  transportToClient.onerror = onClientError;
  transportToServer.onerror = onServerError;
}

/**
 * Detect 401 Unauthorized errors from various transport types
 */
function is401Error(error: unknown): boolean {
  if (error instanceof SseError && error.code === 401) return true;
  if (error instanceof StreamableHTTPError && error.code === 401) return true;
  if (
    error instanceof Error &&
    (error.message.includes("HTTP 401") || error.message.includes("(401)"))
  )
    return true;
  return false;
}

/**
 * Get HTTP headers to forward to MCP server
 */
function getHttpHeaders(request: FastifyRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  // Iterate over all headers in the request
  for (const key in request.headers) {
    const lowerKey = key.toLowerCase();

    // Check if the header is one we want to forward
    if (
      lowerKey.startsWith("mcp-") ||
      lowerKey === "authorization" ||
      lowerKey === "last-event-id"
    ) {
      // Exclude the proxy's own authentication header and the Client <-> Proxy session ID header
      if (lowerKey !== "x-mcp-proxy-auth" && lowerKey !== "mcp-session-id") {
        const value = request.headers[key];

        if (typeof value === "string") {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          const lastValue = value.at(-1);
          if (lastValue !== undefined) {
            headers[key] = lastValue;
          }
        }
      }
    }
  }

  // Handle the custom auth header separately
  const customAuthHeaderName = request.headers["x-custom-auth-header"];
  if (typeof customAuthHeaderName === "string") {
    const lowerCaseHeaderName = customAuthHeaderName.toLowerCase();
    const value = request.headers[lowerCaseHeaderName];

    if (typeof value === "string") {
      headers[customAuthHeaderName] = value;
    } else if (Array.isArray(value)) {
      const lastValue = value.at(-1);
      if (lastValue !== undefined) {
        headers[customAuthHeaderName] = lastValue;
      }
    }
  }

  // Handle multiple custom headers (new approach)
  if (request.headers["x-custom-auth-headers"] !== undefined) {
    try {
      const customHeaderNames = JSON.parse(
        request.headers["x-custom-auth-headers"] as string
      ) as string[];
      if (Array.isArray(customHeaderNames)) {
        customHeaderNames.forEach((headerName) => {
          const lowerCaseHeaderName = headerName.toLowerCase();
          if (request.headers[lowerCaseHeaderName] !== undefined) {
            const value = request.headers[lowerCaseHeaderName];
            headers[headerName] = Array.isArray(value)
              ? value[value.length - 1]!
              : (value as string);
          }
        });
      }
    } catch (error) {
      log.warn({ err: error }, "Failed to parse x-custom-auth-headers");
    }
  }
  return headers;
}

/**
 * Updates a headers object in-place, preserving the original Accept header
 */
function updateHeadersInPlace(
  currentHeaders: Record<string, string>,
  newHeaders: Record<string, string>
) {
  // Preserve the Accept header
  const accept = currentHeaders["Accept"];

  // Clear the old headers and apply the new ones
  Object.keys(currentHeaders).forEach((key) => delete currentHeaders[key]);
  Object.assign(currentHeaders, newHeaders);

  // Restore the Accept header
  if (accept) {
    currentHeaders["Accept"] = accept;
  }
}

/**
 * Creates a `fetch` function that merges dynamic session headers
 */
function createCustomFetch(headerHolder: { headers: Record<string, string> }) {
  return async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    // Determine the headers from the original request/init
    const originalHeaders =
      input instanceof Request ? input.headers : init?.headers;

    // Start with our dynamic session headers
    const finalHeaders = new Headers(headerHolder.headers);

    // Merge the SDK's request-specific headers
    new Headers(originalHeaders).forEach((value, key) => {
      finalHeaders.set(key, value);
    });

    // Convert Headers to a plain object
    const headersObject: Record<string, string> = {};
    finalHeaders.forEach((value, key) => {
      headersObject[key] = value;
    });

    const response = await fetch(input, { ...init, headers: headersObject });
    return response;
  };
}

/**
 * Find actual executable path
 */
function findActualExecutable(
  command: string,
  args: string[]
): { cmd: string; args: string[] } {
  // Handle npx specially
  if (command === "npx") {
    const npxPath = whichSync("npx");
    return { cmd: npxPath || command, args };
  }

  // Handle node/bun/deno etc.
  const resolved = whichSync(command);
  return { cmd: resolved || command, args };
}

/**
 * Create transport based on query parameters
 */
async function createTransport(
  request: FastifyRequest<{
    Querystring: {
      transportType?: string;
      command?: string;
      args?: string;
      env?: string;
      url?: string;
    };
  }>
): Promise<{
  transport: Transport;
  headerHolder?: { headers: Record<string, string> };
}> {
  const query = request.query;
  log.debug({ query }, "Query parameters");

  const transportType = query.transportType;

  if (transportType === "stdio") {
    const command = (query.command || "").trim();
    const origArgs = shellParseArgs(query.args || "") as string[];
    const queryEnv = query.env ? JSON.parse(query.env) : {};
    const env = { ...defaultEnvironment, ...process.env, ...queryEnv };

    const { cmd, args } = findActualExecutable(command, origArgs);

    log.info({ command: cmd, args }, "STDIO transport");

    const transport = new StdioClientTransport({
      command: cmd,
      args,
      env,
      stderr: "pipe",
    });

    await transport.start();
    return { transport };
  } else if (transportType === "sse") {
    const url = query.url || "";

    const headers = getHttpHeaders(request);
    headers["Accept"] = "text/event-stream";
    const headerHolder = { headers };

    log.info({ url, headers }, "SSE transport");

    const transport = new SSEClientTransport(new URL(url), {
      eventSourceInit: {
        fetch: createCustomFetch(headerHolder),
      },
      requestInit: {
        headers: headerHolder.headers,
      },
    });
    await transport.start();
    return { transport, headerHolder };
  } else if (transportType === "streamable-http") {
    const headers = getHttpHeaders(request);
    headers["Accept"] = "text/event-stream, application/json";
    const headerHolder = { headers };

    log.info({ url: query.url, headers }, "StreamableHttp transport");

    const transport = new StreamableHTTPClientTransport(
      new URL(query.url || ""),
      {
        fetch: createCustomFetch(headerHolder),
      }
    );
    await transport.start();
    return { transport, headerHolder };
  } else {
    log.error({ transportType }, "Invalid transport type");
    throw new Error("Invalid transport type specified");
  }
}

/**
 * Set CORS headers on raw response
 * Required when using request.raw/reply.raw which bypass Fastify's CORS middleware
 */
function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
  reply.raw.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, X-MCP-Proxy-Auth, MCP-Session-Id, X-Custom-Auth-Header, X-Custom-Auth-Headers, Last-Event-Id, mcp-protocol-version"
  );
  reply.raw.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id, mcp-protocol-version");
  reply.raw.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  // Set security headers for DNS rebinding protection
  setSecurityHeaders(reply);
}

/**
 * Validate origin for DNS rebinding protection
 * Returns false and sends 403 response if origin is not allowed
 */
function checkOrigin(request: FastifyRequest, reply: FastifyReply): boolean {
  return validateOrigin(request, reply);
}

/**
 * Authentication middleware
 */
function checkAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  log.debug({
    authDisabled,
    url: request.url,
    method: request.method,
    headers: Object.keys(request.headers),
  }, "checkAuth called");

  if (authDisabled) {
    log.debug("Auth disabled, allowing request");
    return true;
  }

  const authHeader = request.headers["x-mcp-proxy-auth"];
  const authHeaderValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  log.debug({
    hasAuthHeader: !!authHeader,
    authHeaderValue: authHeaderValue ? `${authHeaderValue.slice(0, 20)}...` : null,
    expectedTokenPrefix: `Bearer ${sessionToken.slice(0, 8)}...`,
  }, "Auth header check");

  if (!authHeaderValue || !authHeaderValue.startsWith("Bearer ")) {
    log.warn("Auth failed: missing or malformed auth header");
    reply.code(401).send({
      error: "Unauthorized",
      message:
        "Authentication required. Use the session token shown in the console when starting the server.",
    });
    return false;
  }

  const providedToken = authHeaderValue.substring(7); // Remove 'Bearer ' prefix
  const expectedToken = sessionToken;

  log.debug({
    providedLength: providedToken.length,
    expectedLength: expectedToken.length,
    providedPrefix: providedToken.slice(0, 8),
    expectedPrefix: expectedToken.slice(0, 8),
    match: providedToken === expectedToken,
  }, "Token comparison");

  // Convert to buffers for timing-safe comparison
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);

  // Check length first to prevent timing attacks
  if (providedBuffer.length !== expectedBuffer.length) {
    log.warn("Auth failed: token length mismatch");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid authentication token.",
    });
    return false;
  }

  // Perform timing-safe comparison
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    log.warn("Auth failed: token mismatch");
    reply.code(401).send({
      error: "Unauthorized",
      message: "Invalid authentication token.",
    });
    return false;
  }

  log.debug("Auth successful");
  return true;
}

/**
 * Get session token (for development/testing)
 */
export function getMcpInspectorSessionToken(): string {
  return sessionToken;
}

/**
 * Check if auth is disabled
 */
export function isMcpInspectorAuthDisabled(): boolean {
  return authDisabled;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register MCP Inspector Proxy routes
 */
export function registerMcpInspectorRoutes(fastify: FastifyInstance): void {
  // Log startup info
  log.info("Registering routes...");
  if (!authDisabled) {
    log.info({ sessionToken }, "Session token generated");
    log.info("Use this token in x-mcp-proxy-auth header or set DANGEROUSLY_OMIT_AUTH=true to disable auth");
  } else {
    log.warn("Authentication is disabled. This is not recommended.");
  }

  // Custom content type parser for MCP Inspector routes
  // Parse JSON and pass the parsed object to handleRequest (like Express does)
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, payload, done) => {
      try {
        const parsed = JSON.parse(payload.toString("utf-8"));
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // ========================================================================
  // Health & Config
  // ========================================================================

  /**
   * Health check
   * GET /api/mcp/inspector/health
   */
  fastify.get("/api/mcp/inspector/health", async () => {
    return {
      status: "ok",
      sessions: webAppTransports.size,
    };
  });

  /**
   * Configuration
   * GET /api/mcp/inspector/config
   */
  fastify.get("/api/mcp/inspector/config", async (request, reply) => {
    if (!checkAuth(request, reply)) return;

    return {
      defaultEnvironment,
      defaultCommand: "",
      defaultArgs: "",
      defaultTransport: "",
      defaultServerUrl: "",
      authRequired: !authDisabled,
    } satisfies InspectorConfig & { authRequired: boolean };
  });

  /**
   * Get session token (dev only)
   * GET /api/mcp/inspector/token
   */
  fastify.get("/api/mcp/inspector/token", async () => {
    if (authDisabled) {
      return { token: null, authDisabled: true };
    }
    return { token: sessionToken, authDisabled: false };
  });

  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * List active sessions
   * GET /api/mcp/inspector/sessions
   */
  fastify.get("/api/mcp/inspector/sessions", async (request, reply) => {
    if (!checkAuth(request, reply)) return;

    const sessions: SessionInfo[] = [];
    for (const [sessionId, metadata] of sessionMetadata) {
      sessions.push(metadata);
    }

    return {
      sessions,
      total: sessions.length,
    };
  });

  /**
   * Close a session
   * DELETE /api/mcp/inspector/sessions/:sessionId
   */
  fastify.delete<{ Params: { sessionId: string } }>(
    "/api/mcp/inspector/sessions/:sessionId",
    async (request, reply) => {
      if (!checkAuth(request, reply)) return;

      const { sessionId } = request.params;

      const webTransport = webAppTransports.get(sessionId);
      const serverTransport = serverTransports.get(sessionId);

      if (!webTransport && !serverTransport) {
        reply.code(404);
        return { error: "Session not found" };
      }

      try {
        if (serverTransport) {
          await serverTransport.close();
        }
        if (webTransport) {
          await webTransport.close();
        }

        webAppTransports.delete(sessionId);
        serverTransports.delete(sessionId);
        sessionHeaderHolders.delete(sessionId);
        sessionMetadata.delete(sessionId);

        return { deleted: sessionId };
      } catch (e) {
        reply.code(500);
        return { error: e instanceof Error ? e.message : "Failed to close session" };
      }
    }
  );

  // ========================================================================
  // StreamableHTTP Transport Proxy (/mcp)
  // ========================================================================

  /**
   * StreamableHTTP GET - Handle SSE stream for existing session
   * GET /api/mcp/inspector/mcp
   */
  fastify.get<{
    Querystring: {
      transportType?: string;
      command?: string;
      args?: string;
      env?: string;
      url?: string;
    };
  }>("/api/mcp/inspector/mcp", async (request, reply) => {
    // Set CORS headers for raw response handling
    setCorsHeaders(request, reply);

    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    const sessionId = request.headers["mcp-session-id"] as string;
    log.debug({ sessionId }, "Received GET message");

    const headerHolder = sessionHeaderHolders.get(sessionId);
    if (headerHolder) {
      updateHeadersInPlace(
        headerHolder.headers as Record<string, string>,
        getHttpHeaders(request)
      );
    }

    try {
      const transport = webAppTransports.get(sessionId) as StreamableHTTPServerTransport;
      if (!transport) {
        reply.code(404);
        return { error: "Session not found" };
      }

      // Handle as raw HTTP for SSE streaming
      await transport.handleRequest(request.raw, reply.raw);
    } catch (error) {
      log.error({ err: error }, "Error in GET /mcp route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });

  /**
   * StreamableHTTP POST - Initialize new session or send message to existing
   * POST /api/mcp/inspector/mcp
   */
  fastify.post<{
    Querystring: {
      transportType?: string;
      command?: string;
      args?: string;
      env?: string;
      url?: string;
    };
  }>("/api/mcp/inspector/mcp", async (request, reply) => {
    // Set CORS headers for raw response handling
    setCorsHeaders(request, reply);

    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    const sessionId = request.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      // Existing session
      log.debug({ sessionId }, "Received POST message");
      const headerHolder = sessionHeaderHolders.get(sessionId);
      if (headerHolder) {
        updateHeadersInPlace(
          headerHolder.headers as Record<string, string>,
          getHttpHeaders(request)
        );
      }

      try {
        const transport = webAppTransports.get(sessionId) as StreamableHTTPServerTransport;
        if (!transport) {
          reply.code(404);
          return { error: "Transport not found for sessionId " + sessionId };
        }

        // Pass body to handleRequest (like Express version)
        await transport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        log.error({ err: error }, "Error in POST /mcp route");
        reply.code(500);
        return { error: error instanceof Error ? error.message : "Internal error" };
      }
    } else {
      // New connection
      log.info("New StreamableHttp connection request");
      try {
        const { transport: serverTransport, headerHolder } = await createTransport(request);

        const webAppTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          onsessioninitialized: (newSessionId) => {
            webAppTransports.set(newSessionId, webAppTransport);
            serverTransports.set(newSessionId, serverTransport);
            if (headerHolder) {
              sessionHeaderHolders.set(newSessionId, headerHolder);
            }
            sessionMetadata.set(newSessionId, {
              session_id: newSessionId,
              transport_type: "streamable-http",
              created_at: new Date(),
              server_connected: true,
            });
            log.info({ sessionId: newSessionId }, "Client <-> Proxy sessionId");
          },
          onsessionclosed: (closedSessionId) => {
            webAppTransports.delete(closedSessionId);
            serverTransports.delete(closedSessionId);
            sessionHeaderHolders.delete(closedSessionId);
            sessionMetadata.delete(closedSessionId);
          },
        });
        log.info("Created StreamableHttp client transport");

        await webAppTransport.start();

        mcpProxy({
          transportToClient: webAppTransport,
          transportToServer: serverTransport,
        });

        // Pass body to handleRequest (like Express version)
        await webAppTransport.handleRequest(request.raw, reply.raw, request.body);
      } catch (error) {
        if (is401Error(error)) {
          log.error({ err: error }, "Received 401 Unauthorized from MCP server");
          reply.code(401);
          return { error: "Unauthorized from MCP server" };
        }
        log.error({ err: error }, "Error in POST /mcp route");
        reply.code(500);
        return { error: error instanceof Error ? error.message : "Internal error" };
      }
    }
  });

  /**
   * StreamableHTTP DELETE - Terminate session
   * DELETE /api/mcp/inspector/mcp
   */
  fastify.delete("/api/mcp/inspector/mcp", async (request, reply) => {
    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    log.debug({ sessionId }, "Received DELETE message");

    if (sessionId) {
      try {
        const serverTransport = serverTransports.get(sessionId) as StreamableHTTPClientTransport;
        if (!serverTransport) {
          reply.code(404);
          return { error: "Transport not found for sessionId " + sessionId };
        }

        await serverTransport.terminateSession();
        await serverTransport.close();
        webAppTransports.delete(sessionId);
        serverTransports.delete(sessionId);
        sessionHeaderHolders.delete(sessionId);
        sessionMetadata.delete(sessionId);
        log.info({ sessionId }, "Transports removed");

        reply.code(200);
        return { deleted: sessionId };
      } catch (error) {
        log.error({ err: error }, "Error in DELETE /mcp route");
        reply.code(500);
        return { error: error instanceof Error ? error.message : "Internal error" };
      }
    }

    reply.code(400);
    return { error: "mcp-session-id header required" };
  });

  // ========================================================================
  // STDIO Transport Proxy (/stdio)
  // ========================================================================

  /**
   * STDIO transport - SSE endpoint
   * GET /api/mcp/inspector/stdio
   */
  fastify.get<{
    Querystring: {
      transportType?: string;
      command?: string;
      args?: string;
      env?: string;
      proxyFullAddress?: string;
    };
  }>("/api/mcp/inspector/stdio", async (request, reply) => {
    // Set CORS headers for raw response handling (SSE)
    setCorsHeaders(request, reply);

    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    try {
      log.info("New STDIO connection request");
      const { transport: serverTransport } = await createTransport(request);

      const proxyFullAddress = request.query.proxyFullAddress || "";
      const prefix = proxyFullAddress || "";
      const endpoint = `${prefix}/api/mcp/inspector/message`;

      const webAppTransport = new SSEServerTransport(endpoint, reply.raw);
      webAppTransports.set(webAppTransport.sessionId, webAppTransport);
      log.info("Created client transport");

      serverTransports.set(webAppTransport.sessionId, serverTransport);
      sessionMetadata.set(webAppTransport.sessionId, {
        session_id: webAppTransport.sessionId,
        transport_type: "stdio",
        created_at: new Date(),
        server_connected: true,
      });
      log.info("Created server transport");

      await webAppTransport.start();

      // Handle stderr from STDIO transport
      const stdioTransport = serverTransport as StdioClientTransport;
      if (stdioTransport.stderr) {
        stdioTransport.stderr.on("data", (chunk: Buffer) => {
          const message = chunk.toString().trim();
          const ucMsg = message.toUpperCase();

          if (message.includes("MODULE_NOT_FOUND")) {
            // Server command not found, remove transports
            webAppTransport.send({
              jsonrpc: "2.0",
              method: "notifications/message",
              params: {
                level: "emergency",
                logger: "proxy",
                data: {
                  message: "Command not found, transports removed",
                },
              },
            });
            webAppTransport.close();
            serverTransport.close();
            webAppTransports.delete(webAppTransport.sessionId);
            serverTransports.delete(webAppTransport.sessionId);
            sessionHeaderHolders.delete(webAppTransport.sessionId);
            sessionMetadata.delete(webAppTransport.sessionId);
            log.error("Command not found, transports removed");
          } else {
            // Determine log level based on content
            let level: string;
            if (ucMsg.includes("DEBUG")) {
              level = "debug";
            } else if (ucMsg.includes("INFO")) {
              level = "info";
            } else if (ucMsg.includes("NOTICE")) {
              level = "notice";
            } else if (ucMsg.includes("WARN")) {
              level = "warning";
            } else if (ucMsg.includes("ERROR")) {
              level = "error";
            } else if (ucMsg.includes("CRITICAL")) {
              level = "critical";
            } else if (ucMsg.includes("ALERT")) {
              level = "alert";
            } else if (ucMsg.includes("EMERGENCY") || ucMsg.includes("SIG")) {
              level = "emergency";
            } else {
              level = "info";
            }

            webAppTransport.send({
              jsonrpc: "2.0",
              method: "notifications/message",
              params: {
                level,
                logger: "stdio",
                data: { message },
              },
            });
          }
        });
      }

      mcpProxy({
        transportToClient: webAppTransport,
        transportToServer: serverTransport,
      });

      // Keep connection open - SSE will handle the response
    } catch (error) {
      if (is401Error(error)) {
        log.error("Received 401 Unauthorized from MCP server");
        reply.code(401);
        return { error: "Unauthorized from MCP server" };
      }
      log.error({ err: error }, "Error in /stdio route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });

  // ========================================================================
  // SSE Transport Proxy (/sse)
  // ========================================================================

  /**
   * SSE transport - POST messages via SSE URL
   * POST /api/mcp/inspector/sse
   *
   * This handles two cases:
   * 1. Message to existing session (has sessionId) - forward to SSE transport
   * 2. New connection attempt (no sessionId, has url) - redirect to GET for proper SSE setup
   *
   * Note: SSE transport requires GET to establish connection. POST is only for messages.
   */
  fastify.post<{
    Querystring: {
      transportType?: string;
      url?: string;
      sessionId?: string;
    };
  }>("/api/mcp/inspector/sse", async (request, reply) => {
    // Set CORS headers
    setCorsHeaders(request, reply);

    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    const sessionId = request.query.sessionId || request.headers["mcp-session-id"] as string;
    log.debug({ sessionId }, "SSE POST received");

    // If no sessionId but has URL, this is a new connection attempt
    // SSE transport requires GET to establish, not POST
    if (!sessionId && request.query.url) {
      log.info("SSE transport requires GET to establish connection. Use streamable-http for POST-based connections.");
      reply.code(400);
      return {
        error: "SSE transport requires GET request to establish connection",
        hint: "Use GET /api/mcp/inspector/sse to establish SSE connection first, then POST to /api/mcp/inspector/message with sessionId. Or use transportType=streamable-http for POST-based connections.",
      };
    }

    if (!sessionId) {
      reply.code(400);
      return { error: "sessionId query parameter or Mcp-Session-Id header required" };
    }

    const headerHolder = sessionHeaderHolders.get(sessionId);
    if (headerHolder) {
      updateHeadersInPlace(
        headerHolder.headers as Record<string, string>,
        getHttpHeaders(request)
      );
    }

    const transport = webAppTransports.get(sessionId) as SSEServerTransport;
    if (!transport) {
      reply.code(404);
      return { error: "Session not found" };
    }

    try {
      await transport.handlePostMessage(request.raw, reply.raw);
    } catch (error) {
      log.error({ err: error }, "Error in POST /sse route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });

  /**
   * SSE transport - SSE endpoint
   * GET /api/mcp/inspector/sse
   */
  fastify.get<{
    Querystring: {
      transportType?: string;
      url?: string;
      proxyFullAddress?: string;
    };
  }>("/api/mcp/inspector/sse", async (request, reply) => {
    // Set CORS headers for raw response handling (SSE)
    setCorsHeaders(request, reply);

    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    try {
      log.info("New SSE connection request. NOTE: The SSE transport is deprecated and has been replaced by StreamableHttp");
      const { transport: serverTransport, headerHolder } = await createTransport(request);

      const proxyFullAddress = request.query.proxyFullAddress || "";
      const prefix = proxyFullAddress || "";
      const endpoint = `${prefix}/api/mcp/inspector/message`;

      const webAppTransport = new SSEServerTransport(endpoint, reply.raw);
      webAppTransports.set(webAppTransport.sessionId, webAppTransport);
      log.info("Created client transport");

      serverTransports.set(webAppTransport.sessionId, serverTransport);
      if (headerHolder) {
        sessionHeaderHolders.set(webAppTransport.sessionId, headerHolder);
      }
      sessionMetadata.set(webAppTransport.sessionId, {
        session_id: webAppTransport.sessionId,
        transport_type: "sse",
        created_at: new Date(),
        server_connected: true,
      });
      log.info("Created server transport");

      await webAppTransport.start();

      mcpProxy({
        transportToClient: webAppTransport,
        transportToServer: serverTransport,
      });

      // Keep connection open - SSE will handle the response
    } catch (error) {
      if (is401Error(error)) {
        log.error("Received 401 Unauthorized from MCP server");
        reply.code(401);
        return { error: "Unauthorized from MCP server" };
      } else if (error instanceof SseError && error.code === 404) {
        log.error("Received 404 from MCP server. Does it support SSE?");
        reply.code(404);
        return { error: "MCP server does not support SSE" };
      } else if (JSON.stringify(error).includes("ECONNREFUSED")) {
        log.error("Connection refused. Is the MCP server running?");
        reply.code(500);
        return { error: "Connection refused" };
      }
      log.error({ err: error }, "Error in /sse route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });

  // ========================================================================
  // Message Endpoint (/message)
  // ========================================================================

  /**
   * Message endpoint for SSE/STDIO transports
   * POST /api/mcp/inspector/message
   */
  fastify.post<{
    Querystring: { sessionId?: string };
  }>("/api/mcp/inspector/message", async (request, reply) => {
    // Set CORS headers for raw response handling
    setCorsHeaders(request, reply);

    // DNS rebinding protection
    if (!checkOrigin(request, reply)) return;

    if (!checkAuth(request, reply)) return;

    try {
      const sessionId = request.query.sessionId;
      log.debug({ sessionId }, "Received POST message");

      if (!sessionId) {
        reply.code(400);
        return { error: "sessionId query parameter required" };
      }

      const headerHolder = sessionHeaderHolders.get(sessionId);
      if (headerHolder) {
        updateHeadersInPlace(
          headerHolder.headers as Record<string, string>,
          getHttpHeaders(request)
        );
      }

      const transport = webAppTransports.get(sessionId) as SSEServerTransport;
      if (!transport) {
        reply.code(404);
        return { error: "Session not found" };
      }

      await transport.handlePostMessage(request.raw, reply.raw);
    } catch (error) {
      log.error({ err: error }, "Error in /message route");
      reply.code(500);
      return { error: error instanceof Error ? error.message : "Internal error" };
    }
  });
}
