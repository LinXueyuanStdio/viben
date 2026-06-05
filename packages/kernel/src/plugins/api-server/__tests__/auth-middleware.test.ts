import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createApiServer } from '../server.js';
import { TokenStore } from '../auth/token-store.js';
import { signToken } from '../auth/jwt.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const SECRET = 'a'.repeat(64);
const JWT_SECRET = 'jwt-test-secret-key-for-testing';

describe('auth middleware', () => {
  let server: Awaited<ReturnType<typeof createApiServer>> | null = null;
  let tokenStore: TokenStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-mw-test-'));
    const tokensFile = path.join(tmpDir, 'tokens.json');
    tokenStore = new TokenStore(tokensFile);
    await tokenStore.load();

    server = await createApiServer({
      port: 0,
      host: '127.0.0.1',
      getSecret: () => SECRET,
      getJwtSecret: () => JWT_SECRET,
      tokenStore,
    });

    // Register a test route with auth
    server.registerPlugin('/api/v1/test', async (app) => {
      app.get('/', async (request) => ({
        ok: true,
        auth: request.auth,
      }));
    });

    await server.app.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.app.close();
      server = null;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('authenticates with secret token', async () => {
    const response = await server!.app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${SECRET}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.auth.type).toBe('secret');
    expect(body.auth.role).toBe('admin');
    expect(body.auth.scopes).toEqual(['*']);
  });

  it('authenticates with valid JWT', async () => {
    const stored = tokenStore.create({ role: 'operator', name: 'test-token', expire: '1h' });
    const jwt = signToken(
      { sub: stored.id, role: 'operator', rfd: Date.now() / 1000 + 86400 },
      JWT_SECRET,
      '1h',
    );

    const response = await server!.app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.auth.type).toBe('jwt');
    expect(body.auth.tokenId).toBe(stored.id);
    expect(body.auth.role).toBe('operator');
  });

  it('rejects revoked token with 401', async () => {
    const stored = tokenStore.create({ role: 'viewer', name: 'revoked-token', expire: '1h' });
    const jwt = signToken(
      { sub: stored.id, role: 'viewer', rfd: Date.now() / 1000 + 86400 },
      JWT_SECRET,
      '1h',
    );

    tokenStore.revoke(stored.id);

    const response = await server!.app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.message).toContain('revoked');
  });

  it('returns 401 when no token is provided', async () => {
    const response = await server!.app.inject({
      method: 'GET',
      url: '/api/v1/test',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.message).toContain('Missing');
  });

  it('authenticates via query param token (for SSE)', async () => {
    const response = await server!.app.inject({
      method: 'GET',
      url: `/api/v1/test?token=${SECRET}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.auth.type).toBe('secret');
  });

  it('rejects an invalid token with 401', async () => {
    const response = await server!.app.inject({
      method: 'GET',
      url: '/api/v1/test',
      headers: { authorization: 'Bearer invalid-jwt-token' },
    });

    expect(response.statusCode).toBe(401);
  });
});
