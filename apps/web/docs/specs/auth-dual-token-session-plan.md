# 双 Token 会话架构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前「单一长命 JWE session cookie」替换为「短命 Access Token(JWT HS256) + 长命 Refresh Token(opaque 轮换)」的双 token 会话架构，对齐互联网大厂标准。

**Architecture:** Access Token(15min) 无状态本地验签；Refresh Token(30d 滑动) 哈希后存 `auth_sessions` 表，每次轮换 + 复用检测。middleware 只在 access 过期时查库刷新（约 15 分钟/用户一次），鉴权函数 `requireAuth`/`getSession` 验签后查 `users` 表补全完整 Session，保持 111+ 个调用点签名不变。

**Tech Stack:** Next.js 15 App Router、Drizzle ORM(Postgres)、jose 6(H256)、node:crypto(SHA-256/randomBytes)、vitest。

**Spec:** `apps/web/docs/specs/auth-dual-token-session.md`（本 plan 实现该 spec；发现的一处 spec 内部矛盾在下方「Spec 修正」中显式解决）

## Global Constraints

- 所有 Gateway API 参数与文件存储字段用 **snake_case**；但本 plan 涉及的 Drizzle 列、TS 变量用 **camelCase**（与现有 `authSessions` 表定义一致）。
- **禁止** inline import type（`import("x").T`）；一律用顶部 `import type { ... } from "..."`。
- **禁止** `await import()` 动态导入；用静态导入。
- 语义色变量（`--background` 等）为 oklch，**禁止** `hsl(var(--x))` 包裹。
- 构建校验：**只** `cd apps/web && pnpm typecheck` / `pnpm test:run`，**禁止**在 repo 根跑 `pnpm build`/`pnpm typecheck`。
- **不要运行 `pnpm db:generate`**（不生成迁移文件）。全部实现完成后统一 `pnpm db:push` 推 schema，由用户审批。
- 新增环境变量：`ACCESS_TOKEN_SECRET`（32 字节随机，与 `JWE_SECRET` 分离）。middleware 跑 Edge runtime，`process.env.ACCESS_TOKEN_SECRET` 必须在 middleware 文件内**直接引用**才会被构建期内联（参照现有 `middleware.ts` 注释）。
- 中文翻译：agent→智能体、token→词元（仅面向用户的文案，代码注释无需）。

## Spec 修正（实现前必读）

1. **`refresh_token` cookie 的 `Path` 改为 `/`**（spec §3.2 写 `/api/auth/refresh`）。原因：§3.6 选项 A 要求 middleware 在 access 过期时读 `refresh_token` 触发自动刷新；但 `Path=/api/auth/refresh` 会让浏览器只在请求 refresh 端点时才发送该 cookie，middleware 拦截页面请求（如 `/assistant`）时读不到 refresh token，选项 A 无法工作。改为 `Path=/` 后，middleware 能读到 refresh token 完成自动刷新。安全面不受影响：httpOnly 防 XSS 读取，SameSite=Lax 防 CSRF，轮换 + 复用检测防泄露后的重放。
2. **`requireAuth`/`getSession` 验签后查 `users` 表补全 Session**（spec §5「必要时查库」的落实）。access token 只含 `{userId, role, sessionId}`，但现有 111 个 `requireAuth` 调用点依赖 `Session` 的 `email/username/userSlug/displayName/avatarUrl`，必须查库补齐才能保持签名不变。users 表主键查询，开销可接受。
3. **middleware 自动刷新的 SSR 局限**：middleware 刷新后写的是**响应** cookie，当前请求的 Server Component 仍用旧 request cookie 渲染，可能在该次请求短暂「未登录」；浏览器存到新 cookie 后下次请求恢复。缓解：Task 8 前端加「未登录时主动调 `/api/auth/refresh` 重试一次」的兜底（见 Task 8）。

---

### Task 1: Access/Refresh Token 层

**Files:**
- Modify: `apps/web/lib/auth/types.ts`（新增 `AccessTokenPayload`）
- Create: `apps/web/lib/auth/token.ts`
- Test: `apps/web/lib/auth/__tests__/token.test.ts`

**Interfaces:**
- Consumes: 无（纯函数，无 db 依赖）
- Produces:
  - `AccessTokenPayload { userId: string; role: string; sessionId: string; iat: number; exp: number }`
  - `ACCESS_TOKEN_TTL_SECONDS = 15 * 60`
  - `REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60`
  - `ACCESS_COOKIE = 'access_token'`、`REFRESH_COOKIE = 'refresh_token'`
  - `signAccessToken(claims: { userId; role; sessionId }, secretOverride?: string): Promise<string>`
  - `verifyAccessToken(token: string, secretOverride?: string): Promise<AccessTokenPayload | null>`
  - `generateRefreshToken(): string`
  - `hashRefreshToken(token: string): string`

- [ ] **Step 1: 在 `types.ts` 末尾新增类型**

在 `apps/web/lib/auth/types.ts` 末尾追加：

```ts
export interface AccessTokenPayload {
  userId: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
}
```

- [ ] **Step 2: 写失败测试**

创建 `apps/web/lib/auth/__tests__/token.test.ts`：

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from '../token';

const TEST_SECRET = 'test-access-token-secret-that-is-long-enough-for-hs256';

