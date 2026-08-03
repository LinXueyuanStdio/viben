import { createHash, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { and, eq, lt, isNull } from "drizzle-orm";
import { db, oauthGrants, oauthTokens, users } from "@/lib/db";
import type { Session } from "@/lib/auth/types";

const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const ACCESS_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── PKCE utilities ─────────────────────────────────────

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function computeCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  return computeCodeChallenge(verifier) === challenge;
}

// ── Token generation ───────────────────────────────────

function generateToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

// ── Authorization Code ─────────────────────────────────

export interface OAuthGrant {
  code: string;
  userId: string;
  clientId?: string;
  scopes: string;
}

export async function createAuthorizationCode(
  userId: string,
  clientId?: string,
  redirectUri?: string,
  codeChallenge?: string,
  codeChallengeMethod?: string,
  scopes = "read write",
): Promise<string> {
  const code = generateToken("voac");
  await db.insert(oauthGrants).values({
    code,
    codeChallenge,
    codeChallengeMethod,
    clientId,
    redirectUri,
    userId,
    scopes,
    expiresAt: new Date(Date.now() + CODE_EXPIRY_MS),
  });
  return code;
}

export async function consumeAuthorizationCode(
  code: string,
  codeVerifier?: string,
): Promise<OAuthGrant | null> {
  const grant = await db.query.oauthGrants.findFirst({
    where: and(
      eq(oauthGrants.code, code),
      eq(oauthGrants.used, false),
    ),
  });

  if (!grant) return null;
  if (new Date() > grant.expiresAt) return null;

  // PKCE verification
  if (grant.codeChallenge && codeVerifier) {
    if (!verifyCodeChallenge(codeVerifier, grant.codeChallenge)) return null;
  }

  // Mark as used
  await db.update(oauthGrants).set({ used: true }).where(eq(oauthGrants.code, code));

  return {
    code: grant.code,
    userId: grant.userId,
    clientId: grant.clientId ?? undefined,
    scopes: grant.scopes ?? "read write",
  };
}

// ── Access / Refresh Tokens ────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  scopes: string;
}

export async function issueTokens(
  userId: string,
  clientId?: string,
  scopes = "read write",
): Promise<TokenPair> {
  const accessToken = generateToken("voat");
  const refreshToken = generateToken("vort");

  await db.insert(oauthTokens).values({
    userId,
    clientId,
    scopes,
    tokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS),
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
    userId,
    scopes,
  };
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; scopes: string } | null> {
  const hash = hashToken(token);
  const record = await db.query.oauthTokens.findFirst({
    where: and(
      eq(oauthTokens.tokenHash, hash),
      eq(oauthTokens.revoked, false),
    ),
  });

  if (!record) return null;
  if (new Date() > record.expiresAt) return null;

  return { userId: record.userId, scopes: record.scopes ?? "read write" };
}

export async function revokeToken(token: string): Promise<boolean> {
  const hash = hashToken(token);
  const result = await db
    .update(oauthTokens)
    .set({ revoked: true })
    .where(eq(oauthTokens.tokenHash, hash));
  return true;
}

export async function rotateRefreshToken(
  refreshToken: string,
): Promise<TokenPair | null> {
  const hash = hashToken(refreshToken);
  const record = await db.query.oauthTokens.findFirst({
    where: and(
      eq(oauthTokens.refreshTokenHash, hash),
      eq(oauthTokens.revoked, false),
    ),
  });

  if (!record) return null;

  // Revoke old token
  await db.update(oauthTokens).set({ revoked: true }).where(eq(oauthTokens.id, record.id));

  // Issue new pair
  return issueTokens(record.userId, record.clientId ?? undefined, record.scopes ?? "read write");
}

// ── Cleanup ─────────────────────────────────────────────

export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();
  await db.delete(oauthGrants).where(
    and(eq(oauthGrants.used, true), lt(oauthGrants.expiresAt, now)),
  );
  await db.delete(oauthTokens).where(
    and(eq(oauthTokens.revoked, true), lt(oauthTokens.expiresAt, now)),
  );
}
