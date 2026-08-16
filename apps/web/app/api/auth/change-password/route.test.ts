/**
 * 修改密码 API 端到端测试
 *
 * 测试流程：
 * 1. 成功修改密码 → 200，验证旧密码后更新为新密码
 * 2. 错误的当前密码 → 400
 * 3. 未登录用户 → 401
 * 4. OAuth 账户无密码 → 400
 * 5. 无效输入（密码太短等）→ 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuthResult: null as any,
  requireAuthError: null as Error | null,
  verifyPassword: vi.fn().mockResolvedValue(true),
  hashPassword: vi.fn().mockResolvedValue('new_hashed_password_456'),
  selectResult: null as any[],
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  AuthError: class AuthError extends Error {
    public status: number;
    constructor(message: string, status = 401) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
    }
  },
}));

vi.mock('@/lib/auth/middleware', () => ({
  AuthError: mocks.AuthError,
  requireAuth: vi.fn(() => {
    if (mocks.requireAuthError) throw mocks.requireAuthError;
    return mocks.requireAuthResult;
  }),
}));

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: mocks.verifyPassword,
  hashPassword: mocks.hashPassword,
}));

function createSelectChain(result: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

let mockSelectFn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockSelectFn()),
    update: vi.fn(() => ({
      set: mocks.updateSet.mockReturnValue({
        where: mocks.updateWhere,
      }),
    })),
  },
  users: {
    id: 'id',
    passwordHash: 'passwordHash',
  },
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthError = null;
    mocks.requireAuthResult = {
      userId: 'user-001',
      username: 'testuser',
      userSlug: 'testuser',
      email: 'test@example.com',
      role: 'developer',
      expiresAt: 0,
    };
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue('new_hashed_password_456');
    mockSelectFn = vi.fn(() => createSelectChain([{
      id: 'user-001',
      passwordHash: 'old_hashed_password_123',
    }]));
  });

  describe('成功修改密码', () => {
    it('正确的旧密码 + 有效新密码应返回 200', async () => {
      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证旧密码被检查
      expect(mocks.verifyPassword).toHaveBeenCalledWith(
        'oldpassword',
        'old_hashed_password_123'
      );

      // 验证新密码被哈希并更新
      expect(mocks.hashPassword).toHaveBeenCalledWith('newpassword123');
      expect(mocks.updateSet).toHaveBeenCalledWith({
        passwordHash: 'new_hashed_password_456',
      });
    });
  });

  describe('密码修改失败', () => {
    it('错误的当前密码应返回 400', async () => {
      mocks.verifyPassword.mockResolvedValue(false);

      const res = await POST(createRequest({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      }));

      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Current password is incorrect');
      expect(mocks.hashPassword).not.toHaveBeenCalled();
      expect(mocks.updateSet).not.toHaveBeenCalled();
    });

    it('用户无密码哈希（OAuth 账户）应直接设置密码并返回 200', async () => {
      mockSelectFn = vi.fn(() => createSelectChain([{
        id: 'user-001',
        passwordHash: null,
      }]));

      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mocks.verifyPassword).not.toHaveBeenCalled();
      expect(mocks.hashPassword).toHaveBeenCalledWith('newpassword123');
    });

    it('用户不存在应返回 404', async () => {
      mockSelectFn = vi.fn(() => createSelectChain([]));

      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }));

      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('User not found');
    });
  });

  describe('认证检查', () => {
    it('未登录用户应返回 401', async () => {
      mocks.requireAuthError = new mocks.AuthError('Unauthorized', 401);

      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }));

      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('session 过期应返回 401', async () => {
      mocks.requireAuthError = new mocks.AuthError('Session expired', 401);

      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }));

      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Session expired');
    });
  });

  describe('输入验证', () => {
    it('缺少 currentPassword 应返回 400', async () => {
      const res = await POST(createRequest({
        newPassword: 'newpassword123',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Current password is required');
    });

    it('缺少 newPassword 应返回 400', async () => {
      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('新密码少于 8 个字符应返回 400', async () => {
      const res = await POST(createRequest({
        currentPassword: 'oldpassword',
        newPassword: 'short',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });
  });
});
