/**
 * @vitest-environment node
 *
 * 集成测试：真实 token 层 + 真实 session-service，跑在有状态的内存 DB 上。
 * 只 mock 掉「DB 访问边界」（@/lib/db）和 drizzle 的条件构造（eq/and/isNull/ne），
 * 其余业务逻辑（SHA-256 哈希、HS256 签发/验签、轮换 CAS、复用检测、吊销）全部真实执行，
 * 验证双 token 机制的完整状态机。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- 有状态的内存 DB（真实实现 auth_sessions / users 的增删改查 + 条件求值）----
const state = vi.hoisted(() => ({
  authSessions: new Map<string, any>(),
  users: new Map<string, any>(),
}));

vi.mock('drizzle-orm', () => {
  const eq = (column: any, value: any) => ({ __op: 'eq', key: column?.key, value });
  const and = (...conds: any[]) => ({ __op: 'and', conds });
  const isNull = (column: any) => ({ __op: 'isNull', key: column?.key });
  const ne = (column: any, value: any) => ({ __op: 'ne', key: column?.key, value });
  return { eq, and, isNull, ne };
});

vi.mock('@/lib/db', () => {
  const col = (key: string) => ({ key });

  const authSessions = {
    id: col('id'),
    userId: col('userId'),
    refreshTokenHash: col('refreshTokenHash'),
    expiresAt: col('expiresAt'),
    createdAt: col('createdAt'),
    lastUsedAt: col('lastUsedAt'),
    revokedAt: col('revokedAt'),
    userAgent: col('userAgent'),
    ip: col('ip'),
  };
  const users = {
    id: col('id'),
    username: col('username'),
    userSlug: col('userSlug'),
    displayName: col('displayName'),
    email: col('email'),
    role: col('role'),
    avatarUrl: col('avatarUrl'),
  };

  function matches(row: any, cond: any): boolean {
    if (!cond) return true;
    switch (cond.__op) {
      case 'eq': return row[cond.key] === cond.value;
      case 'ne': return row[cond.key] !== cond.value;
      case 'isNull': return row[cond.key] == null;
      case 'and': return cond.conds.every((c: any) => matches(row, c));
      default: return false;
    }
  }

  const db = {
    insert: () => ({
      values: async (row: any) => {
        state.authSessions.set(row.id, {
          revokedAt: null,
          lastUsedAt: null,
          ...row,
          createdAt: row.createdAt ?? new Date(),
        });
      },
    }),
    query: {
      authSessions: {
        findFirst: async ({ where }: { where: any }) => {
          for (const row of state.authSessions.values()) if (matches(row, where)) return row;
          return undefined;
        },
      },
      users: {
        findFirst: async ({ where }: { where: any }) => {
          for (const row of state.users.values()) if (matches(row, where)) return row;
          return undefined;
        },
      },
    },
    update: () => ({
      set: (patch: any) => ({
        where: (where: any) => {
          const apply = async () => {
            const matched: Array<{ id: string }> = [];
            for (const [id, row] of state.authSessions) {
              if (matches(row, where)) {
                Object.assign(row, patch);
                matched.push({ id });
              }
            }
            return matched;
          };
          return {
            returning: apply,
            // 让 where(...) 本身也可 await（revokeSession/revokeAllUserSessions 不调 returning）
            then: (resolve: (v: unknown) => void) => { apply().then(resolve); },
          };
        },
      }),
    }),
  };

  return { db, authSessions, users };
});

import {
  createSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
  resolveSessionFromAccessToken,
  RefreshTokenError,
} from '@/lib/auth/session-service';
import { signAccessToken, verifyAccessToken } from '@/lib/auth/token';
import { hashRefreshToken } from '@/lib/auth/refresh-token';

const TEST_SECRET = 'test-access-token-secret-that-is-long-enough-for-hs256';

describe('双 token 完整状态机（集成）', () => {
  beforeEach(() => {
    state.authSessions.clear();
    state.users.clear();
    state.users.set('u-1', {
      id: 'u-1',
      username: 'alice',
      userSlug: 'alice',
      displayName: 'Alice',
      email: 'alice@example.com',
      role: 'developer',
      avatarUrl: null,
    });
  });

  it('登录 → 验签补全 → 刷新轮换 → 登出 全链路', async () => {
    // 1. 登录：创建会话，refresh token 哈希落库，签发 access token
    const { sessionId, refreshToken } = await createSession('u-1', { userAgent: 'UA', ip: '1.2.3.4' });
    expect(state.authSessions.size).toBe(1);

    const stored = state.authSessions.get(sessionId);
    expect(stored.refreshTokenHash).toBe(hashRefreshToken(refreshToken)); // 哈希落库
    expect(stored.refreshTokenHash).not.toBe(refreshToken); // 非明文
    expect(stored.userAgent).toBe('UA');
    expect(stored.ip).toBe('1.2.3.4');

    const accessToken = await signAccessToken({ userId: 'u-1', role: 'developer', sessionId }, TEST_SECRET);

    // 2. 验签 + 查库补全：access token 只含 userId/role/sessionId，email/username 从 users 补全
    const session = await resolveSessionFromAccessToken(accessToken, TEST_SECRET);
    expect(session?.userId).toBe('u-1');
    expect(session?.email).toBe('alice@example.com');
    expect(session?.username).toBe('alice');
    expect(session?.role).toBe('developer');

    // 3. 刷新轮换：旧 token → 新 token，DB 里 hash 被替换
    const rotated = await rotateRefreshToken(refreshToken);
    expect(rotated.refreshToken).not.toBe(refreshToken);
    expect(state.authSessions.get(sessionId).refreshTokenHash).toBe(hashRefreshToken(rotated.refreshToken));
    expect(state.authSessions.get(sessionId).lastUsedAt).toBeInstanceOf(Date);

    // 4. 轮换后旧 token 失效（hash 已被替换，unknown）
    await expect(rotateRefreshToken(refreshToken)).rejects.toThrow(RefreshTokenError);

    // 5. 登出：软删除（revokedAt 非空，hash 保留）
    await revokeSession(sessionId);
    expect(state.authSessions.get(sessionId).revokedAt).toBeInstanceOf(Date);
  });

  it('复用已吊销的 refresh token → 吊销该用户全部会话', async () => {
    const s1 = await createSession('u-1');
    const s2 = await createSession('u-1');
    expect(state.authSessions.size).toBe(2);

    // 吊销 s1（软删除：hash 还在，revokedAt 非空）
    await revokeSession(s1.sessionId);

    // 复用 s1 的 token → revoked 分支 → 吊销 u-1 整个家族
    await expect(rotateRefreshToken(s1.refreshToken)).rejects.toThrow(RefreshTokenError);

    expect(state.authSessions.get(s1.sessionId).revokedAt).toBeInstanceOf(Date);
    expect(state.authSessions.get(s2.sessionId).revokedAt).toBeInstanceOf(Date); // s2 一并被吊销
  });

  it('revokeAllUserSessions 可排除当前会话（改密码保留当前登录）', async () => {
    const s1 = await createSession('u-1');
    const s2 = await createSession('u-1');

    await revokeAllUserSessions('u-1', { exceptSessionId: s1.sessionId });

    expect(state.authSessions.get(s1.sessionId).revokedAt).toBeNull();
    expect(state.authSessions.get(s2.sessionId).revokedAt).toBeInstanceOf(Date);
  });

  it('verifyAccessToken 拒绝篡改 / 错误密钥的 token', async () => {
    const { sessionId } = await createSession('u-1');
    const token = await signAccessToken({ userId: 'u-1', role: 'developer', sessionId }, TEST_SECRET);

    expect(await verifyAccessToken(token, TEST_SECRET)).not.toBeNull();
    expect(await verifyAccessToken(token.slice(0, -3) + 'abc', TEST_SECRET)).toBeNull();
    expect(await verifyAccessToken(token, 'wrong-secret-wrong-secret-wrong-secret')).toBeNull();
  });
});