describe('signAccessToken / verifyAccessToken', () => {
  const claims = { userId: 'u-1', role: 'developer', sessionId: 's-1' };

  it('round-trips claims', async () => {
    const token = await signAccessToken(claims, TEST_SECRET);
    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u-1');
    expect(payload?.role).toBe('developer');
    expect(payload?.sessionId).toBe('s-1');
  });

  it('sets exp to now + 15min', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signAccessToken(claims, TEST_SECRET);
    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload!.exp).toBeGreaterThanOrEqual(before + ACCESS_TOKEN_TTL_SECONDS - 5);
    expect(payload!.exp).toBeLessThanOrEqual(before + ACCESS_TOKEN_TTL_SECONDS + 5);
  });

  it('returns null for tampered token', async () => {
    const token = await signAccessToken(claims, TEST_SECRET);
    const tampered = token.slice(0, -3) + 'abc';
    expect(await verifyAccessToken(tampered, TEST_SECRET)).toBeNull();
  });

  it('returns null when signed with a different secret', async () => {
    const token = await signAccessToken(claims, TEST_SECRET);
    expect(await verifyAccessToken(token, 'a-completely-different-secret-value')).toBeNull();
  });

  it('returns null for garbage', async () => {
    expect(await verifyAccessToken('not-a-jwt', TEST_SECRET)).toBeNull();
  });
});

