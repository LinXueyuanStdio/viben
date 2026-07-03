/**
 * 忘记密码 API 端到端测试
 *
 * 测试流程：
 * 1. 存在的邮箱 → 200，生成 reset token（始终返回成功防止邮箱枚举）
 * 2. 不存在的邮箱 → 200，同样返回成功
 * 3. 无效输入 → 400
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirstResult: null as any,
  storeResetToken: vi.fn(),
}));

vi.mock('@/lib/auth/reset-tokens', () => ({
  storeResetToken: mocks.storeResetToken,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(() => mocks.findFirstResult),
      },
    },
  },
  users: {
    id: 'id',
    email: 'email',
  },
}));

import { POST } from './route';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirstResult = null;
  });

  describe('成功请求（防邮箱枚举）', () => {
    it('存在的邮箱应返回 200 并生成 token', async () => {
      mocks.findFirstResult = {
        id: 'user-001',
        email: 'test@example.com',
      };

      const res = await POST(createRequest({
        email: 'test@example.com',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('password reset link has been sent');
      expect(mocks.storeResetToken).toHaveBeenCalled();
      // 第二个参数是 email
      expect(mocks.storeResetToken.mock.calls[0][1]).toBe('test@example.com');
    });

    it('不存在的邮箱也应返回 200（防止邮箱枚举攻击）', async () => {
      mocks.findFirstResult = null;

      const res = await POST(createRequest({
        email: 'nonexistent@example.com',
      }));

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('password reset link has been sent');

      // 不存在的邮箱不应生成 token
      expect(mocks.storeResetToken).not.toHaveBeenCalled();
    });
  });

  describe('输入验证', () => {
    it('缺少 email 应返回 400', async () => {
      const res = await POST(createRequest({}));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('无效的邮箱格式应返回 400', async () => {
      const res = await POST(createRequest({
        email: 'not-an-email',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });

    it('空字符串邮箱应返回 400', async () => {
      const res = await POST(createRequest({
        email: '',
      }));

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid input');
    });
  });
});
