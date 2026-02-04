import { EncryptJWT, jwtDecrypt } from 'jose';
import type { Session, SessionPayload } from './types';

const secret = new TextEncoder().encode(process.env.JWE_SECRET!);
const alg = 'dir';
const enc = 'A256GCM';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function encryptSession(session: Omit<Session, 'expiresAt'>): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION;

  return new EncryptJWT({ session: { ...session, expiresAt } })
    .setProtectedHeader({ alg, enc })
    .setIssuedAt()
    .setExpirationTime(expiresAt / 1000)
    .encrypt(secret);
}

export async function decryptSession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtDecrypt(token, secret);
    const { session } = payload as unknown as SessionPayload;

    if (session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