describe('refresh token helpers', () => {
  it('generates url-safe base64url token of 43 chars (32 bytes)', () => {
    const t = generateRefreshToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generates unique tokens', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it('hashes deterministically with sha256 hex', () => {
    const t = 'abc';
    expect(hashRefreshToken(t)).toBe(hashRefreshToken(t));
    expect(hashRefreshToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(t)).not.toBe(hashRefreshToken('abd'));
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd apps/web && pnpm vitest run lib/auth/__tests__/token.test.ts`
Expected: FAIL（`Cannot find module '../token'`）

- [ ] **Step 4: 实现 `token.ts`**

创建 `apps/web/lib/auth/token.ts`：

```ts
import { SignJWT, jwtVerify, base64url } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import type { AccessTokenPayload } from './types';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 分钟
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天

const REFRESH_TOKEN_BYTES = 32;
const HS256_KEY_BYTES = 32;

/**
 * 解析签名密钥为 32 字节。优先按 base64url 解码（若恰为 32 字节），
 * 否则按 UTF-8 文本编码并补零/截断到 32 字节（与 jwe.ts 的 getSecret 一致）。
 */
function resolveSecret(secret: string): Uint8Array {
  try {
    const decoded = base64url.decode(secret);
    if (decoded.length === HS256_KEY_BYTES) {
      return decoded;
    }
  } catch {
    // 非 base64url，走文本编码
  }

  const encoded = new TextEncoder().encode(secret);
  if (encoded.length >= HS256_KEY_BYTES) {
    return encoded.slice(0, HS256_KEY_BYTES);
  }
  const padded = new Uint8Array(HS256_KEY_BYTES);
  padded.set(encoded);
  return padded;
}

function getAccessTokenSecret(secretOverride?: string): Uint8Array {
  const secret = secretOverride ?? process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET environment variable is not set');
  }
  return resolveSecret(secret);
}

/** 签发 15 分钟有效的 HS256 access token，payload 不含 email 等敏感字段。 */
export async function signAccessToken(
  claims: { userId: string; role: string; sessionId: string },
  secretOverride?: string,
): Promise<string> {
  const secret = getAccessTokenSecret(secretOverride);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    userId: claims.userId,
    role: claims.role,
    sessionId: claims.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secret);
}

/** 验签 access token；无效/过期/篡改一律返回 null（不区分原因，防信息泄露）。 */
export async function verifyAccessToken(
  token: string,
  secretOverride?: string,
): Promise<AccessTokenPayload | null> {
  try {
    const secret = getAccessTokenSecret(secretOverride);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.sessionId !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId,
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
      exp: typeof payload.exp === 'number' ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}

/** 生成 32 字节不透明 refresh token（base64url，43 字符）。 */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/** refresh token 的 SHA-256 十六进制哈希（DB 只存哈希，不落明文）。 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd apps/web && pnpm vitest run lib/auth/__tests__/token.test.ts`
Expected: PASS（所有用例）

- [ ] **Step 6: Commit**

```bash
cd apps/web
git add lib/auth/types.ts lib/auth/token.ts lib/auth/__tests__/token.test.ts
git commit -m "feat(auth): add access/refresh token primitives (HS256 sign/verify, sha256 hash)"
```

---

### Task 2: Session 生命周期服务层

**Files:**
- Create: `apps/web/lib/auth/session-service.ts`
- Test: `apps/web/lib/auth/__tests__/session-service.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `generateRefreshToken`/`hashRefreshToken`/`verifyAccessToken`；`db`/`authSessions`/`users`（`@/lib/db`）；`Session`（`./types`）
- Produces:
  - `RefreshTokenError extends Error`（带 `status: number`）
  - `createSession(userId, meta?): Promise<{ sessionId: string; refreshToken: string }>`
  - `rotateRefreshToken(rawToken, meta?): Promise<{ userId: string; sessionId: string; refreshToken: string }>`（含复用检测 + 轮换 CAS + 家族吊销）
  - `revokeSession(sessionId): Promise<void>`
  - `revokeAllUserSessions(userId, opts?): Promise<void>`
  - `resolveSessionFromAccessToken(token, secretOverride?): Promise<Session | null>`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/lib/auth/__tests__/session-service.test.ts`：

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn().mockResolvedValue(undefined),
  findFirstResult: null as any,
  updateSet: vi.fn(),
  updateReturning: vi.fn().mockResolvedValue([{ id: 's-1' }]),
  usersFindFirstResult: null as any,
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mocks.insertValues })),
    query: {
      authSessions: { findFirst: vi.fn(() => mocks.findFirstResult) },
      users: { findFirst: vi.fn(() => mocks.usersFindFirstResult) },
    },
    update: vi.fn(() => ({ set: mocks.updateSet.mockReturnValue({ where: vi.fn(() => ({ returning: mocks.updateReturning })) }) })),
  },
  authSessions: { id: 'id', userId: 'userId', refreshTokenHash: 'refreshTokenHash', expiresAt: 'expiresAt', lastUsedAt: 'lastUsedAt', revokedAt: 'revokedAt', userAgent: 'userAgent', ip: 'ip' },
  users: { id: 'id', username: 'username', userSlug: 'userSlug', displayName: 'displayName', email: 'email', role: 'role', avatarUrl: 'avatarUrl' },
}));

import { createSession, rotateRefreshToken, RefreshTokenError } from '../session-service';
import { hashRefreshToken } from '../token';

describe('createSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a hashed refresh token and returns raw token + sessionId', async () => {
    const { sessionId, refreshToken } = await createSession('u-1', { userAgent: 'UA', ip: '1.2.3.4' });

    expect(sessionId).toBeTruthy();
    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const inserted = mocks.insertValues.mock.calls[0][0];
    expect(inserted.userId).toBe('u-1');
    expect(inserted.refreshTokenHash).toBe(hashRefreshToken(refreshToken));
    expect(inserted.refreshTokenHash).not.toBe(refreshToken);
    expect(inserted.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(inserted.userAgent).toBe('UA');
    expect(inserted.ip).toBe('1.2.3.4');
  });
});

describe('rotateRefreshToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateReturning.mockResolvedValue([{ id: 's-1' }]);
  });

  it('rotates: returns new token and updates hash', async () => {
    mocks.findFirstResult = { id: 's-1', userId: 'u-1', refreshTokenHash: 'oldhash', expiresAt: new Date(Date.now() + 86400000), revokedAt: null, userAgent: null, ip: null };

    const result = await rotateRefreshToken('oldrawtoken');

    expect(result.userId).toBe('u-1');
    expect(result.sessionId).toBe('s-1');
    expect(result.refreshToken).not.toBe('oldrawtoken');

    const updated = mocks.updateSet.mock.calls[0][0];
    expect(updated.refreshTokenHash).toBe(hashRefreshToken(result.refreshToken));
    expect(updated.lastUsedAt).toBeInstanceOf(Date);
  });

  it('throws when token unknown', async () => {
    mocks.findFirstResult = null;
    await expect(rotateRefreshToken('nope')).rejects.toThrow(RefreshTokenError);
  });

  it('throws when session already revoked (reuse detection)', async () => {
    mocks.findFirstResult = { id: 's-1', userId: 'u-1', refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 86400000), revokedAt: new Date() };

    await expect(rotateRefreshToken('reused')).rejects.toThrow(RefreshTokenError);
  });

  it('throws when expired', async () => {
    mocks.findFirstResult = { id: 's-1', userId: 'u-1', refreshTokenHash: 'h', expiresAt: new Date(Date.now() - 1000), revokedAt: null };

    await expect(rotateRefreshToken('expired')).rejects.toThrow(RefreshTokenError);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && pnpm vitest run lib/auth/__tests__/session-service.test.ts`
Expected: FAIL（`Cannot find module '../session-service'`）

- [ ] **Step 3: 实现 `session-service.ts`**

创建 `apps/web/lib/auth/session-service.ts`：

```ts
import { db, authSessions, users } from '@/lib/db';
import { eq, and, isNull, ne } from 'drizzle-orm';
import { generateRefreshToken, hashRefreshToken, verifyAccessToken, REFRESH_TOKEN_TTL_SECONDS } from './token';
import type { Session } from './types';

export class RefreshTokenError extends Error {
  constructor(message = 'Invalid refresh token', public status = 401) {
    super(message);
    this.name = 'RefreshTokenError';
  }
}

interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

/** 新建一个会话：生成 refresh token，哈希后落库，返回 sessionId + 明文 token。 */
export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<{ sessionId: string; refreshToken: string }> {
  const sessionId = crypto.randomUUID();
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(authSessions).values({
    id: sessionId,
    userId,
    refreshTokenHash,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });

  return { sessionId, refreshToken };
}

/**
 * 轮换 refresh token（30 天滑动）。
 * - 复用检测：记录已吊销却再次出现 → 判定泄露，吊销该用户全部 session。
 * - 原子 CAS：`WHERE id=:id AND refresh_token_hash=:old` + `returning`，竞争失败即已被轮换 → 吊销家族。
 */
export async function rotateRefreshToken(
  rawToken: string,
  meta: SessionMeta = {},
): Promise<{ userId: string; sessionId: string; refreshToken: string }> {
  const hash = hashRefreshToken(rawToken);

  const session = await db.query.authSessions.findFirst({
    where: eq(authSessions.refreshTokenHash, hash),
  });

  if (!session) {
    throw new RefreshTokenError();
  }

  if (session.revokedAt) {
    // 已吊销的 token 再次出现 → 被盗，吊销整个家族
    await revokeAllUserSessions(session.userId);
    throw new RefreshTokenError();
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new RefreshTokenError();
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const rotated = await db
    .update(authSessions)
    .set({
      refreshTokenHash,
      expiresAt,
      lastUsedAt: new Date(),
      userAgent: meta.userAgent ?? session.userAgent,
      ip: meta.ip ?? session.ip,
    })
    .where(
      and(
        eq(authSessions.id, session.id),
        eq(authSessions.refreshTokenHash, hash),
      ),
    )
    .returning({ id: authSessions.id });

  if (rotated.length === 0) {
    // 竞争失败：另一请求已轮换，本次的 old token 视为泄露
    await revokeAllUserSessions(session.userId);
    throw new RefreshTokenError();
  }

  return { userId: session.userId, sessionId: session.id, refreshToken };
}

/** 吊销单个会话（登出）。 */
export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, sessionId));
}

/** 吊销某用户全部会话（改密码 / 风控），可选排除当前会话。 */
export async function revokeAllUserSessions(
  userId: string,
  opts: { exceptSessionId?: string } = {},
): Promise<void> {
  const conditions = [
    eq(authSessions.userId, userId),
    isNull(authSessions.revokedAt),
  ];
  if (opts.exceptSessionId) {
    conditions.push(ne(authSessions.id, opts.exceptSessionId));
  }

  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}

/** 验签 access token 并查 users 表补全完整 Session（供 getSession/requireAuth 复用）。 */
export async function resolveSessionFromAccessToken(
  token: string,
  secretOverride?: string,
): Promise<Session | null> {
  const payload = await verifyAccessToken(token, secretOverride);
  if (!payload) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
    columns: {
      id: true,
      username: true,
      userSlug: true,
      displayName: true,
      email: true,
      role: true,
      avatarUrl: true,
    },
  });

  if (!user) return null;

  return {
    userId: user.id,
    username: user.username,
    userSlug: user.userSlug,
    displayName: user.displayName ?? undefined,
    email: user.email,
    role: user.role as Session['role'],
    avatarUrl: user.avatarUrl ?? undefined,
    expiresAt: payload.exp * 1000,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && pnpm vitest run lib/auth/__tests__/session-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/web
git add lib/auth/session-service.ts lib/auth/__tests__/session-service.test.ts
git commit -m "feat(auth): add session lifecycle service (create/rotate/revoke + reuse detection)"
```

---

### Task 3: 重写 cookies 层

**Files:**
- Modify: `apps/web/lib/auth/cookies.ts`（整体重写）

**Interfaces:**
- Consumes: Task 1 的 `signAccessToken`/`ACCESS_COOKIE`/`REFRESH_COOKIE`/`ACCESS_TOKEN_TTL_SECONDS`/`REFRESH_TOKEN_TTL_SECONDS`；Task 2 的 `resolveSessionFromAccessToken`
- Produces:
  - `setAuthCookies(claims: { userId; role; sessionId }, refreshToken): Promise<void>`
  - `clearAuthCookies(): Promise<void>`
  - `getSession(): Promise<Session | null>`（React `cache`，签名不变）

- [ ] **Step 1: 重写 `cookies.ts`**

用以下完整内容替换 `apps/web/lib/auth/cookies.ts`（删除旧 `setSessionCookie`/`clearSession`，`getSession` 保留同名导出）：

```ts
import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  signAccessToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './token';
import { resolveSessionFromAccessToken } from './session-service';
import type { Session } from './types';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ACCESS_TOKEN_TTL_SECONDS,
};

