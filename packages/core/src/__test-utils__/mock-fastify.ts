/**
 * Shared Mock Fastify Utilities
 *
 * Provides reusable mock Fastify instances for route testing.
 * Supports route registration, parameter extraction, and request injection.
 */
import { vi, type Mock } from "vitest";

// =============================================================================
// Types
// =============================================================================

export interface MockRawResponse {
  setHeader: Mock;
  write: Mock;
  end: Mock;
  destroyed: boolean;
}

export interface MockReply {
  code: Mock;
  statusCode: number;
  raw: MockRawResponse;
}

export interface MockRequest {
  body?: unknown;
  params: Record<string, string>;
  query: Record<string, unknown>;
  headers: Record<string, string>;
  raw: {
    on: Mock;
    destroyed: boolean;
  };
}

export interface MockRouteHandler {
  method: string;
  url: string;
  options?: unknown;
  handler: (request: MockRequest, reply: MockReply) => Promise<unknown>;
}

export interface InjectOptions {
  method: string;
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
}

export interface InjectResult {
  statusCode: number;
  body: string;
  json: () => unknown;
  sseMessages: string[];
  rawResponse?: MockRawResponse;
}

export interface MockFastifyInstance {
  get: Mock;
  post: Mock;
  patch: Mock;
  delete: Mock;
  register: Mock;
  hasDecorator: Mock;
  routes: MockRouteHandler[];
  inject: (options: InjectOptions) => Promise<InjectResult>;
}

// =============================================================================
// Route Method Factory
// =============================================================================

/**
 * Create a mock route registration method that handles both:
 * - 2-arg form: (url, handler)
 * - 3-arg form: (url, options, handler)
 */
function createRouteMethod(method: string, routes: MockRouteHandler[]) {
  return vi.fn(
    (
      url: string,
      optionsOrHandler: unknown,
      maybeHandler?: (req: MockRequest, rep: MockReply) => Promise<unknown>
    ) => {
      // If third argument exists, it's the handler and second is options
      // If only two arguments, second is the handler
      const handler =
        maybeHandler ??
        (optionsOrHandler as (req: MockRequest, rep: MockReply) => Promise<unknown>);
      const options = maybeHandler ? optionsOrHandler : undefined;
      routes.push({ method, url, options, handler });
    }
  );
}

// =============================================================================
// URL Matching
// =============================================================================

/**
 * Match a URL against a route pattern and extract parameters
 */
function matchRoute(
  routeUrl: string,
  pathname: string
): { match: boolean; params: Record<string, string> } {
  const routeParts = routeUrl.split("/");
  const urlParts = pathname.split("/");

  if (routeParts.length !== urlParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(":")) {
      params[routeParts[i].slice(1)] = urlParts[i];
    } else if (routeParts[i] !== urlParts[i]) {
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
}

/**
 * Parse query string into typed values
 */
function parseQueryString(queryString: string): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (!queryString) return query;

  queryString.split("&").forEach((param) => {
    const [key, value] = param.split("=");
    const decoded = decodeURIComponent(value);

    // Type conversion
    if (decoded === "true") {
      query[key] = true;
    } else if (decoded === "false") {
      query[key] = false;
    } else if (/^\d+$/.test(decoded)) {
      query[key] = parseInt(decoded, 10);
    } else {
      query[key] = decoded;
    }
  });

  return query;
}

// =============================================================================
// Mock Fastify Factory
// =============================================================================

export interface CreateMockFastifyOptions {
  /** Default value for hasDecorator checks */
  hasWebsocket?: boolean;
}

/**
 * Create a mock Fastify instance for testing routes
 */
export function createMockFastify(
  options: CreateMockFastifyOptions = {}
): MockFastifyInstance {
  const { hasWebsocket = true } = options;
  const routes: MockRouteHandler[] = [];

  const instance: MockFastifyInstance = {
    get: createRouteMethod("GET", routes),
    post: createRouteMethod("POST", routes),
    patch: createRouteMethod("PATCH", routes),
    delete: createRouteMethod("DELETE", routes),
    register: vi.fn(async (pluginFn: (instance: unknown) => Promise<void>) => {
      try {
        await pluginFn(instance);
      } catch (err) {
        // Log but don't throw - allows tests to verify error handling
        console.warn("[MockFastify] Plugin registration error:", err);
      }
    }),
    hasDecorator: vi.fn((name: string) => {
      if (name === "websocketServer") return hasWebsocket;
      return false;
    }),
    routes,

    async inject(opts: InjectOptions): Promise<InjectResult> {
      const { method, url, payload, headers = {} } = opts;
      const [pathname, queryString] = url.split("?");
      const query = parseQueryString(queryString || "");

      // Find matching route
      let matchingRoute: MockRouteHandler | undefined;
      let params: Record<string, string> = {};

      for (const route of routes) {
        if (route.method !== method) continue;

        // Exact match
        if (route.url === pathname) {
          matchingRoute = route;
          break;
        }

        // Parameterized match
        const result = matchRoute(route.url, pathname);
        if (result.match) {
          matchingRoute = route;
          params = result.params;
          break;
        }
      }

      if (!matchingRoute) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Route not found" }),
          json: () => ({ error: "Route not found" }),
          sseMessages: [],
        };
      }

      // Create mock response
      const sseMessages: string[] = [];
      const rawResponse: MockRawResponse = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          sseMessages.push(data);
        }),
        end: vi.fn(),
        destroyed: false,
      };

      const request: MockRequest = {
        body: payload,
        params,
        query,
        headers: { origin: "http://localhost:1420", ...headers },
        raw: {
          on: vi.fn(),
          destroyed: false,
        },
      };

      let statusCode = 200;
      const reply: MockReply = {
        statusCode: 200,
        code: vi.fn((code: number) => {
          statusCode = code;
          reply.statusCode = code;
          return reply;
        }),
        raw: rawResponse,
      };

      try {
        const result = await matchingRoute.handler(request, reply);
        return {
          statusCode,
          body: result ? JSON.stringify(result) : "",
          json: () => result,
          sseMessages,
          rawResponse,
        };
      } catch (error) {
        return {
          statusCode: statusCode === 200 ? 500 : statusCode,
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          json: () => ({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
          sseMessages,
          rawResponse,
        };
      }
    },
  };

  return instance;
}

/**
 * Create a simple mock reply for non-SSE routes
 */
export function createMockReply(): MockReply {
  let statusCode = 200;
  const reply: MockReply = {
    statusCode: 200,
    code: vi.fn((code: number) => {
      statusCode = code;
      reply.statusCode = code;
      return reply;
    }),
    raw: {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      destroyed: false,
    },
  };
  return reply;
}

/**
 * Parse SSE messages from raw write calls
 */
export function parseSSEMessages(
  sseMessages: string[]
): Array<{ type: string; [key: string]: unknown }> {
  return sseMessages
    .filter((msg) => msg.startsWith("data: "))
    .map((msg) => {
      const jsonStr = msg.slice(6).trim();
      const cleanJson = jsonStr.replace(/\n+$/, "");
      return JSON.parse(cleanJson);
    });
}
