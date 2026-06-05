import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { StoredToken, CreateTokenOpts, StoredCode, CreateCodeOpts } from './types.js';

// After this window expires the token can no longer be refreshed and the user must re-authenticate.
// 7 days is a deliberate balance: long enough that a session-idle app does not surprise the user,
// short enough that a stolen token has a bounded blast radius.
const REFRESH_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

function generateTokenId(): string {
  return `tok_${randomBytes(12).toString('hex')}`;
}

/**
 * Parses a simple duration string (e.g. "24h", "7d", "30m") into milliseconds.
 *
 * Supported units: `m` (minutes), `h` (hours), `d` (days).
 * Throws for unrecognized formats or units.
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(h|d|m)$/);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Invalid duration unit: ${match[2]}`);
  }
}

/**
 * Persists JWT tokens and one-time authorization codes to a JSON file.
 *
 * Revocation is flag-based: tokens are marked `revoked: true` rather than deleted,
 * so the auth middleware can distinguish a revoked token from an unknown one.
 * Periodic cleanup (via `cleanup()`) removes tokens past their refresh deadline
 * and expired/used codes to prevent unbounded file growth.
 *
 * Saves are asynchronous and coalesced: concurrent mutations schedule a single write
 * to avoid thundering-herd disk I/O under bursty auth traffic.
 */
export class TokenStore {
  private tokens = new Map<string, StoredToken>();
  private codes = new Map<string, StoredCode>();
  private savePromise: Promise<void> | null = null;
  private savePending = false;

  constructor(private filePath: string) {}

