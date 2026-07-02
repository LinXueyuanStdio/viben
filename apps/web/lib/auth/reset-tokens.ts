/**
 * In-memory password reset token store.
 * Tokens expire after 1 hour.
 */

interface ResetTokenEntry {
  email: string;
  expiresAt: number;
}

const store = new Map<string, ResetTokenEntry>();

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// Periodically clean expired tokens
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of store) {
      if (entry.expiresAt < now) {
        store.delete(token);
      }
    }
  }, 5 * 60 * 1000); // Clean every 5 minutes
}

export function storeResetToken(token: string, email: string): void {
  store.set(token, {
    email,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  });
}

export function consumeResetToken(token: string): string | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(token);
    return null;
  }
  store.delete(token); // One-time use
  return entry.email;
}
