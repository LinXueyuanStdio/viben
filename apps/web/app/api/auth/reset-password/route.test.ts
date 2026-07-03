/**
 * 重置密码 API 端到端测试
 *
 * 测试流程：
 * 1. 有效 token → 200，密码被更新
 * 2. 无效/过期 token → 400
 * 3. 用户不存在 → 400
 * 4. 输入验证（密码太短、密码不匹配）→ 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeResetToken: vi.fn().mockReturnValue('test@example.com'),
  hashPassword: vi.fn().mockResolvedValue('new_hashed_password_789'),
  selectResult: null as any[],
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/auth/reset-tokens', () => ({
  consumeResetToken: mocks.consumeResetToken,
}));

vi.mock('@/lib/auth/password', () => ({
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
    email: 'email',
  },
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeResetToken.mockReturnValue('test@example.com');
    mocks.hashPassword.mockResolvedValue('new_hashed_password_789');
    mockSelectFn = vi.fn(() => createSelectChain([{
      id: 'user-001',
      email: 'test@example.com',
    }]));
  });

  describe('成功重置密码', () => {
    it('有效 token + 匹配的密码应返回 200', async () => {
      const res = await POST(createRequest({
        token: 'valid-reset-token-123',
        password: 'newsecurepassword',
        confirmPassword: 'newsecurepassword',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Password has been reset successfully.');

      // 验证 token 被消费
      expect(mocks.consumeResetToken).toHaveBeenCalledWith('valid-reset-token-123');

      // 验证密码被哈希并更新
      expect(mocks.hashPassword).toHaveBeenCalledWith('newsecurepassword');
      expect(mocks.updateSet).toHaveBeenCalledWith({
        passwordHash: 'new_hashed_password_789',
      });
    });
  });

  describe('Token 验证', () => {
    it('无效的 token 应返回 400', async () => {
      mocks.consumeResetToken.mockReturnValue(null);

      const res = await POST(createRequest({
        token: 'invalid-or-expired-token',
        password: 'newsecurepassword',
        confirmPassword: 'newsecurepassword',
      }));

      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid or expired reset token');
      expect(mocks.hashPassword).not.toHaveBeenCalled();
    });

    it('过期的 token 应返回 400', async () => {
      // consumeResetToken 对过期 token 也返回 null
      mocks.consumeResetToken.mockReturnValue(null);

      const res = await POST(createRequest({
        token: 'expired-token',
        password: 'newsecurepassword',
        confirmPassword: 'newsecurepassword',
      }));

      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid or expired reset token');
    });
  });

  describe('用户查找', () => {
    it('token 对应的用户不存在应返回 400', async () => {
      // token 有效但用户已被删除
      mocks.consumeResetToken.mockReturnValue('deleted@example.com');
      mockSelectFn = vi.fn(() => createSelectChain([]));

      const res = await POST(createRequest({
        token: 'valid-token-for-deleted-user',
        password: 'newsecurepassword',
        confirmPassword: 'newsecurepassword',
      }));

      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('User not found');
    });
  });

  describe('输入验证', () => {
    it('缺少 token 应返回 400', async () => {
      const res = await POST(createRequest({
        password: 'newsecurepassword',
        confirmPassword: 'newsecurepassword',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('密码少于 8 个字符应返回 400', async () => {
      const res = await POST(createRequest({
        token: 'valid-token',
        password: 'short',
        confirmPassword: 'short',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('密码不匹配应返回 400', async () => {
      const res = await POST(createRequest({
        token: 'valid-token',
        password: 'password123',
        confirmPassword: 'different456',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('缺少 confirmPassword 应返回 400', async () => {
      const res = await POST(createRequest({
        token: 'valid-token',
        password: 'password123',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });
  });

  describe('一次性的 token', () => {
    it('token 只能使用一次', async () => {
      // 第一次使用成功
      mocks.consumeResetToken.mockReturnValue('test@example.com');
      const res1 = await POST(createRequest({
        token: 'one-time-token',
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      }));
      expect(res1.status).toBe(200);

      // 第二次使用失败（token 已被消费）
      mocks.consumeResetToken.mockReturnValue(null);
      const res2 = await POST(createRequest({
        token: 'one-time-token',
        password: 'anotherpassword123',
        confirmPassword: 'anotherpassword123',
      }));
      expect(res2.status).toBe(400);
      const data = await res2.json();
      expect(data.error).toBe('Invalid or expired reset token');
    });
  });
});
