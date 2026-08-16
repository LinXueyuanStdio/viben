/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from '../token';
import { generateRefreshToken, hashRefreshToken } from '../refresh-token';

const TEST_SECRET = 'test-access-token-secret-that-is-long-enough-for-hs256';

describe('signAccessToken / verifyAccessToken', () => {
  const claims = { userId: 'u-1', role: 'developer', sessionId: 's-1' };

  it('round-trips claims', async () => {
    const token = await signAccessToken(claims, TEST_SECRET);
    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u-1');
    expect(payload?.role).toBe('developer');
    expect(payload?.sessionId).toBe('s-1');
  });

  it('sets exp to now + 15min', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await signAccessToken(claims, TEST_SECRET);
    const payload = await verifyAccessToken(token, TEST_SECRET);
    expect(payload!.exp).toBeGreaterThanOrEqual(before + ACCESS_TOKEN_TTL_SECONDS - 5);
    expect(payload!.exp).toBeLessThanOrEqual(before + ACCESS_TOKEN_TTL_SECONDS + 5);
  });

  it('returns null for tampered token', async () => {
    const token = await signAccessToken(claims, TEST_SECRET);
    const tampered = token.slice(0, -3) + 'abc';
    expect(await verifyAccessToken(tampered, TEST_SECRET)).toBeNull();
  });

  it('returns null when signed with a different secret', async () => {
    const token = await signAccessToken(claims, TEST_SECRET);
    expect(await verifyAccessToken(token, 'a-completely-different-secret-value')).toBeNull();
  });

  it('returns null for garbage', async () => {
    expect(await verifyAccessToken('not-a-jwt', TEST_SECRET)).toBeNull();
  });
});

describe('refresh token helpers', () => {
  it('generates url-safe base64url token of 43 chars (32 bytes)', () => {
    const t = generateRefreshToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generates unique tokens', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it('hashes deterministically with sha256 hex', () => {
    const t = 'abc';
    expect(hashRefreshToken(t)).toBe(hashRefreshToken(t));
    expect(hashRefreshToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(t)).not.toBe(hashRefreshToken('abd'));
  });
});
