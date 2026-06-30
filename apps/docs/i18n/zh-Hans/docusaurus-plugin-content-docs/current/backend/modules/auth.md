# T2: Auth Core

> Implement JWE-based session management and auth middleware.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T2 |
| Dependencies | T0 (Project Setup) |
| Effort | 3 points |
| Priority | P0 (Critical Path) |

---

## Objectives

1. Implement JWE session encryption/decryption
2. Create session management utilities
3. Build auth middleware for API routes
4. Set up cookie handling

---

## Deliverables

### 1. Session Types (`apps/web/lib/auth/types.ts`)

```typescript
export interface Session {
  userId: string;
  username: string;
  email: string;
  role: 'user' | 'developer' | 'admin';
  avatarUrl?: string;
  expiresAt: number;
}

export interface SessionPayload {
  session: Session;
  iat: number;
  exp: number;
}
```

### 2. JWE Utilities (`apps/web/lib/auth/jwe.ts`)

```typescript
import { EncryptJWT, jwtDecrypt } from 'jose';
import type { Session, SessionPayload } from './types';

const secret = new TextEncoder().encode(process.env.JWE_SECRET!);
const alg = 'dir';
const enc = 'A256GCM';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function encryptSession(session: Session): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION;

  return new EncryptJWT({ session: { ...session, expiresAt } })
    .setProtectedHeader({ alg, enc })
    .setIssuedAt()
    .setExpirationTime(expiresAt / 1000)
    .encrypt(secret);
}

export async function decryptSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtDecrypt(token, secret);
    const { session } = payload as SessionPayload;

    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
```

### 3. Cookie Management (`apps/web/lib/auth/cookies.ts`)

```typescript
import { cookies } from 'next/headers';
import { encryptSession, decryptSession } from './jwe';
import type { Session } from './types';

const COOKIE_NAME = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export async function setSessionCookie(session: Session): Promise<void> {
  const token = await encryptSession(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  return decryptSession(token);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
```

### 4. Auth Middleware (`apps/web/lib/auth/middleware.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './jwe';

export async function authMiddleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const session = await decryptSession(token);

  if (!session) {
    return NextResponse.json(
      { error: 'Session expired' },
      { status: 401 }
    );
  }

  // Add session to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-role', session.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// Helper to get session in API routes
export async function requireAuth(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    throw new AuthError('Unauthorized', 401);
  }

  const session = await decryptSession(token);

  if (!session) {
    throw new AuthError('Session expired', 401);
  }

  return session;
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
```

### 5. API Key Auth (`apps/web/lib/auth/api-key.ts`)

```typescript
import { db, apiKeys } from '@/lib/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export async function validateApiKey(key: string) {
  // API key format: bmcp_XXXXXXXX_YYYYYYYYYYYY
  const prefix = key.slice(0, 13); // bmcp_XXXXXXXX

  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyPrefix, prefix),
    with: { user: true },
  });

  if (!apiKey) return null;

  const valid = await bcrypt.compare(key, apiKey.keyHash);
  if (!valid) return null;

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id));

  return apiKey.user;
}
```

### 6. Password Utilities (`apps/web/lib/auth/password.ts`)

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

## Security Considerations

1. **JWE vs JWT**: Using JWE (encrypted) instead of JWT (signed) for complete payload confidentiality
2. **httpOnly cookies**: Prevents XSS attacks from accessing session
3. **Secure flag**: Only sent over HTTPS in production
4. **SameSite=Lax**: Prevents CSRF for state-changing requests
5. **Password hashing**: bcrypt with 12 rounds

---

## Acceptance Criteria

- [ ] Session can be encrypted and decrypted
- [ ] Cookies are set with proper flags
- [ ] Middleware correctly validates sessions
- [ ] API key validation works
- [ ] Password hashing is secure
- [ ] Session expiration is enforced

---

## Testing

```typescript
// Test session encryption
import { encryptSession, decryptSession } from '@/lib/auth/jwe';

async function testSession() {
  const session = {
    userId: '123',
    username: 'test',
    email: 'test@example.com',
    role: 'user' as const,
    expiresAt: Date.now() + 86400000,
  };

  const token = await encryptSession(session);
  const decoded = await decryptSession(token);

  console.log('Original:', session);
  console.log('Decoded:', decoded);
}
```

---

## Notes

- JWE_SECRET must be exactly 32 bytes for A256GCM
- Consider rate limiting on auth endpoints
- Implement refresh token rotation for longer sessions
