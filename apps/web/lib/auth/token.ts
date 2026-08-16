import { SignJWT, jwtVerify, base64url } from 'jose';
import type { AccessTokenPayload } from './types';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 分钟
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天

const HS256_KEY_BYTES = 32;

/**
 * 解析签名密钥为 32 字节。优先按 base64url 解码（若恰为 32 字节），
 * 否则按 UTF-8 文本编码并补零/截断到 32 字节（与 jwe.ts 的 getSecret 一致）。
 */
function resolveSecret(secret: string): Uint8Array {
  try {
    const decoded = base64url.decode(secret);
    if (decoded.length === HS256_KEY_BYTES) {
      return decoded;
    }
  } catch {
    // 非 base64url，走文本编码
  }

  const encoded = new TextEncoder().encode(secret);
  if (encoded.length >= HS256_KEY_BYTES) {
    return encoded.slice(0, HS256_KEY_BYTES);
  }
  const padded = new Uint8Array(HS256_KEY_BYTES);
  padded.set(encoded);
  return padded;
}

function getAccessTokenSecret(secretOverride?: string): Uint8Array {
  const secret = secretOverride ?? process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET environment variable is not set');
  }
  return resolveSecret(secret);
}

/** 签发 15 分钟有效的 HS256 access token，payload 不含 email 等敏感字段。 */
export async function signAccessToken(
  claims: { userId: string; role: string; sessionId: string },
  secretOverride?: string,
): Promise<string> {
  const secret = getAccessTokenSecret(secretOverride);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    userId: claims.userId,
    role: claims.role,
    sessionId: claims.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secret);
}

/** 验签 access token；无效/过期/篡改一律返回 null（不区分原因，防信息泄露）。 */
export async function verifyAccessToken(
  token: string,
  secretOverride?: string,
): Promise<AccessTokenPayload | null> {
  try {
    const secret = getAccessTokenSecret(secretOverride);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    if (
      typeof payload.userId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.sessionId !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
      sessionId: payload.sessionId,
      iat: typeof payload.iat === 'number' ? payload.iat : 0,
      exp: typeof payload.exp === 'number' ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}
