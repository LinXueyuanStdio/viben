import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './jwe';
import { resolveSessionFromAccessToken } from './session-service';
import { ACCESS_COOKIE } from './token';
import { validateApiKey } from './api-key';
import type { Session } from './types';

export async function authMiddleware(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await resolveSessionFromAccessToken(token);

  if (!session) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  // Add session to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-slug', session.userSlug);
  requestHeaders.set('x-user-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// Helper to get session in API routes
export async function requireAuth(request: NextRequest): Promise<Session> {
  // 1. Check Bearer Token first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7);

    // 1a. Try API Key (bmcp_ prefix)
    if (bearerToken.startsWith('bmcp_')) {
      const user = await validateApiKey(bearerToken);
      if (user) {
        return {
          userId: user.id,
          username: user.username,
          userSlug: user.userSlug,
          email: user.email,
          role: user.role as Session['role'],
          expiresAt: 0,
        };
      }
      throw new AuthError('Invalid API key', 401);
    }

    // 1b. Try JWE session token (used by desktop client)
    const session = await decryptSession(bearerToken);
    if (session) {
      return session;
    }

    throw new AuthError('Invalid token', 401);
  }

  // 2. Check access token cookie
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    throw new AuthError('Unauthorized', 401);
  }

  const session = await resolveSessionFromAccessToken(token);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  return session;
}

// Helper to get optional session (doesn't throw)
export async function getOptionalSession(
  request: NextRequest
): Promise<Session | null> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return resolveSessionFromAccessToken(token);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
