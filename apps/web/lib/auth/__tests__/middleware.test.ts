import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api-key', () => ({
  validateApiKey: vi.fn(),
}));

vi.mock('../jwe', () => ({
  decryptSession: vi.fn(),
}));

vi.mock('../session-service', () => ({
  resolveSessionFromAccessToken: vi.fn(),
}));

import { requireAuth, AuthError } from '../middleware';
import { validateApiKey } from '../api-key';
import { decryptSession } from '../jwe';
import { resolveSessionFromAccessToken } from '../session-service';

function createMockRequest(options: {
  authorization?: string;
  accessTokenCookie?: string;
}): Request {
  const headers = new Headers();
  if (options.authorization) {
    headers.set('authorization', options.authorization);
  }

  const request = {
    headers,
    cookies: {
      get: (name: string) => {
        if (name === 'access_token' && options.accessTokenCookie) {
          return { value: options.accessTokenCookie };
        }
        return undefined;
      },
    },
  } as unknown as Request;

  return request;
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate with valid Bearer token (API key)', async () => {
    const mockUser = {
      id: 'user_123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
    };
    vi.mocked(validateApiKey).mockResolvedValue(mockUser as any);

    const request = createMockRequest({
      authorization: 'Bearer bmcp_12345678_abcdefghijklmnopqrstuvwx',
    });

    const session = await requireAuth(request as any);

    expect(session.userId).toBe('user_123');
    expect(session.username).toBe('testuser');
    expect(session.email).toBe('test@example.com');
    expect(validateApiKey).toHaveBeenCalledWith('bmcp_12345678_abcdefghijklmnopqrstuvwx');
  });

  it('should throw AuthError for invalid Bearer token', async () => {
    vi.mocked(validateApiKey).mockResolvedValue(null);

    const request = createMockRequest({
      authorization: 'Bearer invalid_token',
    });

    await expect(requireAuth(request as any)).rejects.toThrow(AuthError);
    await expect(requireAuth(request as any)).rejects.toThrow('Invalid token');
  });

  it('should fall back to access token cookie when no Bearer token', async () => {
    const mockSession = {
      userId: 'user_456',
      username: 'cookieuser',
      email: 'cookie@example.com',
      role: 'user',
      expiresAt: Date.now() + 3600000,
    };
    vi.mocked(resolveSessionFromAccessToken).mockResolvedValue(mockSession as any);

    const request = createMockRequest({
      accessTokenCookie: 'access_token_value',
    });

    const session = await requireAuth(request as any);

    expect(session.userId).toBe('user_456');
    expect(resolveSessionFromAccessToken).toHaveBeenCalledWith('access_token_value');
    expect(validateApiKey).not.toHaveBeenCalled();
  });

  it('should throw Unauthorized when no auth provided', async () => {
    const request = createMockRequest({});

    await expect(requireAuth(request as any)).rejects.toThrow(AuthError);
    await expect(requireAuth(request as any)).rejects.toThrow('Unauthorized');
  });
});
