import { EncryptJWT, jwtDecrypt, base64url } from 'jose';
import type { Session, SessionPayload } from './types';

const alg = 'dir';
const enc = 'A256GCM';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getSecret(secretOverride?: string): Promise<Uint8Array> {
  const jweSecret = secretOverride ?? process.env.JWE_SECRET;
  if (!jweSecret) {
    throw new Error('JWE_SECRET environment variable is not set');
  }

  // If it's a base64url encoded secret, decode it
  try {
    const decoded = base64url.decode(jweSecret);
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Not base64url, continue with text encoding
  }

  // Ensure the secret is exactly 32 bytes for A256GCM
  const encoder = new TextEncoder();
  const encoded = encoder.encode(jweSecret);
  if (encoded.length < 32) {
    // Pad with zeros if too short
    const padded = new Uint8Array(32);
    padded.set(encoded);
    return padded;
  }
  return encoded.slice(0, 32);
}

export async function encryptSession(
  session: Omit<Session, 'expiresAt'>,
  secretOverride?: string,
): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION;
  const secret = await getSecret(secretOverride);

  const jwt = await new EncryptJWT({ session: { ...session, expiresAt } })
    .setProtectedHeader({ alg, enc })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .encrypt(secret);

  return jwt;
}

export async function decryptSession(
  token: string,
  secretOverride?: string,
): Promise<Session | null> {
  try {
    const secret = await getSecret(secretOverride);
    const { payload } = await jwtDecrypt(token, secret);
    const { session } = payload as unknown as SessionPayload;

    if (session.expiresAt < Date.now()) {
      console.warn('[Auth] Session expired:', new Date(session.expiresAt).toISOString());
      return null;
    }

    return session;
  } catch (error) {
    // Only log in development to avoid noise in production
    if (process.env.NODE_ENV === 'development') {
      console.error('[Auth] Failed to decrypt session:', error);
    }
    return null;
  }
}
