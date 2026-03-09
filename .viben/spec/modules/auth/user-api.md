# T4: User API

> Implement user management API routes including registration, OAuth, and API keys.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T4 |
| Dependencies | T1 (Database), T2 (Auth Core) |
| Effort | 5 points |
| Priority | P0 (Critical Path) |

---

## Objectives

1. Implement user registration (email/password)
2. Implement email/password login
3. Implement GitHub OAuth flow
4. Implement API key management
5. Implement user profile CRUD

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login | No |
| POST | `/api/auth/signout` | Logout | Yes |
| GET | `/api/auth/info` | Get current user | Yes |
| GET | `/api/auth/github` | Start OAuth | No |
| GET | `/api/auth/github/callback` | OAuth callback | No |
| GET | `/api/users/me` | Get profile | Yes |
| PUT | `/api/users/me` | Update profile | Yes |
| GET | `/api/users/[username]` | Public profile | No |
| GET | `/api/users/api-keys` | List API keys | Yes |
| POST | `/api/users/api-keys` | Create API key | Yes |
| DELETE | `/api/users/api-keys/[id]` | Revoke API key | Yes |

---

## Deliverables

### 1. Registration (`apps/web/app/api/auth/register/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/i),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, username, password, displayName } = registerSchema.parse(body);

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: (u, { or, eq }) => or(eq(u.email, email), eq(u.username, username)),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email or username already taken' },
        { status: 400 }
      );
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      email,
      username,
      displayName,
      passwordHash,
      role: 'user',
    });

    // Set session
    await setSessionCookie({
      userId,
      username,
      email,
      role: 'user',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Login (`apps/web/app/api/auth/login/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Set session
    await setSessionCookie({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'user' | 'developer' | 'admin',
      avatarUrl: user.avatarUrl ?? undefined,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 3. GitHub OAuth (`apps/web/app/api/auth/github/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { generateId } from '@/lib/utils';
import { cookies } from 'next/headers';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;
const GITHUB_REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`;

export async function GET() {
  const state = generateId();

  // Store state in cookie for CSRF protection
  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  );
}
```

### 4. GitHub Callback (`apps/web/app/api/auth/github/callback/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, users, oauthConnections } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, and } from 'drizzle-orm';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
    );
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const { access_token } = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const githubUser = await userResponse.json();

    // Get email
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const emails = await emailResponse.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || githubUser.email;

    // Find or create user
    let connection = await db.query.oauthConnections.findFirst({
      where: and(
        eq(oauthConnections.provider, 'github'),
        eq(oauthConnections.providerUserId, String(githubUser.id))
      ),
      with: { user: true },
    });

    let user;

    if (connection) {
      user = connection.user;
    } else {
      // Create new user
      const userId = generateId();
      await db.insert(users).values({
        id: userId,
        email: primaryEmail,
        username: githubUser.login,
        displayName: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        githubUsername: githubUser.login,
        role: 'user',
        emailVerified: true,
      });

      await db.insert(oauthConnections).values({
        id: generateId(),
        userId,
        provider: 'github',
        providerUserId: String(githubUser.id),
        accessToken: access_token, // Should encrypt this
      });

      user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
    }

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Set session
    await setSessionCookie({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role as 'user' | 'developer' | 'admin',
      avatarUrl: user.avatarUrl ?? undefined,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/mcp`);
  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`
    );
  }
}
```

### 5. API Key Management (`apps/web/app/api/users/api-keys/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, apiKeys } from '@/lib/db';
import { requireAuth } from '@/lib/auth/middleware';
import { generateId } from '@/lib/utils';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

// GET - List API keys
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, session.userId),
      columns: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ keys });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write', 'delete'])),
  expiresIn: z.number().optional(), // days
});

// POST - Create API key
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { name, scopes, expiresIn } = createKeySchema.parse(body);

    // Generate key: bmcp_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYYYYYY
    const prefix = `bmcp_${generateId().slice(0, 8)}`;
    const secret = generateId() + generateId(); // 64 chars
    const fullKey = `${prefix}_${secret}`;

    const keyHash = await bcrypt.hash(fullKey, 12);

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(apiKeys).values({
      id: generateId(),
      userId: session.userId,
      name,
      keyHash,
      keyPrefix: prefix,
      scopes,
      expiresAt,
    });

    // Return the full key only once
    return NextResponse.json({
      key: fullKey,
      prefix,
      name,
      scopes,
      expiresAt,
      warning: 'Save this key now. You will not be able to see it again.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
```

---

## Validation Schemas

```typescript
// apps/web/lib/validations/user.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9_-]+$/i,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});
```

---

## Acceptance Criteria

- [ ] User can register with email/password
- [ ] User can login with email/password
- [ ] User can login with GitHub OAuth
- [ ] Session cookie is set on successful auth
- [ ] User can logout (session cleared)
- [ ] User can view/update profile
- [ ] User can create API keys
- [ ] User can list and revoke API keys
- [ ] API keys are hashed before storage
- [ ] Full API key shown only once on creation

---

## Security Notes

1. **Password requirements**: Minimum 8 characters
2. **Username validation**: Alphanumeric + underscore/hyphen only
3. **OAuth state**: CSRF protection via state parameter
4. **API key storage**: Only hash is stored, prefix for identification
5. **Rate limiting**: Should add rate limiting to auth endpoints
