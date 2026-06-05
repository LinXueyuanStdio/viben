import type { FastifyInstance } from 'fastify';
import { CreateTokenBodySchema, RevokeTokenParamSchema, RefreshBodySchema, CreateCodeBodySchema, RevokeCodeParamSchema } from '../schemas/auth.js';
import { signToken, verifyForRefresh } from '../auth/jwt.js';
import { parseDuration, type TokenStore } from '../auth/token-store.js';
import { getRoleScopes } from '../auth/roles.js';
import { AuthError, NotFoundError } from '../middleware/error-handler.js';
import { requireScopes, requireRole } from '../middleware/auth.js';

export interface AuthRouteDeps {
  tokenStore: TokenStore;
  /** Returns the current JWT signing secret. Fetched lazily to support future rotation. */
  getJwtSecret: () => string;
  /**
   * Optional resolver for the identity service. Provided lazily so the auth plugin
   * does not hard-depend on identity — if identity is not loaded, this returns undefined.
   */
  getIdentityService?: () => { getUser(userId: string): Promise<{ displayName: string } | undefined> } | undefined;
}

/**
 * Auth management routes under `/api/v1/auth`.
 *
 * Token lifecycle:
 * - `POST /tokens` — create a scoped JWT (secret-token auth only).
 * - `GET /tokens` — list non-revoked tokens.
 * - `DELETE /tokens/:id` — revoke a token by ID.
 * - `POST /refresh` — re-issue an expired JWT within the refresh deadline window.
 * - `GET /me` — return the current authenticated identity.
 * - `POST /codes` — generate a one-time code for the App login flow (secret-token only).
 * - `GET /codes` — list active (unused, unexpired) codes (truncated for security).
 * - `DELETE /codes/:code` — revoke a pending code.
 *
 * The `POST /exchange` endpoint lives in `index.ts` (unauthenticated, separate Fastify scope).
 */
export async function authRoutes(
  app: FastifyInstance,
  deps: AuthRouteDeps,
): Promise<void> {
  const { tokenStore, getJwtSecret } = deps;

  // POST /tokens — generate a new JWT (secret token auth only).
  // Restricting to secret-token type prevents a compromised JWT from self-escalating
  // by minting additional tokens with different roles or longer lifetimes.
  app.post('/tokens', async (request) => {
    if (request.auth.type !== 'secret') {
      throw new AuthError('FORBIDDEN', 'Only secret token can create new tokens', 403);
    }
    const body = CreateTokenBodySchema.parse(request.body);
    const stored = tokenStore.create({
      role: body.role,
      name: body.name,
      expire: body.expire,
      scopes: body.scopes,
    });

    const durationMs = parseDuration(body.expire);
    const rfd = new Date(stored.refreshDeadline).getTime() / 1000;

    const accessToken = signToken(
      { sub: stored.id, role: stored.role, scopes: stored.scopes, rfd },
      getJwtSecret(),
      body.expire,
    );

    const expiresAt = new Date(Date.now() + durationMs).toISOString();

    return {
      tokenId: stored.id,
      accessToken,
      expiresAt,
      refreshDeadline: stored.refreshDeadline,
      identitySecret: stored.identitySecret,
    };
  });

  // GET /tokens — list active tokens
  app.get('/tokens', {
    preHandler: [requireScopes('auth:manage')],
  }, async () => {
    const tokens = tokenStore.list();
    return {
      tokens: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        role: t.role,
        scopes: t.scopes,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        refreshDeadline: t.refreshDeadline,
      })),
    };
  });

  // DELETE /tokens/:id — revoke a token
  app.delete('/tokens/:id', {
    preHandler: [requireScopes('auth:manage')],
  }, async (request) => {
    const { id } = RevokeTokenParamSchema.parse(request.params);
    const stored = tokenStore.get(id);
    if (!stored) {
      throw new NotFoundError('TOKEN_NOT_FOUND', `Token ${id} not found`);
    }
    tokenStore.revoke(id);
    return { revoked: true, id };
  });

  // POST /refresh — refresh an expired JWT (within refresh deadline)
  app.post('/refresh', async (request) => {
    const { token } = RefreshBodySchema.parse(request.body);

    let payload;
    try {
      payload = verifyForRefresh(token, getJwtSecret());
    } catch {
      throw new AuthError('UNAUTHORIZED', 'Invalid token for refresh');
    }

    // Check refresh deadline
    const now = Date.now() / 1000;
    if (now > payload.rfd) {
      throw new AuthError('UNAUTHORIZED', 'Refresh deadline exceeded, re-authenticate required');
    }

    // Check if revoked
    const stored = tokenStore.get(payload.sub);
    if (!stored || stored.revoked) {
      throw new AuthError('UNAUTHORIZED', 'Token has been revoked');
    }

    // Compute original duration from the token's exp - iat
    const originalDurationSec = payload.exp - payload.iat;
    const expiresIn = `${originalDurationSec}s`;

    // Issue new token with same params
    const accessToken = signToken(
      { sub: payload.sub, role: payload.role, scopes: payload.scopes, rfd: payload.rfd },
      getJwtSecret(),
      expiresIn,
    );

    const expiresAt = new Date(Date.now() + originalDurationSec * 1000).toISOString();

    return {
      tokenId: payload.sub,
      accessToken,
      expiresAt,
      refreshDeadline: stored.refreshDeadline,
    };
  });

  // GET /me — current auth info, enriched with identity data if available.
  // Identity fields are optional — callers must not assume they are always present.
  app.get('/me', async (request) => {
    const { auth } = request;
    const userId = auth.tokenId ? deps.tokenStore.getUserId(auth.tokenId) : undefined;

    let displayName: string | null = null;
    if (userId && deps.getIdentityService) {
      const identityService = deps.getIdentityService();
      if (identityService) {
        const user = await identityService.getUser(userId);
        displayName = user?.displayName ?? null;
      }
    }

    return {
      type: auth.type,
      tokenId: auth.tokenId,
      role: auth.role,
      scopes: auth.scopes,
      userId: userId ?? null,
      displayName,
      claimed: !!userId,
    };
  });

  // POST /codes — generate one-time code (secret token only)
  app.post('/codes', {
    preHandler: [requireRole('admin')],
  }, async (request, reply) => {
    if (request.auth.type !== 'secret') {
      throw new AuthError('FORBIDDEN', 'Only secret token can create codes', 403);
    }
    const body = CreateCodeBodySchema.parse(request.body);
    const code = tokenStore.createCode({
      role: body.role,
      name: body.name,
      expire: body.expire,
      scopes: body.scopes,
    });
    return reply.send({ code: code.code, expiresAt: code.expiresAt });
  });

  // GET /codes — list active codes (auth:manage scope).
  // The code value itself is truncated to prevent this endpoint from being used to
  // harvest valid codes — it's for audit/display purposes only.
  app.get('/codes', {
    preHandler: [requireScopes('auth:manage')],
  }, async (_request, reply) => {
    const codes = tokenStore.listCodes().map(c => ({
      ...c,
      code: c.code.slice(0, 8) + '...',
    }));
    return reply.send({ codes });
  });

  // DELETE /codes/:code — revoke unused code (auth:manage scope)
  app.delete<{ Params: { code: string } }>('/codes/:code', {
    preHandler: [requireScopes('auth:manage')],
  }, async (request, reply) => {
    const { code } = RevokeCodeParamSchema.parse(request.params);
    tokenStore.revokeCode(code);
    return reply.send({ revoked: true, code });
  });
}
