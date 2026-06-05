import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { JwtPayload } from './types.js';

export interface SignPayload {
  sub: string;
  role: string;
  scopes?: string[];
  /** Refresh deadline as Unix timestamp (seconds). Embedded in the JWT so the refresh endpoint
   *  can enforce it without a database lookup when the access token has already expired. */
  rfd: number;
}

/**
 * Signs a short-lived access token using HS256.
 *
 * HS256 is sufficient here because the secret never leaves the server process;
 * asymmetric keys would add complexity with no security benefit in this deployment model.
 */
export function signToken(payload: SignPayload, secret: string, expiresIn: string): string {
  const opts: SignOptions = { algorithm: 'HS256', expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret, opts);
}

/**
 * Verifies a JWT and returns its decoded payload.
 *
 * Throws if the token is invalid, has been tampered with, or is expired.
 */
export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
}

/**
 * Verifies a JWT signature but ignores expiration — used exclusively during token refresh.
 *
 * The caller must check `rfd` (refresh deadline) separately: once that deadline passes,
 * refreshing is no longer permitted regardless of the original expiry window.
 */
export function verifyForRefresh(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret, { algorithms: ['HS256'], ignoreExpiration: true }) as JwtPayload;
}
