# API Server Core (Fastify Refactor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Node.js native `http` server in `@viben/api-server` plugin with Fastify, adding structured routing, Zod validation, OpenAPI docs, and a service interface for plugin route extensibility.

**Architecture:** Fastify instance created inside the existing plugin's `setup()` hook, replacing the current `ApiServer` class. Routes organized as Fastify plugins with `/api/v1/` prefix. `ApiServerService` exposed via ServiceRegistry for other plugins to register their own routes. Global error handler provides consistent JSON error format.

**Tech Stack:** Fastify, @fastify/cors, @fastify/swagger, @fastify/swagger-ui, @fastify/rate-limit, fastify-type-provider-zod, Zod (already in project)

**Spec:** [docs/superpowers/specs/2026-03-31-api-server-core-design.md](../specs/2026-03-31-api-server-core-design.md)

---

## File Structure

```
src/plugins/api-server/
  index.ts              — MODIFY: Replace ApiServer instantiation with Fastify server setup
  server.ts             — CREATE: Fastify instance factory, plugin registration, global hooks
  service.ts            — CREATE: ApiServerService implementation (exposed to other plugins)
  middleware/
    error-handler.ts    — CREATE: Global Fastify error handler, ApiError format
    auth.ts             — CREATE: Stub auth preHandler (full implementation in Plan 2)
  schemas/
    common.ts           — CREATE: Shared Zod schemas (pagination, error response, etc.)
    sessions.ts         — CREATE: Session request/response schemas
    agents.ts           — CREATE: Agent request/response schemas
    config.ts           — CREATE: Config request/response schemas
    system.ts           — CREATE: System request/response schemas
    commands.ts         — CREATE: Command request/response schemas
  routes/
    sessions.ts         — REWRITE: Migrate to Fastify plugin with Zod validation
    agents.ts           — REWRITE: Migrate to Fastify plugin
    config.ts           — REWRITE: Migrate to Fastify plugin with Zod validation
    system.ts           — CREATE: Merge health.ts endpoints into Fastify plugin
    commands.ts         — CREATE: New command execution routes
  static-server.ts      — MODIFY: Adapt to Fastify static serving
  api-server.ts         — DELETE: Replaced by server.ts
  router.ts             — DELETE: Replaced by Fastify routing
  sse-manager.ts        — MODIFY: Adapt SSE to work with Fastify (will be further refactored in Plan 3)
  routes/health.ts      — DELETE: Merged into routes/system.ts
  routes/topics.ts      — MODIFY: Migrate to Fastify plugin
  routes/tunnel.ts      — MODIFY: Migrate to Fastify plugin
  routes/agents.ts      — REWRITE: Migrate to Fastify plugin
  routes/notify.ts      — MODIFY: Migrate to Fastify plugin
```

---

## Task 1: Install Fastify Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Fastify and plugins**

```bash
pnpm add fastify @fastify/cors @fastify/swagger @fastify/swagger-ui @fastify/rate-limit fastify-type-provider-zod
```

- [ ] **Step 2: Verify build still compiles**

```bash
pnpm build
```

Expected: Build succeeds with no errors. New dependencies are added but not yet used.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Fastify dependencies for API server refactor"
```

---

## Task 2: Create Error Handler and Common Schemas

**Files:**
- Create: `src/plugins/api-server/middleware/error-handler.ts`
- Create: `src/plugins/api-server/schemas/common.ts`
- Test: `src/plugins/api-server/__tests__/error-handler.test.ts`

- [ ] **Step 1: Write failing tests for error handler**

```typescript
// src/plugins/api-server/__tests__/error-handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { globalErrorHandler, ApiError, NotFoundError, AuthError } from '../middleware/error-handler.js';
import { ZodError, z } from 'zod';

function mockReply() {
  const reply: any = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sent: false,
  };
  return reply;
}

