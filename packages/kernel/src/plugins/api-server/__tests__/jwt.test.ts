import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, verifyForRefresh } from '../auth/jwt.js';

const JWT_SECRET = 'test-secret-key-for-jwt-signing';

describe('JWT', () => {
  it('signs a token with correct payload', () => {
    const token = signToken(
      { sub: 'tok_123', role: 'admin', rfd: Math.floor(Date.now() / 1000) + 86400 * 7 },
      JWT_SECRET, '24h',
    );
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifies a valid token', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'operator', rfd }, JWT_SECRET, '24h');
    const payload = verifyToken(token, JWT_SECRET);
    expect(payload.sub).toBe('tok_123');
    expect(payload.role).toBe('operator');
    expect(payload.rfd).toBe(rfd);
  });

  it('rejects a token with wrong secret', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '24h');
    expect(() => verifyToken(token, 'wrong-secret')).toThrow();
  });

  it('verifyForRefresh accepts expired token but checks signature', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '1ms');
    // Token should be expired immediately but verifyForRefresh ignores exp
    const payload = verifyForRefresh(token, JWT_SECRET);
    expect(payload.sub).toBe('tok_123');
  });

  it('verifyForRefresh rejects wrong signature', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken({ sub: 'tok_123', role: 'admin', rfd }, JWT_SECRET, '1ms');
    expect(() => verifyForRefresh(token, 'wrong-secret')).toThrow();
  });

  it('includes scopes in payload when provided', () => {
    const rfd = Math.floor(Date.now() / 1000) + 86400 * 7;
    const token = signToken(
      { sub: 'tok_123', role: 'viewer', scopes: ['sessions:read'], rfd },
      JWT_SECRET, '24h',
    );
    const payload = verifyToken(token, JWT_SECRET);
    expect(payload.scopes).toEqual(['sessions:read']);
  });
});