// 修正：path 用 '/'（见 plan「Spec 修正」），否则 middleware 无法在页面请求时读到 refresh token 触发自动刷新。
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_SECONDS,
};

/** 登录成功后设置 access_token + refresh_token 两个 cookie。 */
export async function setAuthCookies(
  claims: { userId: string; role: string; sessionId: string },
  refreshToken: string,
): Promise<void> {
  const accessToken = await signAccessToken(claims);
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
}

/** 清除两个 auth cookie（登出）。 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

async function _getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Auth] No access token cookie found');
    }
    return null;
  }

  return resolveSessionFromAccessToken(token);
}

/** React.cache() 确保同一请求内多次调用共享一份结果，避免 layout 和 page 各自独立查库。 */
export const getSession = cache(_getSession);
```

- [ ] **Step 2: typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: 报 `setSessionCookie`/`clearSession` 未定义（登录/登出端点仍引用旧函数）——这是预期，Task 4/6 会改调用点。若想单独验证本文件，可临时注释调用点后运行，但**不要提交临时改动**；跳过本步的 typecheck，进入 Task 4 后统一校验。

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add lib/auth/cookies.ts
git commit -m "feat(auth): rewrite cookies layer for dual-token (access + refresh)"
```

---

### Task 4: 鉴权层改造（requireAuth / getOptionalSession / admin）

**Files:**
- Modify: `apps/web/lib/auth/middleware.ts`
- Modify: `apps/web/lib/auth/admin.ts`
- Test: `apps/web/lib/auth/__tests__/middleware.test.ts`（更新）

**Interfaces:**
- Consumes: Task 2 的 `resolveSessionFromAccessToken`；Task 1 的 `ACCESS_COOKIE`
- Produces: `requireAuth`/`getOptionalSession`/`authMiddleware`/`AuthError` 签名不变；`admin.ts` 的 `requireAdmin` 等签名不变

