import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AuthError } from './error-handler.js';
import { verifyToken } from '../auth/jwt.js';
import { getRoleScopes } from '../auth/roles.js';
import type { TokenStore } from '../auth/token-store.js';
import { createChildLogger } from '../../../core/utils/log.js';

const log = createChildLogger({ module: 'api-auth' });

// Augment FastifyRequest so all route handlers have typed access to the authenticated identity.
declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      /** "secret" = raw API secret (full admin); "jwt" = scoped JWT token. */
      type: 'secret' | 'jwt';
      /** Present for JWT auth; used to look up the token record for revocation checks. */
      tokenId?: string;
      role: string;
      scopes: string[];
    };
  }
}

function constantTimeSecretCheck(token: string, secret: string): boolean {
  // Hash both to fixed-length to prevent length leaking
  const tokenHash = createHmac('sha256', 'viben-auth').update(token).digest();
  const secretHash = createHmac('sha256', 'viben-auth').update(secret).digest();
  return timingSafeEqual(tokenHash, secretHash);
}

/**
 * Creates a Fastify pre-handler that validates incoming auth tokens.
 *
 * Two credential types are accepted in priority order:
 * 1. Raw API secret — constant-time compared; grants full admin access (`scopes: ['*']`).
 * 2. JWT — verified with HS256, then checked against TokenStore for revocation.
 *
 * On success, `request.auth` is populated with role and scopes for downstream handlers.
 * Token may be provided via `Authorization: Bearer <token>` or `?token=` query param
 * (the latter is warned against because tunnel providers log query strings).
 */
export function createAuthPreHandler(
  getSecret: () => string,
  getJwtSecret: () => string,
  tokenStore: TokenStore,
): preHandlerHookHandler {
  return async function authPreHandler(request: FastifyRequest, _reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const queryToken = (request.query as Record<string, string>)?.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

    // Warn when token is passed via URL query param — tokens in URLs are logged by
    // tunnel providers (Cloudflare, ngrok), appear in browser history, and can leak
    // via Referer headers. Use the Authorization: Bearer header instead.
    if (queryToken && !authHeader) {
      log.warn({ url: request.url.replace(/([?&]token=)[^&]+/, '$1[REDACTED]') },
        'Token passed via URL query param — use Authorization: Bearer header to avoid token leakage in tunnel/proxy logs')
    }

    if (!token) {
      throw new AuthError('UNAUTHORIZED', 'Missing authentication token');
    }

    // 1. Check secret token (constant-time compare) — full admin access
    const secret = getSecret();
    if (constantTimeSecretCheck(token, secret)) {
      request.auth = { type: 'secret', role: 'admin', scopes: ['*'] };
      return;
    }

    // 2. Try JWT verification
    let payload;
    try {
      const jwtSecret = getJwtSecret();
      payload = verifyToken(token, jwtSecret);
    } catch {
      throw new AuthError('UNAUTHORIZED', 'Invalid authentication token');
    }

    const stored = tokenStore.get(payload.sub);
    if (!stored || stored.revoked) {
      throw new AuthError('UNAUTHORIZED', 'Token has been revoked');
    }

    tokenStore.updateLastUsed(payload.sub);

    const scopes = payload.scopes ?? getRoleScopes(payload.role);

    request.auth = {
      type: 'jwt',
      tokenId: payload.sub,
      role: payload.role,
      scopes,
    };
  };
}

/**
 * Returns a Fastify pre-handler that enforces one or more required scopes.
 *
 * Wildcard `'*'` (admin secret auth) bypasses all scope checks.
 * Throws 403 listing the specific missing scopes for easier debugging.
 */
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

/**
 * Returns a Fastify pre-handler that enforces a minimum role level.
 *
 * Roles form a hierarchy: viewer < operator < admin. A user with a higher role
 * always passes a lower-role gate, so `requireRole('operator')` also admits admins.
 */
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
