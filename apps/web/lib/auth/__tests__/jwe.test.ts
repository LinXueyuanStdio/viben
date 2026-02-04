/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import { encryptSession, decryptSession } from '../jwe';

const mockSession = {
  userId: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
};

const mockAdminSession = {
  userId: 'admin-123',
  username: 'adminuser',
  email: 'admin@example.com',
  role: 'admin' as const,
};

describe('encryptSession', () => {
  it('should encrypt a session', async () => {
    const token = await encryptSession(mockSession);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should produce different tokens for same session', async () => {
    const token1 = await encryptSession(mockSession);
    const token2 = await encryptSession(mockSession);

    // JWE tokens include timestamp so they should differ
    expect(token1).not.toBe(token2);
  });

  it('should handle admin role', async () => {
    const token = await encryptSession(mockAdminSession);
    expect(token).toBeDefined();
  });
});

describe('decryptSession', () => {
  it('should decrypt a valid session', async () => {
    const token = await encryptSession(mockSession);
    const decrypted = await decryptSession(token);

    expect(decrypted).not.toBeNull();
    expect(decrypted?.userId).toBe(mockSession.userId);
    expect(decrypted?.username).toBe(mockSession.username);
    expect(decrypted?.email).toBe(mockSession.email);
    expect(decrypted?.role).toBe(mockSession.role);
  });

  it('should include expiresAt after decryption', async () => {
    const token = await encryptSession(mockSession);
    const decrypted = await decryptSession(token);

    expect(decrypted?.expiresAt).toBeDefined();
    expect(decrypted?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should return null for invalid token', async () => {
    const result = await decryptSession('invalid-token');
    expect(result).toBeNull();
  });

  it('should return null for empty token', async () => {
    const result = await decryptSession('');
    expect(result).toBeNull();
  });

  it('should return null for expired session', async () => {
    const token = await encryptSession(mockSession);

    // Mock Date.now to be in the future (past expiration)
    const futureTime = Date.now() + 8 * 24 * 60 * 60 * 1000; // 8 days in future
    vi.spyOn(Date, 'now').mockReturnValue(futureTime);

    const result = await decryptSession(token);

    vi.spyOn(Date, 'now').mockRestore();

    expect(result).toBeNull();
  });

  it('should return null for tampered token', async () => {
    const token = await encryptSession(mockSession);
    const tamperedToken = token.slice(0, -5) + 'xxxxx';

    const result = await decryptSession(tamperedToken);
    expect(result).toBeNull();
  });

  it('should preserve all session data', async () => {
    const token = await encryptSession(mockAdminSession);
    const decrypted = await decryptSession(token);

    expect(decrypted?.userId).toBe('admin-123');
    expect(decrypted?.username).toBe('adminuser');
    expect(decrypted?.email).toBe('admin@example.com');
    expect(decrypted?.role).toBe('admin');
  });
});

describe('session roundtrip', () => {
  it('should handle multiple encrypt/decrypt cycles', async () => {
    // First cycle
    const token1 = await encryptSession(mockSession);
    const decrypted1 = await decryptSession(token1);
    expect(decrypted1?.userId).toBe(mockSession.userId);

    // Second cycle with decrypted data (excluding expiresAt)
    const token2 = await encryptSession({
      userId: decrypted1!.userId,
      username: decrypted1!.username,
      email: decrypted1!.email,
      role: decrypted1!.role,
    });
    const decrypted2 = await decryptSession(token2);
    expect(decrypted2?.userId).toBe(mockSession.userId);
  });
});
