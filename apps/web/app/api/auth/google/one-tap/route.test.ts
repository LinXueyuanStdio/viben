/**
 * Google One Tap API 端到端测试
 *
 * 测试流程：
 * 1. 有效 credential → 200，新用户创建 + session 设置
 * 2. 有效 credential + 已有 OAuth 连接 → 200，复用用户
 * 3. 有效 credential + 已有邮箱用户 → 200，链接 OAuth
 * 4. 无效 credential（Google tokeninfo 返回错误）→ 400
 * 5. audience 不匹配 → 400
 * 6. 邮箱未验证 → 400
 * 7. 缺少 credential → 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  // Google tokeninfo 响应数据
  validTokenInfo: {
    iss: 'https://accounts.google.com',
    azp: 'test-client-id.apps.googleusercontent.com',
    aud: 'test-client-id.apps.googleusercontent.com',
    sub: '1234567890',
    email: 'test@gmail.com',
    email_verified: 'true',
    name: 'Test User',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
    given_name: 'Test',
    family_name: 'User',
    iat: '1700000000',
    exp: '1700003600',
  },

  // fetch mock (for tokeninfo call)
  fetchOk: true,
  fetchStatus: 200,
  fetchJson: null as any,

  // DB mocks — 使用函数以支持每次调用返回不同值
  oauthFindFirstCalls: [] as any[],
  userFindFirstCalls: [] as any[],
  insertOAuthValuesFn: vi.fn().mockResolvedValue(undefined),
  insertUserValuesFn: vi.fn().mockResolvedValue(undefined),

  // 双 token cookie mock
  setAuthCookies: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn().mockResolvedValue({ sessionId: 's-1', refreshToken: 'rt-1' }),

  // uploadImageFromUrl mock
  uploadImageFromUrl: vi.fn().mockResolvedValue(
    'https://lh3.googleusercontent.com/photo.jpg'
  ),

  // generateId mock
  generateId: vi.fn().mockReturnValue('new-user-id'),

  // normalizeUserSlug mock
  normalizeUserSlug: vi.fn((name: string) => name.toLowerCase()),

  // drizzle mocks
  insertOAuth: vi.fn().mockResolvedValue(undefined),
  insertUser: vi.fn().mockResolvedValue(undefined),
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
}));

// ---- mock global fetch ----
vi.stubGlobal('fetch', vi.fn(() => {
  if (!mocks.fetchOk) {
    return Promise.resolve({
      ok: false,
      status: mocks.fetchStatus,
      json: () => Promise.resolve(mocks.fetchJson),
    } as Response);
  }
  return Promise.resolve({
    ok: true,
    status: mocks.fetchStatus,
    json: () => Promise.resolve(mocks.fetchJson),
  } as Response);
}));

// ---- mock modules ----
vi.mock('@/lib/auth/cookies', () => ({
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock('@/lib/auth/session-service', () => ({
  createSession: mocks.createSession,
}));

vi.mock('@/lib/media', () => ({
  uploadImageFromUrl: mocks.uploadImageFromUrl,
}));

vi.mock('@/lib/utils', () => ({
  generateId: mocks.generateId,
}));

vi.mock('@/lib/utils/user-slug', () => ({
  normalizeUserSlug: mocks.normalizeUserSlug,
  isReservedSlug: vi.fn().mockReturnValue(false),
}));

// 用于记录 insert 调用的参数
let lastOAuthInsertValues: Record<string, unknown> | null = null;
let lastUserInsertValues: Record<string, unknown> | null = null;

vi.mock('@/lib/db', () => {
  const oauthConnFindFirst = vi.fn(() => {
    const next = mocks.oauthFindFirstCalls.shift();
    return next !== undefined ? next : null;
  });
  const userFindFirst = vi.fn(() => {
    const next = mocks.userFindFirstCalls.shift();
    return next !== undefined ? next : null;
  });

  return {
    db: {
      query: {
        oauthConnections: {
          findFirst: oauthConnFindFirst,
        },
        users: {
          findFirst: userFindFirst,
        },
      },
      insert: vi.fn((table: Record<string, unknown>) => {
        // 通过检查 table 对象是否有特定字段来区分 users 和 oauthConnections
        const tableKeys = Object.keys(table);
        const isOAuth = tableKeys.includes('provider');
        return {
          values: vi.fn((vals: Record<string, unknown>) => {
            if (isOAuth) {
              lastOAuthInsertValues = vals;
              return mocks.insertOAuthValuesFn(vals);
            } else {
              lastUserInsertValues = vals;
              return mocks.insertUserValuesFn(vals);
            }
          }),
        };
      }),
      update: vi.fn(() => ({
        set: mocks.updateSet.mockReturnValue({
          where: mocks.updateWhere,
        }),
      })),
    },
    users: {
      id: 'id',
      email: 'email',
      username: 'username',
      userSlug: 'userSlug',
      displayName: 'displayName',
      avatarUrl: 'avatarUrl',
      passwordHash: 'passwordHash',
      role: 'role',
      emailVerified: 'emailVerified',
      githubUsername: 'githubUsername',
    },
    oauthConnections: {
      id: 'id',
      userId: 'userId',
      provider: 'provider',
      providerId: 'providerId',
      accessToken: 'accessToken',
      refreshToken: 'refreshToken',
    },
  };
});

// 需要在 mock 之后动态导入路由
import { POST } from './route';

// ---- 环境变量 ----
process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/google/one-tap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// 需要修改 insert mock 以区分 users 和 oauthConnections 表
// 通过在测试中动态控制 mocks 实现

describe('POST /api/auth/google/one-tap', () => {
  const NEW_USER = {
    id: 'new-user-id',
    email: 'test@gmail.com',
    username: 'test',
    userSlug: 'test',
    displayName: 'Test User',
    avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    role: 'developer',
  };

  const EXISTING_USER = {
    id: 'existing-user-id',
    email: 'test@gmail.com',
    username: 'existinguser',
    userSlug: 'existinguser',
    displayName: 'Existing User',
    avatarUrl: null,
    role: 'developer',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lastOAuthInsertValues = null;
    lastUserInsertValues = null;
    // 默认清空队列
    mocks.oauthFindFirstCalls = [];
    mocks.userFindFirstCalls = [];
    // 默认：tokeninfo 正常
    mocks.fetchOk = true;
    mocks.fetchStatus = 200;
    mocks.fetchJson = { ...mocks.validTokenInfo };
    mocks.setAuthCookies.mockResolvedValue(undefined);
    mocks.uploadImageFromUrl.mockResolvedValue('https://lh3.googleusercontent.com/photo.jpg');
    mocks.insertOAuthValuesFn.mockResolvedValue(undefined);
    mocks.insertUserValuesFn.mockResolvedValue(undefined);
    mocks.updateWhere.mockResolvedValue(undefined);
  });

  describe('成功登录', () => {
    it('新用户：有效 credential 应创建用户并返回 200', async () => {
      // oauthConnections.findFirst → null（无已有连接）
      mocks.oauthFindFirstCalls = [null];
      // users.findFirst → null（邮箱不存在）, 然后返回新创建的用户
      mocks.userFindFirstCalls = [null, NEW_USER];

      const res = await POST(createRequest({
        credential: 'valid-google-id-token',
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.userId).toBe('new-user-id');

      // 验证 fetch 调用了 tokeninfo
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://oauth2.googleapis.com/tokeninfo?id_token=')
      );

      // 验证创建了会话并设置了双 token cookie
      expect(mocks.createSession).toHaveBeenCalledWith('new-user-id', expect.any(Object));
      expect(mocks.setAuthCookies).toHaveBeenCalledWith(
        { userId: 'new-user-id', role: 'developer', sessionId: 's-1' },
        'rt-1'
      );

      // 验证插入了用户和 OAuth 连接
      expect(lastUserInsertValues).toBeTruthy();
      expect(lastOAuthInsertValues).toBeTruthy();
    });

    it('已有 OAuth 连接：应复用用户返回 200', async () => {
      mocks.oauthFindFirstCalls = [{
        id: 'connection-1',
        userId: 'existing-user-id',
        provider: 'google',
        providerId: '1234567890',
        accessToken: null,
        user: EXISTING_USER,
      }];

      const res = await POST(createRequest({
        credential: 'valid-google-id-token',
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.userId).toBe('existing-user-id');

      expect(mocks.createSession).toHaveBeenCalledWith('existing-user-id', expect.any(Object));
      expect(mocks.setAuthCookies).toHaveBeenCalledWith(
        { userId: 'existing-user-id', role: 'developer', sessionId: 's-1' },
        'rt-1'
      );
    });

    it('已有邮箱用户：应链接 OAuth 返回 200', async () => {
      // 无 OAuth 连接
      mocks.oauthFindFirstCalls = [null];
      // 邮箱已存在
      mocks.userFindFirstCalls = [EXISTING_USER];

      const res = await POST(createRequest({
        credential: 'valid-google-id-token',
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.userId).toBe('existing-user-id');

      // 验证插入了 OAuth 连接（链接到已有用户）
      expect(lastOAuthInsertValues).toBeTruthy();
      expect(lastOAuthInsertValues!.userId).toBe('existing-user-id');
    });
  });

  describe('验证失败', () => {
    it('无效 credential（tokeninfo 返回错误）应返回 400', async () => {
      mocks.fetchOk = false;
      mocks.fetchStatus = 400;
      mocks.fetchJson = { error: 'invalid_token', error_description: 'Invalid Value' };

      const res = await POST(createRequest({
        credential: 'invalid-token',
      }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid credential');
      expect(mocks.setAuthCookies).not.toHaveBeenCalled();
    });

    it('audience 不匹配应返回 400', async () => {
      mocks.fetchJson = {
        ...mocks.validTokenInfo,
        aud: 'wrong-client-id.apps.googleusercontent.com',
      };

      const res = await POST(createRequest({
        credential: 'valid-google-id-token',
      }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid audience');
    });

    it('邮箱未验证应返回 400', async () => {
      mocks.fetchJson = {
        ...mocks.validTokenInfo,
        email_verified: 'false',
      };

      const res = await POST(createRequest({
        credential: 'valid-google-id-token',
      }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Email not verified');
    });
  });

  describe('输入验证', () => {
    it('缺少 credential 应返回 400', async () => {
      const res = await POST(createRequest({}));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Missing or invalid credential');
    });

    it('credential 为空字符串应返回 400', async () => {
      const res = await POST(createRequest({ credential: '' }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Missing or invalid credential');
    });

    it('credential 为非字符串类型应返回 400', async () => {
      const res = await POST(createRequest({ credential: 12345 }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Missing or invalid credential');
    });
  });
});
