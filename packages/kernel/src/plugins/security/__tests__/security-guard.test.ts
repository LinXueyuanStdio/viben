import { describe, it, expect, vi } from 'vitest';
import { SecurityGuard } from '../security-guard.js';
import type { SecurityConfig } from '../security-guard.js';

function mockSessionManager(sessions: Array<{ status: string }> = []) {
  return { listSessions: () => sessions };
}

describe('SecurityGuard', () => {
  describe('checkAccess', () => {
    it('allows all users when allowedUserIds is empty', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: [],
        maxConcurrentSessions: 20,
      });
      const guard = new SecurityGuard(getConfig, mockSessionManager());
      const result = await guard.checkAccess({ userId: 'anyone' });
      expect(result).toEqual({ allowed: true });
    });

    it('blocks unauthorized users', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: ['123', '456'],
        maxConcurrentSessions: 20,
      });
      const guard = new SecurityGuard(getConfig, mockSessionManager());
      const result = await guard.checkAccess({ userId: '789' });
      expect(result).toEqual({ allowed: false, reason: 'Unauthorized user' });
    });

    it('allows authorized users (numeric userId coerced to string)', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: ['123'],
        maxConcurrentSessions: 20,
      });
      const guard = new SecurityGuard(getConfig, mockSessionManager());
      const result = await guard.checkAccess({ userId: 123 });
      expect(result).toEqual({ allowed: true });
    });

    it('blocks when session limit reached (exact boundary)', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: [],
        maxConcurrentSessions: 2,
      });
      const sessions = [{ status: 'active' }, { status: 'active' }];
      const guard = new SecurityGuard(getConfig, mockSessionManager(sessions));
      const result = await guard.checkAccess({ userId: '1' });
      expect(result).toEqual({ allowed: false, reason: 'Session limit reached (2)' });
    });

    it('allows when under session limit (one below boundary)', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: [],
        maxConcurrentSessions: 2,
      });
      const guard = new SecurityGuard(getConfig, mockSessionManager([{ status: 'active' }]));
      const result = await guard.checkAccess({ userId: '1' });
      expect(result).toEqual({ allowed: true });
    });

    it('ignores finished/error/cancelled sessions in limit count', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: [],
        maxConcurrentSessions: 1,
      });
      const sessions = [{ status: 'finished' }, { status: 'error' }, { status: 'cancelled' }];
      const guard = new SecurityGuard(getConfig, mockSessionManager(sessions));
      const result = await guard.checkAccess({ userId: '1' });
      expect(result).toEqual({ allowed: true });
    });

    it('counts initializing sessions toward the limit', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: [],
        maxConcurrentSessions: 1,
      });
      const guard = new SecurityGuard(getConfig, mockSessionManager([{ status: 'initializing' }]));
      const result = await guard.checkAccess({ userId: '1' });
      expect(result).toEqual({ allowed: false, reason: 'Session limit reached (1)' });
    });

    it('reads config on EACH checkAccess call (live settings)', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>()
        .mockResolvedValueOnce({ allowedUserIds: ['1'], maxConcurrentSessions: 20 })
        .mockResolvedValueOnce({ allowedUserIds: [], maxConcurrentSessions: 20 });

      const guard = new SecurityGuard(getConfig, mockSessionManager());

      const r1 = await guard.checkAccess({ userId: '999' });
      expect(r1.allowed).toBe(false);

      const r2 = await guard.checkAccess({ userId: '999' });
      expect(r2.allowed).toBe(true);

      expect(getConfig).toHaveBeenCalledTimes(2);
    });

    it('uses defaults when config returns unexpected types', async () => {
      const getConfig = vi.fn<() => Promise<SecurityConfig>>().mockResolvedValue({
        allowedUserIds: undefined as any,
        maxConcurrentSessions: undefined as any,
      });
      const guard = new SecurityGuard(getConfig, mockSessionManager());
      const result = await guard.checkAccess({ userId: '1' });
      expect(result).toEqual({ allowed: true });
    });
  });
});
