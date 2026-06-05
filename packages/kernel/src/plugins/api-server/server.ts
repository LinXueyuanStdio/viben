import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyRateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { globalErrorHandler } from './middleware/error-handler.js';
import { createAuthPreHandler } from './middleware/auth.js';

export interface ApiServerOptions {
  port: number;
  host: string;
  /** Returns the raw API secret used for full-admin Bearer auth. Fetched lazily so rotation is safe. */
  getSecret: () => string;
  /** Returns the HMAC secret used to sign and verify JWTs. */
  getJwtSecret: () => string;
  tokenStore: import('./auth/token-store.js').TokenStore;
  logger?: boolean;
}

/**
 * The handle returned by `createApiServer`.
 *
 * Route plugins are registered before `start()` is called; Fastify's plugin
 * encapsulation keeps each prefix isolated with its own auth hooks.
 */
export interface ApiServerInstance {
  app: FastifyInstance;
  /** Binds to the configured host/port, auto-incrementing if EADDRINUSE. */
  start(): Promise<{ port: number; host: string }>;
  stop(): Promise<void>;
  /**
   * Registers a Fastify plugin scoped to `prefix`.
   *
   * Auth is applied by default. Pass `{ auth: false }` only for public endpoints
   * (e.g. `/api/v1/system` health, `/api/v1/auth/exchange`).
   */
  registerPlugin(prefix: string, plugin: FastifyPluginAsync, opts?: { auth?: boolean }): void;
}

/**
 * Creates and configures the Fastify HTTP server.
 *
 * Sets up in order: Zod validation, CORS, rate limiting, Swagger docs,
 * backward-compat redirects (`/api/*` → `/api/v1/*`), and the global error handler.
 * Route plugins are registered after this returns via `ApiServerInstance.registerPlugin`.
 */
export async function createApiServer(options: ApiServerOptions): Promise<ApiServerInstance> {
  const app = Fastify({ logger: options.logger ?? false, forceCloseConnections: true });

  // Zod validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS — allow any origin (auth is Bearer token, not cookie-based).
  // Do NOT set Access-Control-Allow-Credentials: credentials mode is not needed
  // for Bearer token auth and reflecting the origin with credentials: true is a
  // well-known CORS misconfiguration that could allow cross-origin credential abuse.
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
    }
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      reply.status(204).send();
    }
  });

  // Plugins
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // When the server is reachable through a tunnel (Cloudflare, ngrok, etc.) all
    // requests arrive from the same tunnel-proxy IP address.  Use the real client IP
    // from well-known forwarded headers so rate limits are enforced per-caller, not
    // per-tunnel.  Only the first value in X-Forwarded-For is taken (the client); the
    // rest may be added by intermediate proxies and must not be trusted for limiting.
    keyGenerator: (request) => {
      // Only trust forwarded headers when binding to localhost (behind tunnel)
      const bindHost = options.host;
      const isBehindProxy = !bindHost || bindHost === '127.0.0.1' || bindHost === 'localhost' || bindHost === '::1';
      if (isBehindProxy) {
        const cfIp = request.headers['cf-connecting-ip'];
        if (cfIp && typeof cfIp === 'string') return cfIp;
        const xff = request.headers['x-forwarded-for'];
        if (xff) {
          const first = (Array.isArray(xff) ? xff[0] : xff).split(',')[0]?.trim();
          if (first) return first;
        }
      }
      return request.ip;
    },
  });
  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Viben API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/api/docs' });

  // Global error handler
  app.setErrorHandler(globalErrorHandler);

  // Backward-compatible redirects: /api/* → /api/v1/*
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;
    if (url.startsWith('/api/') && !url.startsWith('/api/v1/') && !url.startsWith('/api/docs')) {
      const legacySystemRoutes: Record<string, string> = {
        '/api/health': '/api/v1/system/health/details',
        '/api/version': '/api/v1/system/version',
        '/api/restart': '/api/v1/system/restart',
        '/api/adapters': '/api/v1/system/adapters',
      };
      const [pathname, query = ''] = url.split('?', 2);
      const targetPath = legacySystemRoutes[pathname] ?? pathname.replace('/api/', '/api/v1/');
      const newUrl = query ? `${targetPath}?${query}` : targetPath;
      return reply.redirect(newUrl, 308);
    }
  });

  // Auth pre-handler
  const authPreHandler = createAuthPreHandler(options.getSecret, options.getJwtSecret, options.tokenStore);

  // Decorate request with auth object
  app.decorateRequest('auth', null, []);

  // Track whether Fastify has booted — after boot, new routes cannot be added.
  // On dev hot-reload, plugins re-run setup() but their routes from the first
  // load are still active, so duplicate registration is safely skipped.
  let booted = false
  app.addHook('onReady', async () => { booted = true })

  return {
    app,

    registerPlugin(prefix: string, plugin: FastifyPluginAsync, opts?: { auth?: boolean }) {
      if (booted) {
        // Fastify already booted — routes from first load still active, skip
        return
      }
      const wrappedPlugin: FastifyPluginAsync = async (pluginApp, pluginOpts) => {
        // Fastify encapsulation means this hook only applies to routes in this scope,
        // so unauthenticated prefixes (e.g. /exchange) don't accidentally inherit auth.
        if (opts?.auth !== false) {
          pluginApp.addHook('onRequest', authPreHandler);
        }
        await plugin(pluginApp, pluginOpts);
      };
      app.register(wrappedPlugin, { prefix });
    },

    async start() {
      await app.ready();

      // Auto-detect available port: retry +1 until a free port is found
      let port = options.port;

      while (port <= 65535) {
        try {
          const address = await app.listen({ port, host: options.host });
          const url = new URL(address);
          return { port: Number(url.port), host: url.hostname };
        } catch (err: any) {
          if (err?.code === 'EADDRINUSE' && port < 65535) {
            console.log(`[api-server] Port ${port} in use, trying ${port + 1}...`);
            port++;
            continue;
          }
          throw err;
        }
      }
      throw new Error('No available ports found');
    },

    async stop() {
      await app.close();
    },
  };
}