- [ ] **Step 1: 改 `middleware.ts` 的 cookie 读取与验签**

对 `apps/web/lib/auth/middleware.ts` 做以下替换（保留 `AuthError`、Bearer 分支、API key 分支不变）：

1. 顶部 import 改为：

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from './jwe';
import { resolveSessionFromAccessToken } from './session-service';
import { ACCESS_COOKIE } from './token';
import { validateApiKey } from './api-key';
import type { Session } from './types';
```

2. `authMiddleware` 里 `request.cookies.get('session')` → `request.cookies.get(ACCESS_COOKIE)`，`decryptSession(token)` → `resolveSessionFromAccessToken(token)`，且 header 中 `x-user-slug` 改为从 `session.userSlug` 读取（`resolveSessionFromAccessToken` 已含该字段，逻辑不变）。

3. `requireAuth` 的 cookie 分支：`request.cookies.get('session')` → `request.cookies.get(ACCESS_COOKIE)`，`decryptSession(token)` → `resolveSessionFromAccessToken(token)`。Bearer 分支**保持不变**（1a API key、1b desktop JWE）。

4. `getOptionalSession`：`request.cookies.get('session')` → `request.cookies.get(ACCESS_COOKIE)`，`decryptSession(token)` → `resolveSessionFromAccessToken(token)`。

- [ ] **Step 2: 改 `admin.ts` 的五处验签**

对 `apps/web/lib/auth/admin.ts`：

1. 顶部 import 增加：

```ts
import { resolveSessionFromAccessToken } from './session-service';
import { ACCESS_COOKIE } from './token';
```

2. 以下 5 个函数中，`request.cookies.get('session')` → `request.cookies.get(ACCESS_COOKIE)`，`decryptSession(token)` → `resolveSessionFromAccessToken(token)`：
   - `authenticateRequest`（约 line 119-123）
   - `requireAdmin`（约 line 178-184）
   - `requireAnyPermission`（约 line 255-261）
   - `requireAllPermissions`（约 line 300-306）
   - `getAdminSession`（约 line 334-340）

   `decryptSession` import（`import { decryptSession } from './jwe'`）在改完后若不再被引用，一并删除。

- [ ] **Step 3: 更新 `middleware.test.ts`**

读 `apps/web/lib/auth/__tests__/middleware.test.ts`，将其对 `decryptSession` 的 mock 改为 mock `resolveSessionFromAccessToken`（`@/lib/auth/session-service`），并把构造请求时 `request.cookies.get('session')` 的断言改为 `access_token`。若测试原本 mock `@/lib/auth/jwe`，保留 Bearer 分支相关用例，仅替换 cookie 分支用例。

- [ ] **Step 4: typecheck + 单测**

Run: `cd apps/web && pnpm typecheck`
Run: `cd apps/web && pnpm vitest run lib/auth/__tests__/middleware.test.ts`
Expected: typecheck 仍可能报登录/登出端点引用旧函数（Task 6 修复）；middleware.test.ts PASS。

- [ ] **Step 5: Commit**

```bash
cd apps/web
git add lib/auth/middleware.ts lib/auth/admin.ts lib/auth/__tests__/middleware.test.ts
git commit -m "feat(auth): verify access token in requireAuth/getOptionalSession/admin helpers"
```

---

### Task 5: Refresh 端点

**Files:**
- Create: `apps/web/app/api/auth/refresh/route.ts`
- Test: `apps/web/app/api/auth/refresh/route.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `rotateRefreshToken`/`RefreshTokenError`；Task 1 的 `REFRESH_COOKIE`；Task 3 的 `setAuthCookies`；`checkRateLimit`（`@/lib/rate-limit`）
- Produces: `POST /api/auth/refresh` → `200 { success: true }`（含 Set-Cookie）或 `401`

- [ ] **Step 1: 写失败测试**

创建 `apps/web/app/api/auth/refresh/route.test.ts`：

```ts
/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  rotateRefreshToken: vi.fn(),
  setAuthCookies: vi.fn().mockResolvedValue(undefined),
  checkRateLimit: vi.fn().mockResolvedValue(null),
  cookiesGet: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock('@/lib/auth/session-service', () => ({
  rotateRefreshToken: mocks.rotateRefreshToken,
  RefreshTokenError: class extends Error { constructor(public status = 401) { super('Invalid refresh token'); } },
}));

vi.mock('@/lib/auth/cookies', () => ({
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookiesGet })),
}));

// refresh 端点查 users 表取 role 用于重签 access token
vi.mock('@/lib/db', () => ({
  db: { query: { users: { findFirst: vi.fn(() => ({ role: 'developer' })) } } },
  users: { id: 'id', role: 'role' },
}));

import { POST } from './route';

function createRequest(): Request {
  return new Request('http://localhost:3000/api/auth/refresh', {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'UA' },
  });
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setAuthCookies.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.rotateRefreshToken.mockResolvedValue({ userId: 'u-1', sessionId: 's-1', refreshToken: 'newtoken' });
    mocks.cookiesGet.mockReturnValue({ value: 'oldtoken' });
  });

  it('rotates and sets new cookies', async () => {
    const res = await POST(createRequest());
    expect(res.status).toBe(200);

    expect(mocks.rotateRefreshToken).toHaveBeenCalledWith('oldtoken', expect.objectContaining({ ip: '1.2.3.4', userAgent: 'UA' }));
    expect(mocks.setAuthCookies).toHaveBeenCalledWith({ userId: 'u-1', role: 'developer', sessionId: 's-1' }, 'newtoken');
  });

  it('returns 401 when refresh cookie missing', async () => {
    mocks.cookiesGet.mockReturnValue(undefined);
    const res = await POST(createRequest());
    expect(res.status).toBe(401);
    expect(mocks.rotateRefreshToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd apps/web && pnpm vitest run app/api/auth/refresh/route.test.ts`
