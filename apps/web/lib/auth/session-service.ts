import { db, authSessions, users } from '@/lib/db';
import { eq, and, isNull, ne } from 'drizzle-orm';
import { verifyAccessToken, REFRESH_TOKEN_TTL_SECONDS } from './token';
import { generateRefreshToken, hashRefreshToken } from './refresh-token';
import type { Session } from './types';

export class RefreshTokenError extends Error {
  constructor(
    message = 'Invalid refresh token',
    public status = 401,
  ) {
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
