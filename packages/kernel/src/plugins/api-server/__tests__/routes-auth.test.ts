import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createApiServer } from '../server.js';
import { TokenStore } from '../auth/token-store.js';
import { authRoutes } from '../routes/auth.js';
import { signToken } from '../auth/jwt.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const SECRET = 'a'.repeat(64);
const JWT_SECRET = 'jwt-test-secret-key-for-routes';

describe('auth routes', () => {
  let server: Awaited<ReturnType<typeof createApiServer>> | null = null;
  let tokenStore: TokenStore;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-routes-test-'));
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

    server.registerPlugin('/api/v1/auth', async (app) => {
      await authRoutes(app, { tokenStore, getJwtSecret: () => JWT_SECRET });
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

  function authHeaders() {
    return { authorization: `Bearer ${SECRET}` };
  }

  describe('POST /api/v1/auth/tokens', () => {
    it('creates a token and returns JWT', async () => {
      const response = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: authHeaders(),
        payload: { role: 'operator', name: 'my-token', expire: '2h' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tokenId).toMatch(/^tok_/);
      expect(body.accessToken).toBeTruthy();
      expect(body.expiresAt).toBeTruthy();
      expect(body.refreshDeadline).toBeTruthy();
    });

    it('rejects non-admin JWT users', async () => {
      // Create a viewer token first
      const stored = tokenStore.create({ role: 'viewer', name: 'viewer-tok', expire: '1h' });
      const jwt = signToken(
        { sub: stored.id, role: 'viewer', rfd: Date.now() / 1000 + 86400 },
        JWT_SECRET,
        '1h',
      );

      const response = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: { authorization: `Bearer ${jwt}` },
        payload: { role: 'viewer', name: 'should-fail' },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/auth/tokens', () => {
    it('lists active tokens', async () => {
      tokenStore.create({ role: 'operator', name: 'tok-1', expire: '1h' });
      tokenStore.create({ role: 'viewer', name: 'tok-2', expire: '1h' });

      const response = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/auth/tokens',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tokens).toHaveLength(2);
      expect(body.tokens[0].name).toBe('tok-1');
    });
  });

  describe('DELETE /api/v1/auth/tokens/:id', () => {
    it('revokes a token', async () => {
      const stored = tokenStore.create({ role: 'operator', name: 'to-revoke', expire: '1h' });

      const response = await server!.app.inject({
        method: 'DELETE',
        url: `/api/v1/auth/tokens/${stored.id}`,
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.revoked).toBe(true);

      // Verify it's gone from the list
      const listRes = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/auth/tokens',
        headers: authHeaders(),
      });
      const listBody = JSON.parse(listRes.body);
      expect(listBody.tokens).toHaveLength(0);
    });

    it('returns 404 for unknown token', async () => {
      const response = await server!.app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/tokens/tok_nonexistent',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('refreshes an expired-like JWT within deadline', async () => {
      const stored = tokenStore.create({ role: 'operator', name: 'refresh-me', expire: '1h' });
      const jwt = signToken(
        { sub: stored.id, role: 'operator', rfd: Date.now() / 1000 + 86400 },
        JWT_SECRET,
        '1h',
      );

      const response = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: authHeaders(),
        payload: { token: jwt },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tokenId).toBe(stored.id);
      expect(body.accessToken).toBeTruthy();
      expect(typeof body.accessToken).toBe('string');
    });

    it('rejects refresh for revoked token', async () => {
      const stored = tokenStore.create({ role: 'operator', name: 'revoke-then-refresh', expire: '1h' });
      const jwt = signToken(
        { sub: stored.id, role: 'operator', rfd: Date.now() / 1000 + 86400 },
        JWT_SECRET,
        '1h',
      );

      tokenStore.revoke(stored.id);

      const response = await server!.app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: authHeaders(),
        payload: { token: jwt },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns auth info for secret token', async () => {
      const response = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('secret');
      expect(body.role).toBe('admin');
      expect(body.scopes).toEqual(['*']);
    });

    it('returns auth info for JWT token', async () => {
      const stored = tokenStore.create({ role: 'viewer', name: 'me-check', expire: '1h' });
      const jwt = signToken(
        { sub: stored.id, role: 'viewer', rfd: Date.now() / 1000 + 86400 },
        JWT_SECRET,
        '1h',
      );

      const response = await server!.app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${jwt}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('jwt');
      expect(body.role).toBe('viewer');
      expect(body.tokenId).toBe(stored.id);
    });
  });
});
