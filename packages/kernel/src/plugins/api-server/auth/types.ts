/** A token record persisted in tokens.json. Tokens are never deleted; they are revoked by flag. */
export interface StoredToken {
  id: string;
  name: string;
  role: string;
  /** Custom scope overrides; when absent, role defaults from ROLES apply. */
  scopes?: string[];
  createdAt: string;
  /** Absolute deadline after which the token cannot be refreshed — requires re-authentication. */
  refreshDeadline: string;
  lastUsedAt?: string;
  revoked: boolean;
  /** User ID from identity system. Null until user completes /identity/setup. */
  userId?: string;
  /**
   * Per-token secret for identity re-linking on reconnect.
   * Never embedded in the JWT — only returned at token creation/exchange time.
   * The App stores this in its workspace store and uses it to silently re-link
   * a new token to the same user after the old token's refresh deadline expires.
   */
  identitySecret: string;
}

/** Claims embedded in a signed JWT. `rfd` (refresh deadline) is a Unix timestamp (seconds). */
export interface JwtPayload {
  sub: string;
  role: string;
  /** Token-level scope overrides, or undefined to fall back to role defaults. */
  scopes?: string[];
  iat: number;
  exp: number;
  /** Refresh deadline as Unix timestamp (seconds); mirrors StoredToken.refreshDeadline. */
  rfd: number;
}

export interface CreateTokenOpts {
  role: string;
  name: string;
  /** Duration string, e.g. "24h", "7d". Parsed by parseDuration(). */
  expire: string;
  scopes?: string[];
}

/** Shape returned to the caller when a new token is issued. */
export interface TokenInfo {
  tokenId: string;
  accessToken: string;
  expiresAt: string;
  refreshDeadline: string;
  /** Opaque secret for identity re-linking. See StoredToken.identitySecret. */
  identitySecret: string;
}

/**
 * A one-time authorization code stored until exchange.
 * The code is a 32-char hex string; it becomes unusable after `expiresAt` or first use.
 */
export interface StoredCode {
  code: string;
  role: string;
  scopes?: string[];
  name: string;
  /** Duration that the resulting JWT will be valid for. */
  expire: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface CreateCodeOpts {
  role: string;
  name: string;
  expire: string;
  scopes?: string[];
  /** How long the code itself is valid; defaults to 30 minutes. */
  codeTtlMs?: number;
}