  /** Loads token and code state from disk. Safe to call at startup; missing file is not an error. */
  async load(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8');
      let parsed: { tokens: StoredToken[]; codes?: StoredCode[] };
      try {
        parsed = JSON.parse(data) as { tokens: StoredToken[]; codes?: StoredCode[] };
      } catch {
        console.warn(`[TokenStore] Failed to parse ${this.filePath} — retaining existing tokens`);
        return;
      }
      this.tokens.clear();
      let needsMigration = false;
      for (const token of parsed.tokens) {
        // Migrate tokens created before identitySecret was introduced
        if (!token.identitySecret) {
          token.identitySecret = randomBytes(16).toString('hex');
          needsMigration = true;
        }
        this.tokens.set(token.id, token);
      }
      // Persist migrated secrets so they survive the next restart
      if (needsMigration) this.scheduleSave();
      this.codes.clear();
      for (const code of parsed.codes ?? []) {
        this.codes.set(code.code, code);
      }
    } catch {
      // File does not exist yet — start with empty store
      this.tokens.clear();
      this.codes.clear();
    }
  }

  async save(): Promise<void> {
    const data = {
      tokens: Array.from(this.tokens.values()),
      codes: Array.from(this.codes.values()),
    };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Coalesces concurrent writes: if a save is in-flight, sets a pending flag
   * so the next save fires immediately after the current one completes.
   */
  private scheduleSave(): void {
    if (this.savePromise) {
      this.savePending = true;
      return;
    }
    this.savePromise = this.save()
      .catch((err) => {
        console.error("[TokenStore] Failed to persist token data:", err);
      })
      .finally(() => {
        this.savePromise = null;
        if (this.savePending) {
          this.savePending = false;
          this.scheduleSave();
        }
      });
  }

  /** Creates a new token record and schedules a persist. Returns the stored token including its generated id. */
  create(opts: CreateTokenOpts): StoredToken {
    const now = new Date();
    const token: StoredToken = {
      id: generateTokenId(),
      name: opts.name,
      role: opts.role,
      scopes: opts.scopes,
      createdAt: now.toISOString(),
      refreshDeadline: new Date(now.getTime() + REFRESH_DEADLINE_MS).toISOString(),
      revoked: false,
      identitySecret: randomBytes(16).toString('hex'),
    };
    this.tokens.set(token.id, token);
    this.scheduleSave();
    return token;
  }

  get(id: string): StoredToken | undefined {
    return this.tokens.get(id);
  }

  /** Marks a token as revoked; future auth checks will reject it immediately. */
  revoke(id: string): void {
    const token = this.tokens.get(id);
    if (token) {
      token.revoked = true;
      this.scheduleSave();
    }
  }

  /** Returns all non-revoked tokens. Revoked tokens are retained until cleanup() removes them. */
  list(): StoredToken[] {
    return Array.from(this.tokens.values()).filter((t) => !t.revoked);
  }

  private lastUsedSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Records the current timestamp as `lastUsedAt` for the given token.
   *
   * Writes are debounced to 60 seconds — every API request updates this field,
   * so flushing on every call would cause excessive disk I/O.
   */
  updateLastUsed(id: string): void {
    const token = this.tokens.get(id);
    if (token) {
      token.lastUsedAt = new Date().toISOString();
      // Debounce persist — batch lastUsedAt updates every 60s
      if (!this.lastUsedSaveTimer) {
        this.lastUsedSaveTimer = setTimeout(() => {
          this.lastUsedSaveTimer = null;
          this.scheduleSave();
        }, 60_000);
      }
    }
  }

  /** Wait for any in-flight and pending saves to complete */
  async flush(): Promise<void> {
    if (this.lastUsedSaveTimer) {
      clearTimeout(this.lastUsedSaveTimer);
      this.lastUsedSaveTimer = null;
      this.scheduleSave();
    }
    while (this.savePromise || this.savePending) {
      if (this.savePromise) await this.savePromise;
      // After awaiting, scheduleSave may have re-fired if savePending was true.
      // Loop until fully drained.
    }
  }

  destroy(): void {
    if (this.lastUsedSaveTimer) {
      clearTimeout(this.lastUsedSaveTimer);
      this.lastUsedSaveTimer = null;
    }
  }

  /** Associate a user ID with a token. Called by identity plugin after /identity/setup. */
  setUserId(tokenId: string, userId: string): void {
    const token = this.tokens.get(tokenId);
    if (token) {
      token.userId = userId;
      this.scheduleSave();
    }
  }

  /** Get the user ID associated with a token. */
  getUserId(tokenId: string): string | undefined {
    return this.tokens.get(tokenId)?.userId;
  }

  /**
   * Looks up a non-revoked token by its identity secret.
   *
   * Used by the identity re-link flow: the App sends the old token's identitySecret
   * to prove continuity of identity when reconnecting with a new JWT.
   * Returns undefined if no match, or if the matching token is revoked.
   */
  getByIdentitySecret(secret: string): StoredToken | undefined {
    for (const token of this.tokens.values()) {
      if (!token.revoked && token.identitySecret === secret) return token;
    }
    return undefined;
  }

  /**
   * Generates a one-time authorization code that can be exchanged for a JWT.
   *
   * Used for the CLI login flow: the server emits a code that the user copies into
   * the App, which exchanges it for a proper JWT without ever exposing the raw API secret.
   */
  createCode(opts: CreateCodeOpts): StoredCode {
    const code = randomBytes(16).toString('hex');
    const now = new Date();
    const ttl = opts.codeTtlMs ?? 30 * 60 * 1000; // 30 minutes
    const stored: StoredCode = {
      code,
      role: opts.role,
      scopes: opts.scopes,
      name: opts.name,
      expire: opts.expire,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl).toISOString(),
      used: false,
    };
    this.codes.set(code, stored);
    this.scheduleSave();
    return stored;
  }

  getCode(code: string): StoredCode | undefined {
    const stored = this.codes.get(code);
    if (!stored) return undefined;
    if (stored.used) return undefined;
    if (new Date(stored.expiresAt).getTime() < Date.now()) return undefined;
    return stored;
  }

  /**
   * Atomically marks a code as used and returns it.
   *
   * Returns undefined if the code is unknown, already used, or expired.
   * The one-time-use flag is set before returning, so concurrent calls for the
   * same code will only succeed once.
   */
  exchangeCode(code: string): StoredCode | undefined {
    const stored = this.codes.get(code);
    if (!stored) return undefined;
    if (stored.used) return undefined;
    if (new Date(stored.expiresAt).getTime() < Date.now()) return undefined;
    stored.used = true;
    this.scheduleSave();
    return stored;
  }

  listCodes(): StoredCode[] {
    const now = Date.now();
    return [...this.codes.values()].filter(
      (c) => !c.used && new Date(c.expiresAt).getTime() > now,
    );
  }

  revokeCode(code: string): void {
    this.codes.delete(code);
    this.scheduleSave();
  }

  /**
   * Removes tokens past their refresh deadline and expired/used codes.
   *
   * Called on a 1-hour interval from the plugin setup to prevent unbounded file growth.
   * Tokens within their refresh deadline are retained even if revoked, so that the
   * "token revoked" error can be returned instead of "token unknown".
   */
  cleanup(): void {
    const now = Date.now();
    for (const [id, token] of this.tokens) {
      if (new Date(token.refreshDeadline).getTime() < now) {
        this.tokens.delete(id);
      }
    }
    for (const [code, stored] of this.codes) {
      if (stored.used || new Date(stored.expiresAt).getTime() < now) {
        this.codes.delete(code);
      }
    }
    this.scheduleSave();
  }
}
