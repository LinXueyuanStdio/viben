/**
 * 登录 API 端到端测试
 *
 * 测试流程：
 * 1. 成功登录 → 200，设置 session cookie
 * 2. 错误密码 → 401
 * 3. 不存在的用户 → 401
 * 4. 无效输入 → 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
  setAuthCookies: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn().mockResolvedValue({ sessionId: 's-1', refreshToken: 'rt-1' }),
  findFirstResult: null as any,
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: mocks.verifyPassword,
}));

vi.mock('@/lib/auth/cookies', () => ({
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock('@/lib/auth/session-service', () => ({
  createSession: mocks.createSession,
}));

const mockUpdateChain = {
  set: mocks.updateSet.mockReturnValue({
    where: mocks.updateWhere,
  }),
};

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(() => mocks.findFirstResult),
      },
    },
    update: vi.fn(() => mockUpdateChain),
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
    lastLoginAt: 'lastLoginAt',
  },
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.findFirstResult = {
      id: 'user-001',
      email: 'test@example.com',
      username: 'testuser',
      userSlug: 'testuser',
      displayName: 'Test User',
      passwordHash: 'hashed_password_xyz',
      role: 'developer',
      avatarUrl: null,
    };
  });

  describe('成功登录', () => {
    it('正确的邮箱密码应返回 200 并设置 session', async () => {
      const res = await POST(createRequest({
        email: 'test@example.com',
        password: 'password123',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证密码
      expect(mocks.verifyPassword).toHaveBeenCalledWith(
        'password123',
        'hashed_password_xyz'
      );

      // 验证创建了会话并设置了双 token cookie
      expect(mocks.createSession).toHaveBeenCalledWith('user-001', expect.any(Object));
      expect(mocks.setAuthCookies).toHaveBeenCalledWith(
        { userId: 'user-001', role: 'developer', sessionId: 's-1' },
        'rt-1'
      );

      // 验证更新了最后登录时间
      expect(mocks.updateSet).toHaveBeenCalled();
      expect(mocks.updateWhere).toHaveBeenCalled();
    });
  });

  describe('登录失败', () => {
    it('错误密码应返回 401', async () => {
      mocks.verifyPassword.mockResolvedValue(false);

      const res = await POST(createRequest({
        email: 'test@example.com',
        password: 'wrongpassword',
      }));

      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
      expect(mocks.setAuthCookies).not.toHaveBeenCalled();
    });

    it('不存在的用户应返回 401', async () => {
      mocks.findFirstResult = null;

      const res = await POST(createRequest({
        email: 'nonexistent@example.com',
        password: 'password123',
      }));

      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
      expect(mocks.setAuthCookies).not.toHaveBeenCalled();
    });

    it('无密码哈希的用户（OAuth 账户）应返回 401', async () => {
      mocks.findFirstResult = {
        id: 'user-002',
        email: 'oauth@example.com',
        username: 'oauthuser',
        userSlug: 'oauthuser',
        passwordHash: null, // OAuth 用户没有密码
      };

      const res = await POST(createRequest({
        email: 'oauth@example.com',
        password: 'password123',
      }));

      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('输入验证', () => {
    it('缺少 email 应返回 400', async () => {
      const res = await POST(createRequest({
        password: 'password123',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('缺少 password 应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'test@example.com',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('无效的邮箱格式应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'invalid',
        password: 'password123',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });
  });
});