Expected: FAIL（`Cannot find module './route'`）

- [ ] **Step 3: 实现 `refresh/route.ts`**

创建 `apps/web/app/api/auth/refresh/route.ts`：

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { rotateRefreshToken, RefreshTokenError } from '@/lib/auth/session-service';
import { setAuthCookies } from '@/lib/auth/cookies';
import { REFRESH_COOKIE } from '@/lib/auth/token';
import { checkRateLimit, rateLimitKey } from '@/lib/rate-limit';

/**
 * 刷新会话：校验 refresh token → 轮换 → 签发新 access token + refresh token。
 * @summary 刷新会话
 * @tag Auth
 * @response 200:SuccessResponse:刷新成功
 * @response 401:ErrorResponse:refresh token 无效或过期
 * @response 429:ErrorResponse:请求过于频繁
 */
export async function POST(request: NextRequest) {
  // 按 IP 限流
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
  const limited = await checkRateLimit({
    key: rateLimitKey(['refresh', ip]),
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!rawToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userAgent = request.headers.get('user-agent');
    const { userId, sessionId, refreshToken } = await rotateRefreshToken(rawToken, {
      userAgent,
      ip,
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { role: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await setAuthCookies({ userId, role: user.role, sessionId }, refreshToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RefreshTokenError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Auth] refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

> 说明：refresh 端点会额外查一次 users 取 `role` 用于重签 access token。若后续不想额外查询，可让 `rotateRefreshToken` 一并返回 role（把 role 也存进 auth_sessions 或复用 users 查询），但当前保持简单，30 天/用户一次，可接受。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd apps/web && pnpm vitest run app/api/auth/refresh/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/web
git add app/api/auth/refresh/route.ts app/api/auth/refresh/route.test.ts
git commit -m "feat(auth): add POST /api/auth/refresh with rotation + reuse detection + rate limit"
```

---

### Task 6: 登录 / 登出端点改造

**Files:**
- Modify: `apps/web/app/api/auth/login/route.ts`
- Modify: `apps/web/app/api/auth/register/route.ts`
- Modify: `apps/web/app/api/auth/google/one-tap/route.ts`
- Modify: `apps/web/app/api/auth/google/callback/route.ts`（仅 web 分支）
- Modify: `apps/web/app/api/auth/github/callback/route.ts`（仅 web 分支）
- Modify: `apps/web/app/api/auth/logout/route.ts`
- Test: 更新 `login/route.test.ts`、`register/route.test.ts`、`google/one-tap/route.test.ts`（logout 无既有测试，跳过）

**Interfaces:**
- Consumes: Task 2 的 `createSession`/`revokeSession`；Task 3 的 `setAuthCookies`/`clearAuthCookies`；Task 1 的 `ACCESS_COOKIE`/`REFRESH_COOKIE`
- Produces: 各端点响应结构不变

**统一改造模式**：把 `await setSessionCookie({ ...完整 Session 字段... })` 替换为「`createSession` + `setAuthCookies`」。所有登录端点现在**只**需要 `user.id` 和 `user.role`，不再手动拼 `username/userSlug/email/avatarUrl`（这些由 `resolveSessionFromAccessToken` 查库补全）。

- [ ] **Step 1: 改 `login/route.ts`**

`apps/web/app/api/auth/login/route.ts`：
1. import：`import { setSessionCookie } from '@/lib/auth/cookies';` → `import { setAuthCookies } from '@/lib/auth/cookies'; import { createSession } from '@/lib/auth/session-service';`
2. 把 `await setSessionCookie({ userId: user.id, ... })`（line 52-59）替换为：

```ts
    const { sessionId, refreshToken } = await createSession(user.id, {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    });
    await setAuthCookies({ userId: user.id, role: user.role, sessionId }, refreshToken);
```

- [ ] **Step 2: 改 `register/route.ts`**

`apps/web/app/api/auth/register/route.ts`：同样替换 line 51-57 的 `setSessionCookie({...})` 为 `createSession(userId, meta) + setAuthCookies({ userId, role: 'developer', sessionId }, refreshToken)`（注册固定 `role: 'developer'`，与现有 `db.insert` 一致）。

- [ ] **Step 3: 改 `google/one-tap/route.ts`**

`apps/web/app/api/auth/google/one-tap/route.ts`：替换 line 176-183 的 `setSessionCookie({...})`。`role` 用 `(user.role as ...) || 'developer'` 与现状一致；`createSession` 用 `user.id`。

- [ ] **Step 4: 改 `google/callback` 与 `github/callback` 的 web 分支**

两个文件都保留了 desktop 分支（`isAllowedDesktopRedirectUri` → JWE deep link），**desktop 分支不动**。仅 web 分支的 `await setSessionCookie({...})`（google line 259-266、github line 298-305）替换为 `createSession(user.id, meta) + setAuthCookies({ userId: user.id, role: user.role, sessionId }, refreshToken)`。两处之后紧跟 `NextResponse.redirect(...)`，`setAuthCookies` 用 `cookies()` 设置后 Next.js 会合并到 redirect response，无需改 redirect 逻辑。

- [ ] **Step 5: 改 `logout/route.ts`**

`apps/web/app/api/auth/logout/route.ts`：
1. import：
```ts
import { clearAuthCookies } from '@/lib/auth/cookies';
import { revokeSession } from '@/lib/auth/session-service';
import { verifyAccessToken, ACCESS_COOKIE } from '@/lib/auth/token';
import { cookies } from 'next/headers';
```
2. `POST` 与 `GET` 里，在 `clearAuthCookies()` 前，先从 access token 取 `sessionId` 吊销该会话（`Session` 不含 `sessionId`，需 `verifyAccessToken` 拿原始 payload）：

```ts
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE)?.value;
    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload) await revokeSession(payload.sessionId);
    }
    await clearAuthCookies();
```

`GET` 分支做同样处理。

- [ ] **Step 6: 更新三处 route 测试**

更新 `login/route.test.ts`、`register/route.test.ts`、`google/one-tap/route.test.ts`：
1. 把 `vi.mock('@/lib/auth/cookies', () => ({ setSessionCookie: mocks.setSessionCookie }))` 改为同时 mock `setAuthCookies` 与 `createSession`：

```ts
vi.mock('@/lib/auth/session-service', () => ({
  createSession: mocks.createSession,
}));
vi.mock('@/lib/auth/cookies', () => ({
  setAuthCookies: mocks.setAuthCookies,
}));
```

2. `mocks.createSession` 返回 `{ sessionId: 's-1', refreshToken: 'rt-1' }`（`vi.fn().mockResolvedValue(...)`）。
3. 断言从 `expect(mocks.setSessionCookie).toHaveBeenCalledWith({...})` 改为 `expect(mocks.createSession).toHaveBeenCalledWith('user-001', expect.any(Object))` 与 `expect(mocks.setAuthCookies).toHaveBeenCalledWith({ userId: 'user-001', role: 'developer', sessionId: 's-1' }, 'rt-1')`。
4. `setSessionCookie` 未调用的断言改为 `mocks.setAuthCookies` 未调用。

- [ ] **Step 7: typecheck + 单测**

Run: `cd apps/web && pnpm typecheck`
Run: `cd apps/web && pnpm vitest run app/api/auth/login/route.test.ts app/api/auth/register/route.test.ts app/api/auth/google/one-tap/route.test.ts`
Expected: typecheck 通过（本 Task 消除了 Task 3 遗留的旧函数引用）；三个测试 PASS。

- [ ] **Step 8: Commit**

```bash
cd apps/web
git add app/api/auth/login app/api/auth/register app/api/auth/google/one-tap app/api/auth/google/callback app/api/auth/github/callback app/api/auth/logout
git commit -m "feat(auth): issue dual tokens on login/register/oauth; revoke session on logout"
```

---

### Task 7: 根 middleware 重写（选项 A 自动刷新）

**Files:**
- Modify: `apps/web/middleware.ts`（整体重写）

**Interfaces:**
- Consumes: Task 1 的 `verifyAccessToken`/`ACCESS_COOKIE`/`REFRESH_COOKIE`
- Produces: 无（middleware 副作用）

- [ ] **Step 1: 重写 `middleware.ts`**

用以下完整内容替换 `apps/web/middleware.ts`：

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken, ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/token';

/**
 * 轻量自动刷新 middleware（选项 A）：
 * 1. access token 有效 → 本地验签（微秒级，不查库）→ 透传。
 * 2. 缺失/过期 → 读 refresh token → 调 /api/auth/refresh（此时才查库，15 分钟/用户一次）
 *    → 转写 Set-Cookie 到响应 → 透传。
 *
 * 注意：middleware 跑 Edge runtime，`process.env.ACCESS_TOKEN_SECRET` 必须在此文件内
 * 直接引用才会被构建期内联，故显式读取后传给 verifyAccessToken。
 */
export async function middleware(request: NextRequest) {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken, secret);
    if (payload) return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return NextResponse.next();

  // 调自己的 refresh 端点（Node runtime 查库轮换），matcher 已排除 /api/auth 避免递归
  const refreshRes = await fetch(new URL('/api/auth/refresh', request.url), {
    method: 'POST',
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}` },
  });

  if (!refreshRes.ok) {
    const res = NextResponse.next();
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const res = NextResponse.next();
  for (const cookie of refreshRes.headers.getSetCookie()) {
    res.headers.append('set-cookie', cookie);
  }
  return res;
}