describe('globalErrorHandler', () => {
  it('handles ZodError as 400 VALIDATION_ERROR', () => {
    const schema = z.object({ name: z.string() });
    let zodError: ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodError = e as ZodError;
    }

    const reply = mockReply();
    globalErrorHandler(zodError!, {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        statusCode: 400,
        details: expect.any(Array),
      },
    });
  });

  it('handles NotFoundError as 404', () => {
    const reply = mockReply();
    globalErrorHandler(new NotFoundError('SESSION_NOT_FOUND', 'Session not found'), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
        statusCode: 404,
      },
    });
  });

  it('handles AuthError as 401', () => {
    const reply = mockReply();
    globalErrorHandler(new AuthError('UNAUTHORIZED', 'Invalid token'), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
        statusCode: 401,
      },
    });
  });

  it('handles AuthError with 403 status', () => {
    const reply = mockReply();
    globalErrorHandler(new AuthError('FORBIDDEN', 'Insufficient permissions', 403), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        statusCode: 403,
      },
    });
  });

  it('handles unknown errors as 500 INTERNAL_ERROR', () => {
    const reply = mockReply();
    globalErrorHandler(new Error('something broke'), {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        statusCode: 500,
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/plugins/api-server/__tests__/error-handler.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement error handler**

```typescript
// src/plugins/api-server/middleware/error-handler.ts
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

export class NotFoundError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function globalErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.errors.map((e) => e.message).join(', '),
        statusCode: 400,
        details: error.errors,
      },
    });
    return;
  }

  if (error instanceof NotFoundError) {
    reply.status(404).send({
      error: {
        code: error.code,
        message: error.message,
        statusCode: 404,
      },
    });
    return;
  }

  if (error instanceof AuthError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      },
    });
    return;
  }

  // Unknown error — don't leak details
  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: 500,
    },
  });
}
```

- [ ] **Step 4: Create common schemas**

```typescript
// src/plugins/api-server/schemas/common.ts
import { z } from 'zod';

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export const NameParamSchema = z.object({
  name: z.string().min(1),
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.unknown().optional(),
  }),
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/error-handler.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/middleware/ src/plugins/api-server/schemas/common.ts src/plugins/api-server/__tests__/error-handler.test.ts
git commit -m "feat(api): add global error handler and common Zod schemas"
```

---

## Task 3: Create Auth Middleware Stub

**Files:**
- Create: `src/plugins/api-server/middleware/auth.ts`

This is a stub that will be fully implemented in Plan 2 (Auth System). For now it provides the interface and a simple secret-token check (preserving current behavior).

- [ ] **Step 1: Create auth middleware stub**

```typescript
// src/plugins/api-server/middleware/auth.ts
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { AuthError } from './error-handler.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      type: 'secret' | 'jwt';
      tokenId?: string;
      role: string;
      scopes: string[];
    };
  }
}

export function createAuthPreHandler(getSecret: () => string): preHandlerHookHandler {
  return async function authPreHandler(request: FastifyRequest, _reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const queryToken = (request.query as Record<string, string>)?.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Missing authentication token');
    }

    const secret = getSecret();

    // Secret token check (timing-safe)
    if (token.length === secret.length) {
      const tokenBuf = Buffer.from(token);
      const secretBuf = Buffer.from(secret);
      if (timingSafeEqual(tokenBuf, secretBuf)) {
        request.auth = { type: 'secret', role: 'admin', scopes: ['*'] };
        return;
      }
    }

    // JWT check — stub for Plan 2. For now, reject non-secret tokens.
    // TODO(plan-2): Add JWT verification here
    throw new AuthError('UNAUTHORIZED', 'Invalid authentication token');
  };
}

export function requireScopes(...scopes: string[]): preHandlerHookHandler {
  return async function scopeCheck(request: FastifyRequest, _reply: FastifyReply) {
    const { scopes: userScopes } = request.auth;
    if (userScopes.includes('*')) return;

    const missing = scopes.filter((s) => !userScopes.includes(s));
    if (missing.length > 0) {
      throw new AuthError('FORBIDDEN', `Missing scopes: ${missing.join(', ')}`, 403);
    }
  };
}

export function requireRole(role: string): preHandlerHookHandler {
  const roleHierarchy: Record<string, number> = { viewer: 0, operator: 1, admin: 2 };

  return async function roleCheck(request: FastifyRequest, _reply: FastifyReply) {
    const userLevel = roleHierarchy[request.auth.role] ?? -1;
    const requiredLevel = roleHierarchy[role] ?? 999;

    if (userLevel < requiredLevel) {
      throw new AuthError('FORBIDDEN', `Requires ${role} role`, 403);
    }
  };
}
```

- [ ] **Step 2: Verify build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/api-server/middleware/auth.ts
git commit -m "feat(api): add auth middleware stub with secret token support"
```

---

## Task 4: Create Fastify Server Factory

**Files:**
- Create: `src/plugins/api-server/server.ts`
- Test: `src/plugins/api-server/__tests__/server.test.ts`

- [ ] **Step 1: Write failing test for server creation**

```typescript
// src/plugins/api-server/__tests__/server.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { createApiServer } from '../server.js';

describe('createApiServer', () => {
  let server: Awaited<ReturnType<typeof createApiServer>> | null = null;

  afterEach(async () => {
    if (server) {
      await server.app.close();
      server = null;
    }
  });

  it('creates a Fastify instance with CORS and rate limiting', async () => {
    server = await createApiServer({ port: 0, host: '127.0.0.1', getSecret: () => 'test-secret' });

    expect(server.app).toBeDefined();
    expect(server.app.printRoutes).toBeDefined(); // Fastify instance method
  });

  it('starts and listens on a port', async () => {
    server = await createApiServer({ port: 0, host: '127.0.0.1', getSecret: () => 'test-secret' });
    const address = await server.start();

    expect(address.port).toBeGreaterThan(0);
  });

  it('registers health endpoint without auth', async () => {
    server = await createApiServer({ port: 0, host: '127.0.0.1', getSecret: () => 'test-secret' });
    await server.start();

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/v1/system/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('returns 401 on authenticated routes without token', async () => {
    server = await createApiServer({ port: 0, host: '127.0.0.1', getSecret: () => 'test-secret' });
    await server.start();

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/v1/sessions',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns consistent error format on 404', async () => {
    server = await createApiServer({ port: 0, host: '127.0.0.1', getSecret: () => 'test-secret' });
    await server.start();

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/v1/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/plugins/api-server/__tests__/server.test.ts
```

Expected: FAIL — `createApiServer` not found.

- [ ] **Step 3: Implement server factory**

```typescript
// src/plugins/api-server/server.ts
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyRateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { globalErrorHandler } from './middleware/error-handler.js';
import { createAuthPreHandler, requireScopes, requireRole } from './middleware/auth.js';

export interface ApiServerOptions {
  port: number;
  host: string;
  getSecret: () => string;
  logger?: boolean;
}

export interface ApiServerInstance {
  app: FastifyInstance;
  start(): Promise<{ port: number; host: string }>;
  stop(): Promise<void>;
  registerPlugin(prefix: string, plugin: FastifyPluginAsync, opts?: { auth?: boolean }): void;
}

export async function createApiServer(options: ApiServerOptions): Promise<ApiServerInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  // Zod validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyRateLimit, { max: 100, timeWindow: '1 minute' });
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

  // Auth pre-handler (available for decoration)
  const authPreHandler = createAuthPreHandler(options.getSecret);

  // Decorate request with auth object
  app.decorateRequest('auth', null);

  // System routes (no auth required for health)
  await app.register(
    async (app) => {
      app.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      }));

      app.get('/version', { preHandler: authPreHandler }, async () => ({
        version: process.env.npm_package_version ?? 'unknown',
      }));
    },
    { prefix: '/api/v1/system' },
  );

  // Placeholder for route registration — routes are added by plugin index.ts
  // after creating the server with core dependencies available

  const registeredPlugins: Array<{ prefix: string; plugin: FastifyPluginAsync }> = [];

  return {
    app,

    registerPlugin(prefix: string, plugin: FastifyPluginAsync, opts?: { auth?: boolean }) {
      const wrappedPlugin: FastifyPluginAsync = async (pluginApp) => {
        if (opts?.auth !== false) {
          pluginApp.addHook('onRequest', authPreHandler);
        }
        await plugin(pluginApp);
      };
      registeredPlugins.push({ prefix, plugin: wrappedPlugin });
      // If app is already started, register immediately
      app.register(wrappedPlugin, { prefix });
    },

    async start() {
      await app.ready();
      const address = await app.listen({ port: options.port, host: options.host });
      const url = new URL(address);
      return { port: Number(url.port), host: url.hostname };
    },

    async stop() {
      await app.close();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/server.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/api-server/server.ts src/plugins/api-server/__tests__/server.test.ts
git commit -m "feat(api): create Fastify server factory with CORS, rate limiting, and OpenAPI"
```

---

## Task 5: Create ApiServerService

**Files:**
- Create: `src/plugins/api-server/service.ts`

- [ ] **Step 1: Implement ApiServerService**

```typescript
// src/plugins/api-server/service.ts
import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { ApiServerInstance } from './server.js';
import { requireScopes, requireRole } from './middleware/auth.js';

export interface ApiServerService {
  registerPlugin(prefix: string, plugin: FastifyPluginAsync, opts?: { auth?: boolean }): void;
  authPreHandler: preHandlerHookHandler;
  requireScopes(...scopes: string[]): preHandlerHookHandler;
  requireRole(role: string): preHandlerHookHandler;
  getPort(): number;
  getBaseUrl(): string;
  getTunnelUrl(): string | null;
}

export function createApiServerService(
  server: ApiServerInstance,
  getPort: () => number,
  getBaseUrl: () => string,
  getTunnelUrl: () => string | null,
  authPreHandler: preHandlerHookHandler,
): ApiServerService {
  return {
    registerPlugin: server.registerPlugin.bind(server),
    authPreHandler,
    requireScopes,
    requireRole,
    getPort,
    getBaseUrl,
    getTunnelUrl,
  };
}
```

- [ ] **Step 2: Verify build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/api-server/service.ts
git commit -m "feat(api): add ApiServerService interface for plugin route registration"
```

---

## Task 6: Create Zod Schemas for Routes

**Files:**
- Create: `src/plugins/api-server/schemas/sessions.ts`
- Create: `src/plugins/api-server/schemas/agents.ts`
- Create: `src/plugins/api-server/schemas/config.ts`
- Create: `src/plugins/api-server/schemas/system.ts`
- Create: `src/plugins/api-server/schemas/commands.ts`

- [ ] **Step 1: Create session schemas**

```typescript
// src/plugins/api-server/schemas/sessions.ts
import { z } from 'zod';

export const ListSessionsQuerySchema = z.object({
  status: z.enum(['initializing', 'active', 'finished', 'cancelled', 'error']).optional(),
  agentName: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CreateSessionBodySchema = z.object({
  agentName: z.string().min(1),
  workingDirectory: z.string().optional(),
});

export const PromptBodySchema = z.object({
  message: z.string().min(1),
});

export const PermissionResponseBodySchema = z.object({
  requestId: z.string().min(1),
  optionId: z.string().min(1),
});

export const UpdateSessionBodySchema = z.object({
  agentName: z.string().optional(),
  voiceMode: z.boolean().optional(),
  dangerousMode: z.boolean().optional(),
});
```

- [ ] **Step 2: Create agent schemas**

```typescript
// src/plugins/api-server/schemas/agents.ts
import { z } from 'zod';

export const AgentResponseSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
});
```

- [ ] **Step 3: Create config schemas**

```typescript
// src/plugins/api-server/schemas/config.ts
import { z } from 'zod';

export const UpdateConfigBodySchema = z.record(z.string(), z.unknown());
```

- [ ] **Step 4: Create system schemas**

```typescript
// src/plugins/api-server/schemas/system.ts
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
  memory: z.object({
    rss: z.number(),
    heapTotal: z.number(),
    heapUsed: z.number(),
    external: z.number(),
  }),
});
```

- [ ] **Step 5: Create command schemas**

```typescript
// src/plugins/api-server/schemas/commands.ts
import { z } from 'zod';

export const ExecuteCommandBodySchema = z.object({
  command: z.string().min(1),
  sessionId: z.string().optional(),
});
```

- [ ] **Step 6: Verify build compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/plugins/api-server/schemas/
git commit -m "feat(api): add Zod schemas for all API route validation"
```

---

## Task 7: Migrate Session Routes to Fastify

**Files:**
- Rewrite: `src/plugins/api-server/routes/sessions.ts`
- Test: `src/plugins/api-server/__tests__/routes-sessions.test.ts`

This is the largest route file (346 lines). Migrate all session endpoints to Fastify plugin format with Zod validation.

- [ ] **Step 1: Write integration tests for session routes**

Write tests using `app.inject()` (Fastify's test helper) that verify:
- `GET /api/v1/sessions` returns session list
- `GET /api/v1/sessions/:id` returns session detail or 404
- `POST /api/v1/sessions` creates a session
- `DELETE /api/v1/sessions/:id` cancels a session
- `POST /api/v1/sessions/:id/prompt` enqueues a prompt
- `POST /api/v1/sessions/:id/permission` resolves a permission
- `PATCH /api/v1/sessions/:id` updates session settings

Tests should mock `VibenCore` (sessions, agents) at the boundary and test the Fastify route logic. Use `app.inject()` with auth headers.

```typescript
// src/plugins/api-server/__tests__/routes-sessions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { sessionRoutes } from '../routes/sessions.js';
import type { RouteDeps } from '../routes/types.js';

function createMockDeps(): RouteDeps {
  return {
    core: {
      sessionManager: {
        listSessions: vi.fn().mockReturnValue([
          { id: 'sess-1', agentName: 'claude', status: 'active', createdAt: new Date() },
        ]),
        getSession: vi.fn().mockImplementation((id: string) => {
          if (id === 'sess-1') return { id: 'sess-1', agentName: 'claude', status: 'active', createdAt: new Date(), promptCount: 3 };
          return undefined;
        }),
      },
      createSession: vi.fn().mockResolvedValue({ id: 'sess-new', agentName: 'claude', status: 'initializing' }),
      cancelSession: vi.fn().mockResolvedValue(undefined),
    } as any,
  };
}

describe('session routes', () => {
  let app: ReturnType<typeof Fastify>;
  let deps: RouteDeps;

  beforeEach(async () => {
    app = Fastify();
    deps = createMockDeps();
    // Skip auth for route tests — auth is tested separately
    app.decorateRequest('auth', { type: 'secret', role: 'admin', scopes: ['*'] });
    await app.register((a) => sessionRoutes(a, deps), { prefix: '/api/v1/sessions' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / returns session list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].id).toBe('sess-1');
  });

  it('GET /:id returns session detail', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions/sess-1' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('sess-1');
  });

  it('GET /:id returns 404 for unknown session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions/unknown' });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/plugins/api-server/__tests__/routes-sessions.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create route types file**

```typescript
// src/plugins/api-server/routes/types.ts
import type { VibenCore } from '../../../core/core.js';

export interface RouteDeps {
  core: VibenCore;
}
```

- [ ] **Step 4: Implement session routes as Fastify plugin**

Migrate the existing logic from `src/plugins/api-server/routes/sessions.ts` (current 346 lines) into a Fastify plugin function. Key changes:
- Replace `(req, res, params) => ...` handlers with Fastify route definitions
- Use Zod schemas for request validation
- Use `reply.send()` instead of manual `sendJson()`
- Use `request.params`, `request.body`, `request.query` (typed by Zod)
- Throw `NotFoundError` instead of manual 404 responses

```typescript
// src/plugins/api-server/routes/sessions.ts
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { NotFoundError } from '../middleware/error-handler.js';
import {
  ListSessionsQuerySchema,
  CreateSessionBodySchema,
  PromptBodySchema,
  PermissionResponseBodySchema,
  UpdateSessionBodySchema,
} from '../schemas/sessions.js';
import { IdParamSchema } from '../schemas/common.js';

export async function sessionRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { core } = deps;

  // GET / — list sessions
  app.get('/', async (request) => {
    const query = ListSessionsQuerySchema.parse(request.query);
    let sessions = core.sessionManager.listSessions();

    if (query.status) {
      sessions = sessions.filter((s: any) => s.status === query.status);
    }
    if (query.agentName) {
      sessions = sessions.filter((s: any) => s.agentName === query.agentName);
    }

    const total = sessions.length;
    const paged = sessions.slice(query.offset, query.offset + query.limit);

    return { sessions: paged, total, limit: query.limit, offset: query.offset };
  });

  // GET /:id — session detail
  app.get('/:id', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    return session;
  });

  // POST / — create session
  app.post('/', async (request, reply) => {
    const body = CreateSessionBodySchema.parse(request.body);
    const session = await core.createSession(body.agentName, body.workingDirectory);
    return reply.status(201).send(session);
  });

  // DELETE /:id — cancel session
  app.delete('/:id', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    await session.cancel();
    return { success: true };
  });

  // POST /:id/prompt — enqueue prompt
  app.post('/:id/prompt', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const { message } = PromptBodySchema.parse(request.body);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    await session.enqueuePrompt(message);
    return { success: true, sessionId: id };
  });

  // POST /:id/permission — resolve permission request
  app.post('/:id/permission', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const { requestId, optionId } = PermissionResponseBodySchema.parse(request.body);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }
    session.resolvePermission(requestId, optionId);
    return { success: true };
  });

  // PATCH /:id — update session settings
  app.patch('/:id', async (request) => {
    const { id } = IdParamSchema.parse(request.params);
    const body = UpdateSessionBodySchema.parse(request.body);
    const session = core.sessionManager.getSession(id);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', `Session ${id} not found`);
    }

    if (body.agentName !== undefined) {
      await session.switchAgent(body.agentName);
    }
    if (body.voiceMode !== undefined) {
      session.voiceMode = body.voiceMode;
    }
    if (body.dangerousMode !== undefined) {
      session.dangerousMode = body.dangerousMode;
    }

    return { success: true, sessionId: id };
  });
}
```

Note: The exact method names on `session` (e.g., `enqueuePrompt`, `cancel`, `switchAgent`, `resolvePermission`, `voiceMode`, `dangerousMode`) must match the current Session class API. The implementing agent should read `src/core/sessions/session.ts` to verify exact method signatures before writing the final code.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- src/plugins/api-server/__tests__/routes-sessions.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/api-server/routes/sessions.ts src/plugins/api-server/routes/types.ts src/plugins/api-server/__tests__/routes-sessions.test.ts
git commit -m "feat(api): migrate session routes to Fastify with Zod validation"
```

---

## Task 8: Migrate Remaining Routes to Fastify

**Files:**
- Rewrite: `src/plugins/api-server/routes/agents.ts`
- Rewrite: `src/plugins/api-server/routes/config.ts`
- Create: `src/plugins/api-server/routes/commands.ts`
- Rewrite: `src/plugins/api-server/routes/topics.ts`
- Rewrite: `src/plugins/api-server/routes/tunnel.ts`
- Rewrite: `src/plugins/api-server/routes/notify.ts`
- Delete: `src/plugins/api-server/routes/health.ts` (merged into server.ts system routes)

- [ ] **Step 1: Migrate agents routes**

Follow the same Fastify plugin pattern as session routes. Read current `routes/agents.ts` (15 lines) and convert. Single `GET /` endpoint returning agent catalog.

```typescript
// src/plugins/api-server/routes/agents.ts
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { NameParamSchema } from '../schemas/common.js';
import { NotFoundError } from '../middleware/error-handler.js';

export async function agentRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { core } = deps;

  app.get('/', async () => {
    const agents = core.agentCatalog.list();
    return { agents };
  });

  app.get('/:name', async (request) => {
    const { name } = NameParamSchema.parse(request.params);
    const agent = core.agentCatalog.get(name);
    if (!agent) {
      throw new NotFoundError('AGENT_NOT_FOUND', `Agent ${name} not found`);
    }
    return agent;
  });
}
```

- [ ] **Step 2: Migrate config routes**

Read current `routes/config.ts` (157 lines) and convert. Preserve redaction logic for non-admin users, safe-field restrictions for PATCH.

```typescript
// src/plugins/api-server/routes/config.ts
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { UpdateConfigBodySchema } from '../schemas/config.js';

export async function configRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { core } = deps;

  app.get('/', async (request) => {
    const config = core.configManager.getConfig();
    // Redact sensitive fields for non-admin
    if (request.auth.role !== 'admin' && request.auth.type !== 'secret') {
      return core.configManager.getRedactedConfig();
    }
    return config;
  });

  app.patch('/', async (request) => {
    const updates = UpdateConfigBodySchema.parse(request.body);
    await core.configManager.updateSafeFields(updates);
    return { success: true };
  });

  app.get('/schema', async () => {
    return core.configManager.getJsonSchema();
  });
}
```

Note: The implementing agent must read `src/core/config/config.ts` to verify exact method names (`getConfig`, `getRedactedConfig`, `updateSafeFields`, `getJsonSchema`). These may differ from the above — adjust accordingly.

- [ ] **Step 3: Create commands routes**

New route — execute chat commands via API.

```typescript
// src/plugins/api-server/routes/commands.ts
import type { FastifyInstance } from 'fastify';
import type { RouteDeps } from './types.js';
import { ExecuteCommandBodySchema } from '../schemas/commands.js';

export async function commandRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { core } = deps;

  app.get('/', async () => {
    const commands = core.commandRegistry.getAll();
    return {
      commands: commands.map((cmd: any) => ({
        name: cmd.name,
        description: cmd.description,
        usage: cmd.usage,
        category: cmd.category,
        pluginName: cmd.pluginName,
      })),
    };
  });

  app.post('/execute', async (request) => {
    const { command, sessionId } = ExecuteCommandBodySchema.parse(request.body);
    const result = await core.commandRegistry.execute(command, {
      sessionId: sessionId ?? null,
      channelId: 'api',
      userId: request.auth.tokenId ?? 'secret',
      reply: async () => {},
    });
    return { result: result ?? { type: 'silent' } };
  });
}
```

Note: The implementing agent must verify `commandRegistry.execute()` signature and `CommandArgs` interface against `src/core/command-registry.ts`.

- [ ] **Step 4: Migrate topics, tunnel, notify routes**

Convert each existing route file to Fastify plugin pattern. These are smaller (30-82 lines each). Follow the same pattern: read current file → convert handlers → use Zod params → throw NotFoundError for missing resources.

- [ ] **Step 5: Delete old health.ts (merged into server.ts system routes)**

```bash
rm src/plugins/api-server/routes/health.ts
```

- [ ] **Step 6: Verify build compiles**

```bash
pnpm build
```

- [ ] **Step 7: Run all tests**

```bash
pnpm test -- src/plugins/api-server/
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/plugins/api-server/routes/
git commit -m "feat(api): migrate all routes to Fastify plugins with Zod validation"
```

---

## Task 9: Adapt SSE Manager for Fastify

**Files:**
- Modify: `src/plugins/api-server/sse-manager.ts`

Minimal adaptation — keep SSE logic working with Fastify's raw request/response. This will be further refactored in Plan 3 (SSE Adapter).

- [ ] **Step 1: Update SSE manager to work with Fastify**

Key changes:
- SSE endpoint registered as a Fastify route that takes over the raw response
- Use `reply.raw` to access Node.js `ServerResponse` for SSE streaming
- Use `reply.hijack()` to tell Fastify not to manage the response

```typescript
// Update sse-manager.ts to export a Fastify route handler
export function createSSERoute(sseManager: SSEManager) {
  return async function sseHandler(request: FastifyRequest, reply: FastifyReply) {
    reply.hijack(); // Take over response from Fastify
    const res = reply.raw;
    sseManager.handleRequest(request.raw, res);
  };
}
```

- [ ] **Step 2: Verify SSE still works with manual test**

Start the server and test SSE with curl:
```bash
curl -H "Authorization: Bearer <secret>" http://localhost:<port>/api/v1/events
```

Expected: SSE stream opens, heartbeat events arrive every 30s.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/api-server/sse-manager.ts
git commit -m "refactor(api): adapt SSE manager for Fastify raw response"
```

---

## Task 10: Wire Everything in Plugin Index

**Files:**
- Rewrite: `src/plugins/api-server/index.ts`
- Delete: `src/plugins/api-server/api-server.ts`
- Delete: `src/plugins/api-server/router.ts`

- [ ] **Step 1: Rewrite plugin index.ts**

Replace `ApiServer` instantiation with `createApiServer()` + route registration + service registration.

Key flow in `setup()`:
1. Create Fastify server via `createApiServer()`
2. Register all route plugins with core dependencies
3. Register `ApiServerService` in ServiceRegistry
4. Start server
5. Write port file and secret file (preserve existing logic)

```typescript
// src/plugins/api-server/index.ts — setup hook outline
async setup(ctx) {
  const config = ctx.pluginConfig;
  const core = ctx.kernel.core;
  const secretFilePath = ctx.kernel.instanceContext.paths.apiSecret;
  const portFilePath = ctx.kernel.instanceContext.paths.apiPort;

  // Load or create secret
  const secret = await loadOrCreateSecret(secretFilePath);

  // Create Fastify server
  const server = await createApiServer({
    port: config.port ?? 0,
    host: config.host ?? '127.0.0.1',
    getSecret: () => secret,
  });

  const deps: RouteDeps = { core };

  // Register routes
  server.app.register((a) => sessionRoutes(a, deps), { prefix: '/api/v1/sessions' });
  server.app.register((a) => agentRoutes(a, deps), { prefix: '/api/v1/agents' });
  server.app.register((a) => configRoutes(a, deps), { prefix: '/api/v1/config' });
  server.app.register((a) => commandRoutes(a, deps), { prefix: '/api/v1/commands' });
  // ... etc

  // Auth on all /api/v1/ routes except system/health
  server.app.addHook('onRequest', createAuthPreHandler(() => secret));

  // Register service for other plugins
  ctx.registerService('api-server', createApiServerService(server, ...));

  // Start
  const { port } = await server.start();
  await writeFile(portFilePath, String(port));

  // Teardown
  ctx.onTeardown(async () => {
    await server.stop();
    await rm(portFilePath, { force: true });
  });
}
```

Note: The implementing agent must read the current `index.ts` (125 lines) to preserve install/configure/uninstall hooks and any event listeners (e.g., `system:ready`).

- [ ] **Step 2: Delete old files**

```bash
rm src/plugins/api-server/api-server.ts
rm src/plugins/api-server/router.ts
```

- [ ] **Step 3: Update static server for Fastify**

Adapt `static-server.ts` to register as a Fastify plugin:
- Use `reply.raw` for streaming static files
- Or use `@fastify/static` if simpler

- [ ] **Step 4: Verify full build**

```bash
pnpm build
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All tests pass, no regressions.

- [ ] **Step 6: Manual smoke test**

```bash
pnpm start
# In another terminal:
curl http://localhost:<port>/api/v1/system/health
curl -H "Authorization: Bearer <secret>" http://localhost:<port>/api/v1/sessions
curl http://localhost:<port>/api/docs  # Swagger UI
```

Expected: Health returns 200, sessions returns list, Swagger UI loads.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): complete Fastify migration, wire all routes and services"
```

---

## Task 11: Add Backward-Compatible Redirects

**Files:**
- Modify: `src/plugins/api-server/server.ts`

- [ ] **Step 1: Add redirect from old paths to new**

```typescript
// In server.ts, add before route registration:
app.addHook('onRequest', async (request, reply) => {
  const url = request.url;
  // Redirect /api/<path> to /api/v1/<path> (excluding /api/v1/ and /api/docs)
  if (url.startsWith('/api/') && !url.startsWith('/api/v1/') && !url.startsWith('/api/docs')) {
    const newUrl = url.replace('/api/', '/api/v1/');
    return reply.redirect(301, newUrl);
  }
});
```

- [ ] **Step 2: Test redirect**

```bash
curl -v http://localhost:<port>/api/health
```

Expected: 301 redirect to `/api/v1/system/health`.

- [ ] **Step 3: Commit**

```bash
git add src/plugins/api-server/server.ts
git commit -m "feat(api): add backward-compatible redirects from /api/ to /api/v1/"
```
