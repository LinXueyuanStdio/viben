import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createApiServer } from '../server.js';
import { TokenStore } from '../auth/token-store.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('createApiServer', () => {
  let server: Awaited<ReturnType<typeof createApiServer>> | null = null;
  let tokenStore: TokenStore;
  let tmpDir: string;

  function serverOpts() {
    return {
      port: 0,
      host: '127.0.0.1',
      getSecret: () => 'test-secret',
      getJwtSecret: () => 'test-jwt-secret',
      tokenStore,
    };
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-test-'));
    tokenStore = new TokenStore(path.join(tmpDir, 'tokens.json'));
    await tokenStore.load();
  });

  afterEach(async () => {
    if (server) {
      await server.app.close();
      server = null;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a Fastify instance with CORS and rate limiting', async () => {
    server = await createApiServer(serverOpts());
    expect(server.app).toBeDefined();
    expect(server.app.printRoutes).toBeDefined();
  });

  it('starts and listens on a port', async () => {
    server = await createApiServer(serverOpts());
    const address = await server.start();
    expect(address.port).toBeGreaterThan(0);
  });

  it('registers a plugin without auth and serves it', async () => {
    server = await createApiServer(serverOpts());
    server.registerPlugin('/api/v1/health', async (app) => {
      app.get('/', async () => ({ status: 'ok' }));
    }, { auth: false });
    await server.start();

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('returns 401 on authenticated routes without token', async () => {
    server = await createApiServer(serverOpts());
    // Register a test route with auth
    server.registerPlugin('/api/v1/test', async (app) => {
      app.get('/', async () => ({ ok: true }));
    });
    await server.start();

    const response = await server.app.inject({
      method: 'GET',
      url: '/api/v1/test',
    });

    expect(response.statusCode).toBe(401);
  });

  it('preserves legacy /api system route compatibility', async () => {
    server = await createApiServer(serverOpts());
    server.registerPlugin('/api/v1/system', async (app) => {
      app.get('/health/details', async () => ({ route: 'health-details' }));
      app.get('/version', async () => ({ route: 'version' }));
      app.get('/adapters', async () => ({ route: 'adapters' }));
      app.post('/restart', async () => ({ route: 'restart' }));
    }, { auth: false });
    await server.start();

    for (const { method, from, redirectTo, route } of [
      { method: 'GET', from: '/api/health', redirectTo: '/api/v1/system/health/details', route: 'health-details' },
      { method: 'GET', from: '/api/version', redirectTo: '/api/v1/system/version', route: 'version' },
      { method: 'GET', from: '/api/adapters', redirectTo: '/api/v1/system/adapters', route: 'adapters' },
      { method: 'POST', from: '/api/restart', redirectTo: '/api/v1/system/restart', route: 'restart' },
    ] as const) {
      const redirect = await server.app.inject({ method, url: from });

      expect(redirect.statusCode).toBe(308);
      expect(redirect.headers.location).toBe(redirectTo);

      const target = await server.app.inject({
        method,
        url: redirectTo,
      });

      expect(target.statusCode).toBe(200);
      expect(JSON.parse(target.body)).toEqual({ route });
    }
  });
});