export const config = {
  // 排除静态资源与所有 /api/auth/*（refresh/login/logout/callback），避免递归刷新
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

- [ ] **Step 2: typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add middleware.ts
git commit -m "feat(auth): replace sliding JWE renewal middleware with access-token refresh"
```

---

### Task 8: 前端 app-shell-wrapper（cache 字段 + 401 兜底）

**Files:**
- Modify: `apps/web/components/layout/app-shell-wrapper.tsx`

**Interfaces:**
- Consumes: `Session`（`@/lib/auth/types`）
- Produces: 无

**改造目标**：localStorage cache 从「`ts` 时间戳 + 活跃刷新」改为「`expiresAt` 绝对过期」；新增「未登录时主动 refresh 一次」的兜底，缓解 Task 7 说明的 SSR 一次性闪烁。

- [ ] **Step 1: 改 cache 字段为绝对过期**

`apps/web/components/layout/app-shell-wrapper.tsx`：

1. 删除 `SESSION_CACHE_TTL`、`CachedSession.ts`，改用 `expiresAt`：

```ts
const SESSION_CACHE_KEY = 'viben_session';
// 与 access token 15 分钟对齐，本地缓存的乐观过期点（略短于后端，避免显示已登录却 token 已失效）
const SESSION_CACHE_MAX_AGE = 14 * 60 * 1000;

interface CachedSession {
  session: Session;
  expiresAt: number; // 绝对过期时间戳（ms）
}
```

2. `readCache()` 把 `Date.now() - cached.ts < SESSION_CACHE_TTL` 改为 `cached.expiresAt > Date.now()`，命中时**不再回写刷新 ts**（去掉「活跃永不过期」语义，过期由 refresh token 滑动负责）。
3. `writeCache(session)` 写入 `expiresAt: Date.now() + SESSION_CACHE_MAX_AGE`。
4. `init()` 里 `fetch('/api/users/me')` 若返回 401，在 `setReady(true)` 前先 `fetch('/api/auth/refresh', { method: 'POST' })` 重试一次；refresh 成功后重新 `fetch('/api/users/me')` 取用户并 `writeCache`；仍失败则保持未登录。构造 `Session` 时 `expiresAt` 保持现状即可（前端仅用于展示，后端以 access token 为准）。

- [ ] **Step 2: typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd apps/web
git add components/layout/app-shell-wrapper.tsx
git commit -m "feat(auth): switch session cache to absolute expiry + refresh-on-401 fallback"
```

---

### Task 9: 清理旧路径 + 导出更新

**Files:**
- Modify: `apps/web/lib/auth/index.ts`
- Modify: `apps/web/lib/session/get-server-session.ts`（如引用旧函数）
- Modify: `apps/web/lib/session/server.ts`（如引用旧函数）

**Interfaces:**
- Consumes: Task 3 的新 cookies 导出
- Produces: `@/lib/auth` 与 `@/lib/session` 对外导出保持一致

- [ ] **Step 1: 更新 `lib/auth/index.ts` 导出**

`apps/web/lib/auth/index.ts`：
1. 移除 `export { setSessionCookie, getSession, clearSession } from './cookies';`
2. 改为 `export { setAuthCookies, clearAuthCookies, getSession } from './cookies';`
3. 新增 `export { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from './token';` 与 `export { createSession, rotateRefreshToken, revokeSession, revokeAllUserSessions, resolveSessionFromAccessToken, RefreshTokenError } from './session-service';`
4. `jwe` 的 `encryptSession/decryptSession` 导出**保留**（desktop bearer 仍用）。

- [ ] **Step 2: 检查 `lib/session/*` 是否引用旧函数**

`get-server-session.ts` 与 `server.ts` 均 `import { getSession } from "@/lib/auth/cookies"`——`getSession` 仍在，无需改。全局 grep 确认无 `setSessionCookie`/`clearSession` 残留引用：

Run: `cd apps/web && rg "setSessionCookie|clearSession" --glob '!**/*.test.ts' --glob '!docs/**'`
Expected: 无输出（除 `lib/auth/cookies.ts` 已被重写后不再导出）。若有残留，逐一改到新函数。

- [ ] **Step 3: typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd apps/web
git add lib/auth/index.ts lib/session
git commit -m "chore(auth): update barrel exports, remove legacy session cookie references"
```

---

### Task 10: 推 schema（由用户审批）

**Files:**
- 无代码改动（`authSessions` 表已在 `lib/db/schema.ts` 定义）

- [ ] **Step 1: 确认环境变量**

确认 `apps/web/.env`（或部署平台）已配置 `ACCESS_TOKEN_SECRET`（32 字节随机，可 `openssl rand -base64 32`）。缺失会导致 login/refresh 500。

- [ ] **Step 2: 全量 typecheck + 全量单测**

Run: `cd apps/web && pnpm typecheck`
Run: `cd apps/web && pnpm vitest run`
Expected: typecheck 通过；单测全绿（重点看 auth 相关）。

- [ ] **Step 3: 推 schema（等待用户审批后执行）**

```bash
cd apps/web && pnpm db:push
```

该命令会交互式询问确认 schema 变更（新增 `auth_sessions` 表）。**由用户审批确认**。推送成功后 `auth_sessions` 表创建完成，双 token 架构全链路可运行。

- [ ] **Step 4: 手工验证**

1. 登录（邮箱密码 / Google One Tap）→ 浏览器 cookie 里应出现 `access_token`（15min）与 `refresh_token`（30d），且无旧 `session` cookie。
2. 访问任意受保护页面 `/assistant` → 正常渲染。
3. 等 access token 过期（或手动删 `access_token` cookie 保留 `refresh_token`）→ 刷新页面 → middleware 自动刷新，仍保持登录。
4. 登出 → 两个 cookie 清除，`auth_sessions` 表对应记录 `revoked_at` 非空。
5. 复用已吊销的 refresh token 调 `/api/auth/refresh` → 401 且该用户其余 session 被吊销。
