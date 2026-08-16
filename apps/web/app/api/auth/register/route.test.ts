/**
 * 注册 API 端到端测试
 *
 * 测试流程：
 * 1. 成功注册新用户 → 200，创建用户并设置 session cookie
 * 2. 重复邮箱注册 → 400
 * 3. 重复用户名注册 → 400
 * 4. 无效输入（缺少字段、邮箱格式错误、密码太短）→ 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password_123'),
  setAuthCookies: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn().mockResolvedValue({ sessionId: 's-1', refreshToken: 'rt-1' }),
  findFirstResult: null as any,
  insertValues: vi.fn().mockResolvedValue(undefined),
  normalizeUserSlug: vi.fn((name: string) => name.toLowerCase()),
  generateId: vi.fn().mockReturnValue('new-user-id-001'),
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: mocks.hashPassword,
}));

vi.mock('@/lib/auth/cookies', () => ({
  setAuthCookies: mocks.setAuthCookies,
}));

vi.mock('@/lib/auth/session-service', () => ({
  createSession: mocks.createSession,
}));

vi.mock('@/lib/utils/user-slug', () => ({
  normalizeUserSlug: mocks.normalizeUserSlug,
  isReservedSlug: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/utils', () => ({
  generateId: mocks.generateId,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(() => mocks.findFirstResult),
      },
    },
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
  users: {
    id: 'id',
    email: 'email',
    username: 'username',
    userSlug: 'userSlug',
    displayName: 'displayName',
    passwordHash: 'passwordHash',
    role: 'role',
  },
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirstResult = null; // 默认：用户不存在
    mocks.hashPassword.mockResolvedValue('hashed_password_123');
  });

  describe('成功注册', () => {
    it('应该成功创建新用户并设置 session', async () => {
      const res = await POST(createRequest({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.userId).toBe('new-user-id-001');

      // 验证调用了 hashPassword
      expect(mocks.hashPassword).toHaveBeenCalledWith('password123');

      // 验证创建了会话并设置了双 token cookie
      expect(mocks.createSession).toHaveBeenCalledWith('new-user-id-001', expect.any(Object));
      expect(mocks.setAuthCookies).toHaveBeenCalledWith(
        { userId: 'new-user-id-001', role: 'developer', sessionId: 's-1' },
        'rt-1'
      );

      // 验证插入了数据库
      expect(mocks.insertValues).toHaveBeenCalledWith({
        id: 'new-user-id-001',
        email: 'test@example.com',
        username: 'testuser',
        userSlug: 'testuser',
        displayName: 'Test User',
        passwordHash: 'hashed_password_123',
        role: 'developer',
      });
    });
  });

  describe('重复检测', () => {
    it('已存在的邮箱应返回 400', async () => {
      mocks.findFirstResult = {
        id: 'existing-id',
        email: 'test@example.com',
        username: 'otheruser',
      };

      const res = await POST(createRequest({
        email: 'test@example.com',
        username: 'newuser',
        password: 'password123',
        displayName: 'New User',
      }));

      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Email or username already taken');
      expect(mocks.insertValues).not.toHaveBeenCalled();
      expect(mocks.setAuthCookies).not.toHaveBeenCalled();
    });

    it('已存在的用户名应返回 400', async () => {
      mocks.findFirstResult = {
        id: 'existing-id',
        email: 'other@example.com',
        username: 'testuser',
      };

      const res = await POST(createRequest({
        email: 'new@example.com',
        username: 'testuser',
        password: 'password123',
        displayName: 'New User',
      }));

      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Email or username already taken');
    });
  });

  describe('输入验证', () => {
    it('缺少 email 应返回 400', async () => {
      const res = await POST(createRequest({
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('无效的邮箱格式应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'not-an-email',
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('密码少于 8 个字符应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'test@example.com',
        username: 'testuser',
        password: 'short',
        displayName: 'Test User',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('用户名少于 3 个字符应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'test@example.com',
        username: 'ab',
        password: 'password123',
        displayName: 'Test User',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('空的 displayName 应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        displayName: '',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });
  });
});
