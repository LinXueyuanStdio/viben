import { cookies } from 'next/headers';
import { encryptSession, decryptSession } from './jwe';
import type { Session } from './types';

const COOKIE_NAME = 'session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export async function setSessionCookie(session: Omit<Session, 'expiresAt'>): Promise<void> {
  const token = await encryptSession(session);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Auth] No session cookie found');
    }
    return null;
  }

  const session = await decryptSession(token);
  if (!session && process.env.NODE_ENV === 'development') {
    console.warn('[Auth] Session cookie exists but decryption failed');
  }
  return session;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
